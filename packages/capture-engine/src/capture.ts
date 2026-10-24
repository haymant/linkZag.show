import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium, type Browser, type Page } from 'playwright'
import { PNG } from 'pngjs'

export interface SceneTarget {
  /** Scene path relative to the project root, as accepted by the renderer API. */
  scene: string
  width: number
  height: number
  duration: number
}

export interface StillOptions {
  time?: number
  theme?: string
  variant?: string
  background?: string
  transparent?: boolean
  timeoutMs?: number
}

export interface FrameOptions extends StillOptions {
  framesDir: string
  fps: number
  from?: number
  to?: number
  onProgress?: (frame: number, total: number, time: number) => void
}

export interface CapturedFrame {
  index: number
  time: number
  file: string
  bytes: number
}

export interface FrameCaptureResult {
  frames: CapturedFrame[]
  fps: number
  from: number
  to: number
  directory: string
}

export class SceneCaptureError extends Error {
  readonly details?: string[]

  constructor(message: string, details?: string[]) {
    super(message)
    this.name = 'SceneCaptureError'
    this.details = details
  }
}

/**
 * Chromium's PNG encoder is not byte-stable between runs even when every pixel
 * matches. Re-encoding through pngjs gives the deterministic artefact that the
 * CLI contract promises while preserving the exact captured RGBA pixels.
 */
function canonicalPng(buffer: Buffer): Buffer {
  const image = PNG.sync.read(buffer)
  return PNG.sync.write(image, {
    colorType: 6,
    inputColorType: 6,
    inputHasAlpha: true,
    deflateLevel: 9,
    deflateStrategy: 3,
  })
}

export interface CaptureSession {
  baseUrl: string
  captureStill: (target: SceneTarget, options?: StillOptions) => Promise<Buffer>
  captureFrames: (target: SceneTarget, options: FrameOptions) => Promise<FrameCaptureResult>
  close: () => Promise<void>
}

function sceneUrl(baseUrl: string, target: SceneTarget, options: StillOptions, time?: number): string {
  const url = new URL(baseUrl)
  url.searchParams.set('scene', target.scene)
  url.searchParams.set('w', String(target.width))
  url.searchParams.set('h', String(target.height))
  if (time !== undefined) url.searchParams.set('t', String(time))
  if (options.theme) url.searchParams.set('theme', options.theme)
  if (options.variant) url.searchParams.set('variant', options.variant)
  if (options.transparent) {
    url.searchParams.set('transparent', '1')
  } else if (options.background) {
    url.searchParams.set('background', options.background)
  }
  return url.toString()
}

async function waitForScene(page: Page, timeoutMs: number): Promise<void> {
  try {
    await page.waitForFunction(
      () => {
        const scene = document.querySelector('.lz-scene')
        if (scene?.getAttribute('data-linkzag-ready') === 'true') return true
        return Boolean(
          document.documentElement.dataset.linkzagError ||
            scene?.getAttribute('data-linkzag-error'),
        )
      },
      null,
      { timeout: timeoutMs },
    )
  } catch (error) {
    throw new SceneCaptureError(
      `Timed out waiting for the scene after ${timeoutMs}ms. The renderer did not report readiness.`,
      [error instanceof Error ? error.message : String(error)],
    )
  }

  const error = await page.evaluate(() => {
    const scene = document.querySelector('.lz-scene')
    return (
      document.documentElement.dataset.linkzagError ||
      scene?.getAttribute('data-linkzag-error') ||
      null
    )
  })
  if (error) {
    const details = await page.evaluate(() =>
      [...document.querySelectorAll('.lz-fatal__details li')].map(
        (node) => node.textContent?.trim() ?? '',
      ),
    )
    throw new SceneCaptureError(`Scene failed to render: ${error}`, details.filter(Boolean))
  }

  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )
}

async function openScene(
  browser: Browser,
  baseUrl: string,
  target: SceneTarget,
  options: StillOptions,
  time: number | undefined,
): Promise<Page> {
  const theme = options.theme === 'light' ? 'light' : 'dark'
  const page = await browser.newPage({
    viewport: { width: target.width, height: target.height },
    deviceScaleFactor: 1,
    colorScheme: theme,
  })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })

  const url = sceneUrl(baseUrl, target, options, time)
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' })
  if (response && !response.ok()) {
    await page.close()
    throw new SceneCaptureError(`Renderer returned HTTP ${response.status()} for ${url}`)
  }

  try {
    await waitForScene(page, options.timeoutMs ?? 60_000)
  } catch (error) {
    await page.close()
    if (error instanceof SceneCaptureError && errors.length) {
      throw new SceneCaptureError(error.message, [...(error.details ?? []), ...errors])
    }
    throw error
  }
  if (errors.length) {
    await page.close()
    throw new SceneCaptureError('The renderer reported console or page errors.', errors)
  }
  return page
}

export async function createCaptureSession(options: { baseUrl: string; headless?: boolean }): Promise<CaptureSession> {
  const browser = await chromium.launch({
    headless: options.headless ?? true,
    args: [
      '--force-color-profile=srgb',
      '--disable-gpu',
      '--disable-gpu-compositing',
      '--disable-accelerated-2d-canvas',
      '--disable-lcd-text',
      '--font-render-hinting=none',
    ],
  })
  const { baseUrl } = options

  return {
    baseUrl,
    async captureStill(target, stillOptions = {}) {
      const page = await openScene(browser, baseUrl, target, stillOptions, stillOptions.time)
      try {
        return canonicalPng(
          await page.screenshot({
            type: 'png',
            omitBackground: stillOptions.transparent ?? false,
            animations: 'disabled',
            caret: 'hide',
          }),
        )
      } finally {
        await page.close()
      }
    },

    async captureFrames(target, frameOptions) {
      const from = Math.max(0, frameOptions.from ?? 0)
      const to = Math.min(target.duration, frameOptions.to ?? target.duration)
      if (!(to > from)) {
        throw new SceneCaptureError(`Nothing to capture: from=${from}s, to=${to}s.`)
      }
      if (!(frameOptions.fps > 0)) {
        throw new SceneCaptureError(`Invalid fps: ${frameOptions.fps}`)
      }
      const total = Math.max(1, Math.round((to - from) * frameOptions.fps))
      await fs.mkdir(frameOptions.framesDir, { recursive: true })

      const page = await openScene(browser, baseUrl, target, frameOptions, from)
      const frames: CapturedFrame[] = []
      try {
        for (let index = 0; index < total; index += 1) {
          const time = from + index / frameOptions.fps
          await page.evaluate(async (value) => {
            const api = (
              window as unknown as {
                __LINKZAG__?: { setTime: (next: number) => Promise<void> }
              }
            ).__LINKZAG__
            if (!api) throw new Error('window.__LINKZAG__ is unavailable')
            await api.setTime(value)
          }, time)
          if (index > 0) {
            await page.evaluate(
              () =>
                new Promise<void>((resolve) => {
                  requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
                }),
            )
          }
          const buffer = canonicalPng(
            await page.screenshot({
              type: 'png',
              omitBackground: frameOptions.transparent ?? false,
              animations: 'disabled',
              caret: 'hide',
            }),
          )
          const file = path.join(
            frameOptions.framesDir,
            `frame-${String(index + 1).padStart(5, '0')}.png`,
          )
          await fs.writeFile(file, buffer)
          frames.push({ index: index + 1, time, file, bytes: buffer.byteLength })
          frameOptions.onProgress?.(index + 1, total, time)
        }
      } finally {
        await page.close()
      }

      return {
        frames,
        fps: frameOptions.fps,
        from,
        to,
        directory: frameOptions.framesDir,
      }
    },

    async close() {
      await browser.close()
    },
  }
}
