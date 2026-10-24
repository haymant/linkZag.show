#!/usr/bin/env node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Command, InvalidArgumentError } from 'commander'
import {
  assertFfmpeg,
  encodeFrames,
  probeVideo,
  videoExtension,
  type EncodeOptions,
  type VideoFormat,
  type VideoProbe,
} from '@linkzag/ffmpeg-engine'
import {
  ensureEven,
  fail,
  formatBytes,
  log,
  parseList,
  prepareScene,
  resolveOutput,
  withCaptureSession,
  writeStill,
  type CommonOptions,
  type PreparedScene,
} from './utils.ts'

interface CommandOptions extends CommonOptions {
  time?: number
  fps?: number
  from?: number
  to?: number
  out?: string
  format?: string
  matte?: string
  crf?: number
  frames?: string
  keepFrames?: boolean
  stillTime?: number
}

const VIDEO_FORMATS = ['mp4', 'webm', 'mov'] as const

function positiveNumber(value: string): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new InvalidArgumentError('Expected a number greater than zero.')
  }
  return parsed
}

function nonNegativeNumber(value: string): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new InvalidArgumentError('Expected a number greater than or equal to zero.')
  }
  return parsed
}

function themeValue(value: string): 'light' | 'dark' {
  if (value !== 'light' && value !== 'dark') {
    throw new InvalidArgumentError('Expected "light" or "dark".')
  }
  return value
}

function variantValue(value: string): 'auto' | 'slide' | 'item' {
  if (value !== 'auto' && value !== 'slide' && value !== 'item') {
    throw new InvalidArgumentError('Expected "auto", "slide", or "item".')
  }
  return value
}

function addCommonOptions(command: Command): Command {
  return command
    .requiredOption('-s, --scene <path>', 'scene path or scene id')
    .option('--theme <theme>', 'light or dark', themeValue)
    .option('--variant <variant>', 'auto, slide, or item', variantValue)
    .option('--background <color>', 'theme, transparent, or a hex colour')
    .option('--transparent', 'force a transparent background')
    .option('--width <px>', 'override scene width', positiveNumber)
    .option('--height <px>', 'override scene height', positiveNumber)
    .option('--project-root <dir>', 'project root (defaults to the nearest linkzag-show root)')
    .option('--base-url <url>', 'reuse an already-running renderer')
    .option('--timeout <ms>', 'readiness timeout in milliseconds', positiveNumber, 60_000)
    .option('--quiet', 'suppress progress output')
}

function common(options: CommandOptions): CommonOptions {
  return {
    scene: options.scene,
    theme: options.theme,
    variant: options.variant,
    background: options.background,
    transparent: options.transparent,
    width: options.width,
    height: options.height,
    projectRoot: options.projectRoot,
    baseUrl: options.baseUrl,
    timeout: options.timeout,
    quiet: options.quiet,
  }
}

function relativeTo(projectRoot: string, file: string): string {
  return path.relative(projectRoot, file).split(path.sep).join('/')
}

function frameProgress(options: CommandOptions, label: string) {
  let bucket = -1
  return (frame: number, total: number) => {
    if (options.quiet) return
    const next = Math.min(10, Math.floor((frame / total) * 10))
    if (next !== bucket) {
      bucket = next
      process.stdout.write(`  ${label} ${String(frame).padStart(String(total).length)}/${total}\n`)
    }
  }
}

function ensureVideoCompatibility(
  prepared: PreparedScene,
  formats: VideoFormat[],
  matte: string | undefined,
): void {
  if (formats.includes('mp4')) {
    ensureEven(prepared.resolved.width, prepared.resolved.height)
  }
  if (prepared.transparent && formats.includes('mp4') && !matte) {
    throw new Error(
      [
        'MP4/H.264 cannot carry an alpha channel, but this scene is transparent.',
        'Choose one of:',
        '  - add --matte "#00FF00" and chroma-key the result, or',
        '  - use --format webm for VP9 alpha, or',
        '  - use --format mov for ProRes 4444 alpha, or',
        '  - make the background opaque with --background theme.',
      ].join('\n'),
    )
  }
}

async function captureFramesFor(
  prepared: PreparedScene,
  options: CommandOptions,
  framesDir: string,
  fps: number,
  from: number,
  to: number,
) {
  return withCaptureSession(prepared, common(options), async (session) => {
    log(options, `Capturing ${Math.round((to - from) * fps)} frames at ${fps} fps...`)
    return session.captureFrames(prepared.target, {
      framesDir,
      fps,
      from,
      to,
      theme: prepared.resolved.theme,
      variant: prepared.resolved.variant,
      background: prepared.resolved.background,
      transparent: prepared.transparent,
      timeoutMs: options.timeout,
      onProgress: frameProgress(options, 'frame'),
    })
  })
}

async function writeFrameManifest(
  prepared: PreparedScene,
  options: CommandOptions,
  result: Awaited<ReturnType<typeof captureFramesFor>>,
): Promise<string> {
  const manifest = {
    version: 1,
    kind: 'linkzag-frame-sequence',
    scene: {
      id: prepared.resolved.id,
      path: prepared.loadedPath,
      checksum: prepared.checksum,
      width: prepared.resolved.width,
      height: prepared.resolved.height,
      duration: prepared.resolved.duration,
      theme: prepared.resolved.theme,
      variant: prepared.resolved.variant,
      background: prepared.resolved.background,
    },
    fps: result.fps,
    from: result.from,
    to: result.to,
    count: result.frames.length,
    pattern: 'frame-%05d.png',
    frames: result.frames.map((frame) => ({
      index: frame.index,
      time: Number(frame.time.toFixed(6)),
      file: path.basename(frame.file),
      bytes: frame.bytes,
    })),
  }
  const file = path.join(result.directory, 'manifest.json')
  await fs.writeFile(file, `${JSON.stringify(manifest, null, 2)}\n`)
  return file
}

async function encodeAll(
  prepared: PreparedScene,
  options: CommandOptions,
  framesDir: string,
  formats: VideoFormat[],
  outputDir: string,
  matte: string | undefined,
): Promise<VideoProbe[]> {
  await assertFfmpeg()
  await fs.mkdir(outputDir, { recursive: true })
  const probes: VideoProbe[] = []
  for (const format of formats) {
    const file = path.join(outputDir, `${prepared.slug}.${videoExtension(format)}`)
    log(options, `Encoding ${format.toUpperCase()}...`)
    const encodeOptions: EncodeOptions = {
      framesDir,
      fps: options.fps ?? 30,
      width: prepared.resolved.width,
      height: prepared.resolved.height,
      format,
      output: file,
      matte,
      crf: options.crf,
    }
    await encodeFrames(encodeOptions)
    const probe = await probeVideo(file)
    probes.push(probe)
    log(
      options,
      `  ${relativeTo(prepared.projectRoot, file)}  ${probe.width}x${probe.height}  ${probe.codec}/${probe.pixFmt}  ${probe.duration.toFixed(2)}s  ${formatBytes(probe.bytes)}`,
    )
  }
  return probes
}

async function main(): Promise<void> {
  const program = new Command()
    .name('linkzag')
    .description('Deterministic scene renderer and segment factory for commentary videos.')
    .version('0.1.0')
    .showHelpAfterError()

  addCommonOptions(
    program
      .command('render')
      .description('Capture one static PNG at a chosen time (default: final frame).')
      .option('--time <seconds>', 'scene time to capture', nonNegativeNumber)
      .option('--out <file>', 'output PNG path'),
  ).action(async (options: CommandOptions) => {
    const prepared = prepareScene(common(options))
    const time = Math.min(options.time ?? prepared.resolved.duration, prepared.resolved.duration)
    const file = resolveOutput(options.out, prepared.defaultStill)
    log(
      options,
      `Rendering ${prepared.resolved.id} (${prepared.resolved.width}x${prepared.resolved.height}, ${prepared.resolved.theme}, ${prepared.resolved.variant})...`,
    )
    const still = await withCaptureSession(prepared, common(options), (session) =>
      writeStill(prepared, session, file, time),
    )
    log(options, `${relativeTo(prepared.projectRoot, still.file)}  ${still.width}x${still.height}  ${formatBytes(still.bytes)}`)
  })

  addCommonOptions(
    program
      .command('capture')
      .description('Capture a deterministic PNG frame sequence and manifest.')
      .option('--fps <fps>', 'frames per second', positiveNumber, 30)
      .option('--from <seconds>', 'first scene time', nonNegativeNumber)
      .option('--to <seconds>', 'end scene time', nonNegativeNumber)
      .option('--out <dir>', 'frame output directory'),
  ).action(async (options: CommandOptions) => {
    const prepared = prepareScene(common(options))
    const fps = options.fps ?? 30
    const from = options.from ?? 0
    const to = Math.min(options.to ?? prepared.resolved.duration, prepared.resolved.duration)
    if (to <= from) throw new Error(`--to (${to}) must be greater than --from (${from}).`)
    const framesDir = resolveOutput(
      options.out,
      path.join(prepared.outputDir, 'frames'),
    )
    const result = await captureFramesFor(prepared, options, framesDir, fps, from, to)
    const manifest = await writeFrameManifest(prepared, options, result)
    log(options, `${relativeTo(prepared.projectRoot, framesDir)}  ${result.frames.length} frames`)
    log(options, `${relativeTo(prepared.projectRoot, manifest)}`)
  })

  addCommonOptions(
    program
      .command('video')
      .description('Capture frames and encode MP4, transparent WebM, or ProRes 4444.')
      .option('--format <formats>', 'mp4, webm, mov (comma separated)', 'mp4')
      .option('--fps <fps>', 'frames per second', positiveNumber, 30)
      .option('--from <seconds>', 'first scene time', nonNegativeNumber)
      .option('--to <seconds>', 'end scene time', nonNegativeNumber)
      .option('--matte <color>', 'chroma-key colour for transparent MP4 (for example #00FF00)')
      .option('--crf <value>', 'quality value (lower is better)', positiveNumber)
      .option('--frames <dir>', 'encode an existing frame directory instead of capturing')
      .option('--keep-frames', 'keep captured frames when the command finishes')
      .option('--out <dir>', 'video output directory'),
  ).action(async (options: CommandOptions) => {
    const prepared = prepareScene(common(options))
    const formats = parseList(options.format ?? 'mp4') as VideoFormat[]
    for (const format of formats) {
      if (!VIDEO_FORMATS.includes(format)) {
        throw new Error(`Unknown format "${format}". Use mp4, webm, or mov.`)
      }
    }
    const matte = options.matte
    ensureVideoCompatibility(prepared, formats, matte)
    if (formats.length) await assertFfmpeg()

    const fps = options.fps ?? 30
    const from = options.from ?? 0
    const to = Math.min(options.to ?? prepared.resolved.duration, prepared.resolved.duration)
    if (to <= from) throw new Error(`--to (${to}) must be greater than --from (${from}).`)

    const outputDir = resolveOutput(options.out, prepared.outputDir)
    const temp = !options.frames
    const framesDir = options.frames
      ? path.resolve(process.cwd(), options.frames)
      : options.keepFrames
        ? path.join(outputDir, 'frames')
        : await fs.mkdtemp(path.join(os.tmpdir(), `linkzag-${prepared.slug}-`))

    try {
      if (!options.frames) {
        await captureFramesFor(prepared, options, framesDir, fps, from, to)
      }
      await encodeAll(prepared, options, framesDir, formats, outputDir, matte)
    } finally {
      if (temp) await fs.rm(framesDir, { recursive: true, force: true })
    }
  })

  addCommonOptions(
    program
      .command('segment')
      .description('Produce a reusable segment package: still, video(s), and segment.json.')
      .option('--format <formats>', 'png, mp4, webm, mov (comma separated)', 'png,mp4')
      .option('--fps <fps>', 'frames per second', positiveNumber, 30)
      .option('--matte <color>', 'chroma-key colour for transparent MP4 (for example #00FF00)')
      .option('--crf <value>', 'quality value (lower is better)', positiveNumber)
      .option('--still-time <seconds>', 'time for the still (default: final frame)', nonNegativeNumber)
      .option('--keep-frames', 'keep captured frames in <out>/frames')
      .option('--out <dir>', 'segment output directory'),
  ).action(async (options: CommandOptions) => {
    const prepared = prepareScene(common(options))
    const formats = parseList(options.format ?? 'png,mp4')
    for (const format of formats) {
      if (format !== 'png' && !VIDEO_FORMATS.includes(format as VideoFormat)) {
        throw new Error(`Unknown format "${format}". Use png, mp4, webm, or mov.`)
      }
    }
    const videos = formats.filter((format): format is VideoFormat =>
      (VIDEO_FORMATS as readonly string[]).includes(format),
    )
    const wantsStill = formats.includes('png')
    const matte = options.matte
    ensureVideoCompatibility(prepared, videos, matte)
    if (videos.length) await assertFfmpeg()

    const outputDir = resolveOutput(options.out, prepared.outputDir)
    await fs.mkdir(outputDir, { recursive: true })
    const fps = options.fps ?? 30

    const files: Array<Record<string, unknown>> = []
    if (wantsStill) {
      const stillFile = path.join(outputDir, `${prepared.slug}-still.png`)
      log(options, `Capturing still...`)
      const still = await withCaptureSession(prepared, common(options), (session) =>
        writeStill(
          prepared,
          session,
          stillFile,
          Math.min(options.stillTime ?? prepared.resolved.duration, prepared.resolved.duration),
        ),
      )
      files.push({
        format: 'png',
        path: relativeTo(prepared.projectRoot, still.file),
        bytes: still.bytes,
        width: still.width,
        height: still.height,
        time: still.time,
        transparent: prepared.transparent,
      })
      log(options, `  ${relativeTo(prepared.projectRoot, still.file)}  ${formatBytes(still.bytes)}`)
    }

    let probes: VideoProbe[] = []
    const framesDir = options.keepFrames
      ? path.join(outputDir, 'frames')
      : await fs.mkdtemp(path.join(os.tmpdir(), `linkzag-${prepared.slug}-`))
    try {
      if (videos.length) {
        await captureFramesFor(prepared, options, framesDir, fps, 0, prepared.resolved.duration)
        probes = await encodeAll(prepared, options, framesDir, videos, outputDir, matte)
      }
    } finally {
      if (!options.keepFrames) await fs.rm(framesDir, { recursive: true, force: true })
    }

    for (const probe of probes) {
      files.push({
        format: path.extname(probe.file).slice(1),
        path: relativeTo(prepared.projectRoot, probe.file),
        bytes: probe.bytes,
        width: probe.width,
        height: probe.height,
        duration: probe.duration,
        fps: probe.fps,
        codec: probe.codec,
        pixelFormat: probe.pixFmt,
        transparent: probe.hasAlpha,
      })
    }

    const manifest = {
      version: 1,
      kind: 'linkzag-segment',
      generatedAt: new Date().toISOString(),
      scene: {
        id: prepared.resolved.id,
        path: prepared.loadedPath,
        checksum: prepared.checksum,
        width: prepared.resolved.width,
        height: prepared.resolved.height,
        duration: prepared.resolved.duration,
        theme: prepared.resolved.theme,
        variant: prepared.resolved.variant,
        background: prepared.resolved.background,
      },
      options: {
        fps,
        transparent: prepared.transparent,
        matte: matte ?? null,
        formats,
      },
      files,
    }
    const manifestFile = path.join(outputDir, 'segment.json')
    await fs.writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)
    log(options, `${relativeTo(prepared.projectRoot, manifestFile)}`)
  })

  await program.parseAsync(process.argv)
}

main().catch(fail)
