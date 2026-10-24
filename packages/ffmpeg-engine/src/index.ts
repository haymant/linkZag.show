import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

export type VideoFormat = 'mp4' | 'webm' | 'mov'

export interface EncodeOptions {
  framesDir: string
  pattern?: string
  fps: number
  width: number
  height: number
  format: VideoFormat
  output: string
  matte?: string
  crf?: number
}

export interface VideoProbe {
  file: string
  bytes: number
  codec: string
  width: number
  height: number
  pixFmt: string
  fps: number
  duration: number
  hasAlpha: boolean
  alphaMode?: string
}

interface RunResult {
  stdout: string
  stderr: string
}

function run(command: string, args: string[]): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on('error', (error) => {
      reject(
        new Error(
          `Could not run ${command}. Install FFmpeg and ensure it is on PATH.\n${error.message}`,
          { cause: error },
        ),
      )
    })
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr })
      else {
        reject(
          new Error(
            `${command} exited with code ${code}.\n${stderr.trim().split('\n').slice(-12).join('\n')}`,
          ),
        )
      }
    })
  })
}

export async function assertFfmpeg(): Promise<void> {
  try {
    await run(process.env.FFMPEG_PATH ?? 'ffmpeg', ['-hide_banner', '-version'])
    await run(process.env.FFPROBE_PATH ?? 'ffprobe', ['-hide_banner', '-version'])
  } catch (error) {
    throw new Error(
      `FFmpeg/ffprobe are required for video output. Install FFmpeg (brew install ffmpeg) and try again.\n${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    )
  }
}

function matteHex(value: string): string {
  const normalized = value.startsWith('#') ? `0x${value.slice(1)}` : value
  if (!/^0x[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(normalized)) {
    throw new Error(`Invalid matte colour "${value}". Use a hex colour such as #00FF00.`)
  }
  return normalized
}

export function videoExtension(format: VideoFormat): string {
  return format === 'mov' ? 'mov' : format
}

export function buildEncodeArgs(options: EncodeOptions): string[] {
  const pattern = path.join(options.framesDir, options.pattern ?? 'frame-%05d.png')
  const commonInput = ['-framerate', String(options.fps), '-start_number', '1', '-i', pattern]
  const args = ['-y', '-hide_banner', '-loglevel', 'error']

  if (options.format === 'mp4') {
    if (options.matte) {
      args.push(
        '-f',
        'lavfi',
        '-i',
        `color=c=${matteHex(options.matte)}:s=${options.width}x${options.height}:r=${options.fps}`,
        ...commonInput,
        '-filter_complex',
        '[0:v][1:v]overlay=shortest=1,format=yuv420p',
        '-shortest',
      )
    } else {
      args.push(...commonInput, '-pix_fmt', 'yuv420p')
    }
    args.push(
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      String(options.crf ?? 18),
      '-movflags',
      '+faststart',
      '-an',
      options.output,
    )
    return args
  }

  args.push(...commonInput)
  if (options.format === 'webm') {
    args.push(
      '-c:v',
      'libvpx-vp9',
      '-pix_fmt',
      'yuva420p',
      '-b:v',
      '0',
      '-crf',
      String(options.crf ?? 28),
      '-row-mt',
      '1',
      '-auto-alt-ref',
      '0',
      '-an',
      options.output,
    )
    return args
  }

  args.push(
    '-c:v',
    'prores_ks',
    '-profile:v',
    '4444',
    '-pix_fmt',
    'yuva444p10le',
    '-qscale:v',
    String(options.crf ?? 10),
    '-vendor',
    'apl0',
    '-an',
    options.output,
  )
  return args
}

export async function encodeFrames(options: EncodeOptions): Promise<string> {
  if (options.matte && options.format !== 'mp4') {
    throw new Error(`--matte only applies to MP4 output; ${options.format} carries alpha directly.`)
  }
  const stat = await fs.stat(options.framesDir).catch(() => null)
  if (!stat?.isDirectory()) {
    throw new Error(`Frame directory not found: ${options.framesDir}`)
  }
  await fs.mkdir(path.dirname(path.resolve(options.output)), { recursive: true })
  await run(process.env.FFMPEG_PATH ?? 'ffmpeg', buildEncodeArgs(options))
  return options.output
}

export async function probeVideo(file: string): Promise<VideoProbe> {
  const { stdout } = await run(process.env.FFPROBE_PATH ?? 'ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=codec_name,width,height,pix_fmt,r_frame_rate,avg_frame_rate,duration:stream_tags=alpha_mode:format=duration,size',
    '-of',
    'json',
    file,
  ])

  const parsed = JSON.parse(stdout) as {
    streams?: Array<Record<string, unknown>>
    format?: Record<string, unknown>
  }
  const stream = parsed.streams?.[0]
  if (!stream) throw new Error(`No video stream found in ${file}`)

  const ratio = (value: unknown): number => {
    if (typeof value !== 'string') return 0
    const [numerator, denominator] = value.split('/').map(Number)
    if (!denominator) return numerator || 0
    return numerator / denominator
  }
  const durationValue = Number(parsed.format?.duration ?? stream.duration ?? 0)
  const bytes = Number(parsed.format?.size ?? 0)
  const pixFmt = String(stream.pix_fmt ?? '')
  const tags = stream.tags as Record<string, unknown> | undefined
  const alphaMode = tags?.alpha_mode === undefined ? undefined : String(tags.alpha_mode)

  return {
    file,
    bytes: Number.isFinite(bytes) ? bytes : (await fs.stat(file)).size,
    codec: String(stream.codec_name ?? 'unknown'),
    width: Number(stream.width ?? 0),
    height: Number(stream.height ?? 0),
    pixFmt,
    fps: ratio(stream.avg_frame_rate) || ratio(stream.r_frame_rate),
    duration: Number.isFinite(durationValue) ? durationValue : 0,
    hasAlpha: alphaMode === '1' || /a/.test(pixFmt),
    ...(alphaMode ? { alphaMode } : {}),
  }
}
