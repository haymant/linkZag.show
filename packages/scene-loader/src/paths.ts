import fs from 'node:fs'
import path from 'node:path'

export const SCENE_EXTENSIONS = ['.yaml', '.yml', '.json', '.md'] as const

export interface ProjectLayout {
  projectRoot: string
  contentDir: string
  scenesDir: string
  assetsDir: string
}

export function findProjectRoot(start: string = process.cwd()): string {
  let current = path.resolve(start)
  for (;;) {
    const packageJson = path.join(current, 'package.json')
    const contentDir = path.join(current, 'content')
    if (fs.existsSync(packageJson) && fs.existsSync(contentDir)) return current
    if (fs.existsSync(packageJson)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf8')) as { name?: string }
        if (pkg.name === 'linkzag-show') return current
      } catch {
        // keep walking
      }
    }
    const parent = path.dirname(current)
    if (parent === current) return path.resolve(start)
    current = parent
  }
}

export function projectLayout(projectRoot: string = findProjectRoot()): ProjectLayout {
  const root = path.resolve(projectRoot)
  const contentDir = path.join(root, 'content')
  return {
    projectRoot: root,
    contentDir,
    scenesDir: path.join(contentDir, 'scenes'),
    assetsDir: path.join(contentDir, 'assets'),
  }
}

export function isFile(file: string): boolean {
  try {
    return fs.statSync(file).isFile()
  } catch {
    return false
  }
}

export function isInside(parent: string, child: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child))
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

export function ensureInside(parent: string, child: string): string {
  const resolved = path.resolve(child)
  if (!isInside(parent, resolved)) {
    throw new Error(`Refusing to access a file outside the project: ${resolved}`)
  }
  return resolved
}

export function relativePosix(from: string, to: string): string {
  return path.relative(from, to).split(path.sep).join('/')
}

export function resolveExistingFile(input: string, baseDirs: string[]): string | null {
  const expanded = input.startsWith('~') ? path.join(process.env.HOME ?? '', input.slice(1)) : input
  const candidates: string[] = []
  if (path.isAbsolute(expanded)) {
    candidates.push(expanded)
  } else {
    for (const dir of baseDirs) candidates.push(path.resolve(dir, expanded))
  }

  const withExtensions = candidates.flatMap((candidate) => {
    if (path.extname(candidate)) return [candidate]
    return [candidate, ...SCENE_EXTENSIONS.map((ext) => candidate + ext)]
  })

  for (const candidate of new Set(withExtensions)) {
    if (isFile(candidate)) return candidate
  }
  return null
}

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'scene'
}
