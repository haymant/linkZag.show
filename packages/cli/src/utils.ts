import fs from 'node:fs/promises'
import path from 'node:path'
import { createCaptureSession, startCaptureServer, type CaptureSession, type SceneTarget } from '@linkzag/capture-engine'
import { loadScene, findProjectRoot, slugify } from '@linkzag/scene-loader'
import {
  isTransparent,
  resolveScene,
  type RenderOverrides,
  type ResolvedScene,
  type Scene,
  type SceneVariant,
  type ThemeName,
} from '@linkzag/scene-types'

export interface CommonOptions {
  scene: string
  projectRoot?: string
  theme?: ThemeName
  variant?: SceneVariant | 'auto'
  background?: string
  transparent?: boolean
  width?: number
  height?: number
  baseUrl?: string
  timeout?: number
  quiet?: boolean
}

export interface PreparedScene {
  projectRoot: string
  loadedPath: string
  checksum: string
  scene: Scene
  resolved: ResolvedScene
  transparent: boolean
  target: SceneTarget
  slug: string
  outputDir: string
  defaultStill: string
}

export function prepareScene(options: CommonOptions): PreparedScene {
  const projectRoot = path.resolve(options.projectRoot ?? findProjectRoot())
  const loaded = loadScene(options.scene, { projectRoot })
  const overrides: RenderOverrides = {}
  if (options.theme) overrides.theme = options.theme
  if (options.variant) overrides.variant = options.variant
  if (options.background) overrides.background = options.background
  if (options.transparent) overrides.transparent = true
  if (options.width) overrides.width = options.width
  if (options.height) overrides.height = options.height

  const resolved = resolveScene(loaded.scene, overrides)
  const transparent = isTransparent(resolved)
  const slug = slugify(resolved.id)
  const outputDir = path.join(projectRoot, 'output', slug)

  return {
    projectRoot,
    loadedPath: loaded.relativePath,
    checksum: loaded.checksum,
    scene: resolved,
    resolved,
    transparent,
    target: {
      scene: loaded.relativePath,
      width: resolved.width,
      height: resolved.height,
      duration: resolved.duration,
    },
    slug,
    outputDir,
    defaultStill: path.join(outputDir, `${slug}-still.png`),
  }
}

export function resolveOutput(value: string | undefined, fallback: string): string {
  return value ? path.resolve(process.cwd(), value) : fallback
}

export async function withCaptureSession<T>(
  prepared: PreparedScene,
  options: CommonOptions,
  fn: (session: CaptureSession) => Promise<T>,
): Promise<T> {
  let server: Awaited<ReturnType<typeof startCaptureServer>> | undefined
  let session: CaptureSession | undefined
  try {
    let baseUrl = options.baseUrl
    if (!baseUrl) {
      server = await startCaptureServer({ projectRoot: prepared.projectRoot })
      baseUrl = server.baseUrl
    }
    session = await createCaptureSession({ baseUrl })
    return await fn(session)
  } finally {
    await session?.close()
    await server?.close()
  }
}

export async function writeStill(
  prepared: PreparedScene,
  session: CaptureSession,
  file: string,
  time = prepared.resolved.duration,
): Promise<{ file: string; bytes: number; width: number; height: number; time: number }> {
  const buffer = await session.captureStill(prepared.target, {
    time,
    theme: prepared.resolved.theme,
    variant: prepared.resolved.variant,
    background: prepared.resolved.background,
    transparent: prepared.transparent,
  })
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, buffer)
  return {
    file,
    bytes: buffer.byteLength,
    width: prepared.resolved.width,
    height: prepared.resolved.height,
    time,
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function log(options: CommonOptions, message: string): void {
  if (!options.quiet) process.stdout.write(`${message}\n`)
}

export function fail(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`\nLinkZag error: ${message}\n`)
  if (error instanceof Error && 'details' in error) {
    const details = (error as { details?: unknown }).details
    if (Array.isArray(details)) {
      for (const detail of details) process.stderr.write(`  - ${String(detail)}\n`)
    }
  }
  process.exitCode = 1
}

export function parseList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

export function ensureEven(width: number, height: number): void {
  if (width % 2 !== 0 || height % 2 !== 0) {
    throw new Error(
      `MP4/H.264 with yuv420p needs even dimensions; got ${width}x${height}. Choose even --width/--height.`,
    )
  }
}
