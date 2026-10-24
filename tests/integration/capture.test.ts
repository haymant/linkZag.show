import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PNG } from 'pngjs'
import { loadScene } from '@linkzag/scene-loader'
import {
  createCaptureSession,
  startCaptureServer,
  type CaptureServer,
  type CaptureSession,
} from '@linkzag/capture-engine'
import { assertFfmpeg, encodeFrames, probeVideo } from '@linkzag/ffmpeg-engine'

const projectRoot = process.cwd()
let server: CaptureServer
let session: CaptureSession
let tempRoot: string

beforeAll(async () => {
  await assertFfmpeg()
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'linkzag-integration-'))
  server = await startCaptureServer({ projectRoot })
  session = await createCaptureSession({ baseUrl: server.baseUrl })
}, 120_000)

afterAll(async () => {
  await session?.close()
  await server?.close()
  if (tempRoot) await fs.rm(tempRoot, { recursive: true, force: true })
})

function cornerAlpha(png: PNG): number {
  return png.data[3] ?? 255
}

describe('capture integration', () => {
  it('captures a still and reports the requested dimensions', async () => {
    const loaded = loadScene('title-card', { projectRoot })
    const buffer = await session.captureStill(
      {
        scene: loaded.relativePath,
        width: 960,
        height: 540,
        duration: loaded.scene.duration,
      },
      { time: 2 },
    )
    const png = PNG.sync.read(buffer)
    expect(png.width).toBe(960)
    expect(png.height).toBe(540)
    expect(cornerAlpha(png)).toBe(255)
  })

  it('captures a transparent overlay with a clear background', async () => {
    const loaded = loadScene('content/scenes/demo/04-overlay.yaml', { projectRoot })
    const buffer = await session.captureStill(
      {
        scene: loaded.relativePath,
        width: 800,
        height: 450,
        duration: loaded.scene.duration,
      },
      { time: loaded.scene.duration, transparent: true },
    )
    const png = PNG.sync.read(buffer)
    expect(cornerAlpha(png)).toBe(0)
  })

  it('re-captures byte-identical PNGs for the same scene and time', async () => {
    const loaded = loadScene('title-card', { projectRoot })
    const target = {
      scene: loaded.relativePath,
      width: 640,
      height: 360,
      duration: loaded.scene.duration,
    }
    const first = await session.captureStill(target, { time: 1.25 })
    const second = await session.captureStill(target, { time: 1.25 })
    expect(second.equals(first)).toBe(true)
  })

  it('captures frame sequences and encodes MP4, WebM alpha, and ProRes', async () => {
    const loaded = loadScene('title-card', { projectRoot })
    const framesDir = path.join(tempRoot, 'frames')
    const result = await session.captureFrames(
      {
        scene: loaded.relativePath,
        width: 320,
        height: 180,
        duration: 1,
      },
      { framesDir, fps: 10, from: 0, to: 0.3 },
    )
    expect(result.frames).toHaveLength(3)
    expect(result.frames[0]!.index).toBe(1)
    expect(result.frames[0]!.time).toBe(0)

    const mp4 = path.join(tempRoot, 'out.mp4')
    await encodeFrames({
      framesDir,
      fps: 10,
      width: 320,
      height: 180,
      format: 'mp4',
      output: mp4,
      matte: '#00FF00',
      crf: 28,
    })
    const mp4Probe = await probeVideo(mp4)
    expect(mp4Probe.codec).toBe('h264')
    expect(mp4Probe.pixFmt).toBe('yuv420p')
    expect(mp4Probe.hasAlpha).toBe(false)
    expect(mp4Probe.duration).toBeGreaterThan(0.15)

    const webm = path.join(tempRoot, 'out.webm')
    await encodeFrames({
      framesDir,
      fps: 10,
      width: 320,
      height: 180,
      format: 'webm',
      output: webm,
      crf: 40,
    })
    const webmProbe = await probeVideo(webm)
    expect(webmProbe.codec).toBe('vp9')
    expect(webmProbe.hasAlpha).toBe(true)
    expect(webmProbe.alphaMode).toBe('1')

    const mov = path.join(tempRoot, 'out.mov')
    await encodeFrames({
      framesDir,
      fps: 10,
      width: 320,
      height: 180,
      format: 'mov',
      output: mov,
      crf: 12,
    })
    const movProbe = await probeVideo(mov)
    expect(movProbe.codec).toBe('prores')
    expect(movProbe.hasAlpha).toBe(true)
  }, 120_000)
})
