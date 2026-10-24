import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import YAML from 'yaml'
import { z } from 'zod'
import { SceneSchema } from '@linkzag/scene-types'
import type { CodeLanguage, Scene } from '@linkzag/scene-types'
import { SceneError } from './errors.ts'
import { isFile, projectLayout, relativePosix, resolveExistingFile, slugify } from './paths.ts'

export interface LoadSceneOptions {
  projectRoot?: string
  contentDir?: string
  /** Additional directories searched for relative includes and scene inputs. */
  searchDirs?: string[]
}

export interface LoadedScene {
  scene: Scene
  /** Absolute source path. */
  file: string
  /** Path relative to the project root, with forward slashes. */
  relativePath: string
  /** SHA-256 over the scene source plus every included file. */
  checksum: string
  sources: string[]
}

export interface SceneSummary {
  id: string
  title?: string
  duration: number
  path: string
  absolutePath: string
  theme?: string
  variant?: string
  itemCount: number
}

const CODE_EXTENSIONS: Record<string, CodeLanguage> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.json': 'json',
  '.sh': 'bash',
  '.bash': 'bash',
  '.sql': 'sql',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.txt': 'text',
}

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.yaml': 'application/yaml; charset=utf-8',
  '.yml': 'application/yaml; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readUtf8(file: string, label: string): string {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch (error) {
    throw new SceneError(`Could not read ${label}: ${file}`, { file, cause: error })
  }
}

function parseDataFile(file: string, raw: string): unknown {
  try {
    if (path.extname(file).toLowerCase() === '.json') {
      return JSON.parse(raw) as unknown
    }
    return YAML.parse(raw) as unknown
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new SceneError(`Could not parse ${file}: ${message}`, { file, cause: error })
  }
}

function formatZodError(error: z.ZodError, file: string): SceneError {
  const details = error.issues.map((issue) => {
    const location = issue.path.length ? issue.path.join('.') : '(root)'
    return `${location}: ${issue.message}`
  })
  return new SceneError(`Invalid scene: ${file}`, { file, details })
}

function firstHeading(markdown: string): string | undefined {
  const match = markdown.match(/^\s*#\s+(.+?)\s*$/m)
  return match?.[1]?.trim()
}

function stripFirstHeading(markdown: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return markdown.replace(new RegExp(`^\\s*#\\s+${escaped}\\s*\\r?\\n?`, 'm'), '').trim()
}

function markdownDocument(file: string, raw: string): JsonRecord {
  let parsed: matter.GrayMatterFile<string>
  try {
    parsed = matter(raw)
  } catch (error) {
    throw new SceneError(`Could not parse Markdown frontmatter: ${file}`, { file, cause: error })
  }

  const data = parsed.data as JsonRecord
  const body = parsed.content.trim()
  const heading = firstHeading(body)
  const title = typeof data.title === 'string' ? data.title : heading
  const content = typeof data.title === 'string' ? body : heading ? stripFirstHeading(body, heading) : body
  const id = typeof data.id === 'string' && data.id ? data.id : slugify(path.basename(file))

  return {
    ...data,
    id,
    ...(title ? { title } : {}),
    items: [
      {
        type: 'markdown',
        content,
      },
    ],
  }
}

function parseSceneDocument(file: string): { raw: JsonRecord } {
  const rawText = readUtf8(file, 'scene')
  const ext = path.extname(file).toLowerCase()
  if (ext === '.md') {
    return { raw: markdownDocument(file, rawText) }
  }
  const parsed = parseDataFile(file, rawText)
  if (!isRecord(parsed)) {
    throw new SceneError(`Scene must be a YAML/JSON object: ${file}`, { file })
  }
  const raw = { ...parsed }
  if (typeof raw.id !== 'string' || !raw.id) raw.id = slugify(path.basename(file))
  if (raw.items === undefined) raw.items = []
  return { raw }
}

interface ResolveContext {
  sceneFile: string
  sceneDir: string
  projectRoot: string
  contentDir: string
  searchDirs: string[]
  sources: Set<string>
}

function resolveIncludeFile(spec: string, ctx: ResolveContext, field: string): string {
  const dirs = [ctx.sceneDir, ctx.projectRoot, ctx.contentDir, ...ctx.searchDirs]
  const resolved = resolveExistingFile(spec, dirs)
  if (!resolved) {
    throw new SceneError(
      `Could not resolve ${field} "${spec}" from ${ctx.sceneFile}. Looked relative to the scene, project root, and content directory.`,
      { file: ctx.sceneFile },
    )
  }
  ctx.sources.add(resolved)
  return resolved
}

function assetUrl(file: string, ctx: ResolveContext): string {
  ctx.sources.add(file)
  return `/__linkzag/asset?path=${encodeURIComponent(file)}`
}

function localAsset(spec: string, ctx: ResolveContext, field: string): string {
  if (spec.startsWith('data:')) return spec
  if (spec.startsWith('/__linkzag/asset?')) return spec
  if (/^https?:\/\//i.test(spec)) {
    throw new SceneError(
      `${field} points to a remote URL (${spec}). Deterministic rendering requires local assets; download it into content/assets first.`,
      { file: ctx.sceneFile },
    )
  }
  const file = resolveIncludeFile(spec, ctx, field)
  return assetUrl(file, ctx)
}

function readIncludeText(spec: string, ctx: ResolveContext, field: string): string {
  return readUtf8(resolveIncludeFile(spec, ctx, field), field)
}

function resolveItem(item: unknown, index: number, ctx: ResolveContext): unknown {
  if (!isRecord(item)) return item
  const copy: JsonRecord = { ...item }
  const where = `items.${index}`
  const type = copy.type

  switch (type) {
    case 'markdown': {
      const hasContent = typeof copy.content === 'string'
      const hasFile = typeof copy.file === 'string'
      if (hasContent && hasFile) {
        throw new SceneError(`${where}: use either "content" or "file", not both.`, { file: ctx.sceneFile })
      }
      if (hasFile) {
        copy.content = readIncludeText(copy.file as string, ctx, `${where}.file`)
      }
      delete copy.file
      break
    }
    case 'echarts': {
      const hasOption = copy.option !== undefined
      const hasFile = typeof copy.file === 'string'
      if (hasOption && hasFile) {
        throw new SceneError(`${where}: use either "option" or "file", not both.`, { file: ctx.sceneFile })
      }
      if (hasFile) {
        const file = resolveIncludeFile(copy.file as string, ctx, `${where}.file`)
        const parsed = parseDataFile(file, readUtf8(file, 'ECharts option'))
        if (!isRecord(parsed)) {
          throw new SceneError(`${where}.file: ECharts option must be an object.`, { file: ctx.sceneFile })
        }
        copy.option = parsed
      }
      delete copy.file
      break
    }
    case 'mermaid': {
      const hasCode = typeof copy.code === 'string'
      const hasFile = typeof copy.file === 'string'
      if (hasCode && hasFile) {
        throw new SceneError(`${where}: use either "code" or "file", not both.`, { file: ctx.sceneFile })
      }
      if (hasFile) {
        copy.code = readIncludeText(copy.file as string, ctx, `${where}.file`)
      }
      delete copy.file
      break
    }
    case 'xyflow': {
      const hasInline = copy.nodes !== undefined || copy.edges !== undefined
      const hasFile = typeof copy.file === 'string'
      if (hasFile) {
        if (hasInline) {
          throw new SceneError(`${where}: use either inline nodes/edges or "file", not both.`, {
            file: ctx.sceneFile,
          })
        }
        const file = resolveIncludeFile(copy.file as string, ctx, `${where}.file`)
        const parsed = parseDataFile(file, readUtf8(file, 'XYFlow graph'))
        if (Array.isArray(parsed)) {
          copy.nodes = parsed
          copy.edges = []
        } else if (isRecord(parsed)) {
          copy.nodes = parsed.nodes ?? []
          copy.edges = parsed.edges ?? []
        } else {
          throw new SceneError(`${where}.file: expected { nodes, edges } or a node array.`, {
            file: ctx.sceneFile,
          })
        }
      }
      delete copy.file
      if (copy.nodes === undefined) copy.nodes = []
      if (copy.edges === undefined) copy.edges = []
      break
    }
    case 'image': {
      const hasSrc = typeof copy.src === 'string'
      const hasFile = typeof copy.file === 'string'
      if (hasSrc && hasFile) {
        throw new SceneError(`${where}: use either "src" or "file", not both.`, { file: ctx.sceneFile })
      }
      if (hasFile) {
        copy.src = localAsset(copy.file as string, ctx, `${where}.file`)
      } else if (hasSrc) {
        copy.src = localAsset(copy.src as string, ctx, `${where}.src`)
      }
      delete copy.file
      break
    }
    case 'quote': {
      if (typeof copy.avatar === 'string') {
        copy.avatar = localAsset(copy.avatar, ctx, `${where}.avatar`)
      }
      break
    }
    case 'code': {
      const hasCode = typeof copy.code === 'string'
      const hasFile = typeof copy.file === 'string'
      if (hasCode && hasFile) {
        throw new SceneError(`${where}: use either "code" or "file", not both.`, { file: ctx.sceneFile })
      }
      if (hasFile) {
        const file = resolveIncludeFile(copy.file as string, ctx, `${where}.file`)
        copy.code = readUtf8(file, `${where}.file`)
        if (copy.language === undefined) {
          copy.language = CODE_EXTENSIONS[path.extname(file).toLowerCase()] ?? 'text'
        }
        if (copy.filename === undefined) copy.filename = path.basename(file)
      }
      delete copy.file
      break
    }
    default:
      break
  }

  return copy
}

function collectSceneFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  const files: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectSceneFiles(full))
    } else if (entry.isFile() && /\.(ya?ml|json|md)$/i.test(entry.name)) {
      files.push(full)
    }
  }
  return files
}

function documentId(file: string): string | undefined {
  try {
    const { raw } = parseSceneDocument(file)
    return typeof raw.id === 'string' && raw.id ? raw.id : undefined
  } catch {
    return undefined
  }
}

function resolveSceneInput(input: string, opts: LoadSceneOptions): string {
  const projectRoot = path.resolve(opts.projectRoot ?? process.cwd())
  const layout = projectLayout(projectRoot)
  const contentDir = path.resolve(opts.contentDir ?? layout.contentDir)
  const dirs = [
    process.cwd(),
    projectRoot,
    layout.scenesDir,
    path.join(contentDir, 'scenes'),
    path.join(contentDir, 'examples'),
    contentDir,
    ...(opts.searchDirs ?? []),
  ]
  const direct = resolveExistingFile(input, dirs)
  if (direct) return direct

  // Match either the file stem or the scene's declared id, recursively. This
  // lets content/scenes/demo/04-overlay.yaml be addressed as `demo-overlay`
  // instead of forcing callers to remember its directory.
  const wanted = slugify(path.basename(input))
  const scenesDir = path.join(contentDir, 'scenes')
  const matches = collectSceneFiles(scenesDir).filter((file) => {
    if (slugify(path.basename(file)) === wanted) return true
    const id = documentId(file)
    return id !== undefined && slugify(id) === wanted
  })
  if (matches.length === 1) return matches[0]!
  if (matches.length > 1) {
    throw new SceneError(`Scene name "${input}" is ambiguous: ${matches.join(', ')}`)
  }

  throw new SceneError(
    `Scene not found: ${input}. Try a path relative to the project or an id from content/scenes.\nSearched:\n${dirs
      .map((dir) => `  - ${path.join(dir, input)}`)
      .slice(0, 8)
      .join('\n')}`,
  )
}

export function resolveScenePath(input: string, opts: LoadSceneOptions = {}): string {
  return resolveSceneInput(input, opts)
}

export function loadScene(input: string, opts: LoadSceneOptions = {}): LoadedScene {
  const file = resolveSceneInput(input, opts)
  const projectRoot = path.resolve(opts.projectRoot ?? process.cwd())
  const layout = projectLayout(projectRoot)
  const contentDir = path.resolve(opts.contentDir ?? layout.contentDir)
  const rawText = readUtf8(file, 'scene')
  const { raw } = parseSceneDocument(file)

  const ctx: ResolveContext = {
    sceneFile: file,
    sceneDir: path.dirname(file),
    projectRoot,
    contentDir,
    searchDirs: opts.searchDirs ?? [],
    sources: new Set([file]),
  }

  if (Array.isArray(raw.items)) {
    raw.items = raw.items.map((item, index) => resolveItem(item, index, ctx))
  }

  const parsed = SceneSchema.safeParse(raw)
  if (!parsed.success) throw formatZodError(parsed.error, file)

  const hash = crypto.createHash('sha256')
  hash.update(`scene:${file}\n`)
  hash.update(rawText)
  const sources = [...ctx.sources].sort()
  for (const source of sources) {
    if (source === file) continue
    hash.update(`\ninclude:${source}\n`)
    try {
      hash.update(fs.readFileSync(source))
    } catch {
      // A missing include would already have failed above.
    }
  }

  return {
    scene: parsed.data,
    file,
    relativePath: relativePosix(projectRoot, file),
    checksum: hash.digest('hex'),
    sources,
  }
}

export function summarizeScene(loaded: LoadedScene): SceneSummary {
  return {
    id: loaded.scene.id,
    title: loaded.scene.title,
    duration: loaded.scene.duration,
    path: loaded.relativePath,
    absolutePath: loaded.file,
    theme: loaded.scene.theme,
    variant: loaded.scene.variant,
    itemCount: loaded.scene.items.length,
  }
}

export function discoverScenes(opts: LoadSceneOptions = {}): {
  scenes: SceneSummary[]
  errors: Array<{ path: string; error: string; details?: string[] }>
} {
  const projectRoot = path.resolve(opts.projectRoot ?? process.cwd())
  const layout = projectLayout(projectRoot)
  const contentDir = path.resolve(opts.contentDir ?? layout.contentDir)
  const scenesDir = path.join(contentDir, 'scenes')
  const scenes: SceneSummary[] = []
  const errors: Array<{ path: string; error: string; details?: string[] }> = []

  const visit = (dir: string) => {
    if (!fs.existsSync(dir)) return
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        visit(full)
        continue
      }
      if (!/\.(ya?ml|json|md)$/i.test(entry.name)) continue
      try {
        scenes.push(summarizeScene(loadScene(full, { ...opts, projectRoot, contentDir })))
      } catch (error) {
        errors.push({
          path: relativePosix(projectRoot, full),
          error: error instanceof Error ? error.message : String(error),
          details: error instanceof SceneError ? error.details : undefined,
        })
      }
    }
  }

  visit(scenesDir)
  scenes.sort((a, b) => a.path.localeCompare(b.path))
  return { scenes, errors }
}

export function assetContentType(file: string): string {
  return MIME_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream'
}

export function includedSourceExists(file: string): boolean {
  return isFile(file)
}
