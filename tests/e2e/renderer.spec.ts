import fs from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const scene = 'content/scenes/demo/02-evidence.yaml'
const probeFile = path.join(process.cwd(), 'content', 'scenes', '.watch-probe.yaml')

test.describe('renderer URL API', () => {
  test('renders a scene at a requested time with overrides', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto(
      `/?scene=${encodeURIComponent(scene)}&t=2.5&theme=light&variant=slide&w=1280&h=720`,
    )
    const stage = page.locator('.lz-scene')
    await expect(stage).toHaveAttribute('data-linkzag-ready', 'true')
    await expect(stage).toHaveAttribute('data-theme', 'light')
    await expect(stage).toHaveAttribute('data-variant', 'slide')
    await expect(stage).toHaveAttribute('data-scene-id', 'demo-evidence')
    await expect(stage).toHaveCSS('width', '1280px')
    await expect(stage).toHaveCSS('height', '720px')
    await expect(page.locator('.lz-title')).toHaveText('Verified, not vibes')

    const state = await page.evaluate(() => ({
      time: window.__LINKZAG__?.time,
      duration: window.__LINKZAG__?.duration,
      sceneId: window.__LINKZAG__?.sceneId,
      ready: window.__LINKZAG__?.ready,
    }))
    expect(state.time).toBe(2.5)
    expect(state.duration).toBe(8)
    expect(state.sceneId).toBe('demo-evidence')
    expect(state.ready).toBe(true)
  })

  test('seeks deterministically through the renderer API', async ({ page }) => {
    await page.goto(`/?scene=${encodeURIComponent(scene)}&t=0&w=960&h=540`)
    await expect(page.locator('.lz-scene')).toHaveAttribute('data-linkzag-ready', 'true')
    const result = await page.evaluate(async () => {
      await window.__LINKZAG__?.setTime(4.25)
      const first = document.querySelector('.lz-scene')?.outerHTML
      await window.__LINKZAG__?.setTime(1)
      await window.__LINKZAG__?.setTime(4.25)
      const second = document.querySelector('.lz-scene')?.outerHTML
      return {
        time: window.__LINKZAG__?.getTime(),
        same: first === second,
        hasChart: Boolean(document.querySelector('.lz-echart svg')),
      }
    })
    expect(result.time).toBe(4.25)
    expect(result.same).toBe(true)
    expect(result.hasChart).toBe(true)
  })

  test('defaults an omitted t to the final frame', async ({ page }) => {
    await page.goto(`/?scene=${encodeURIComponent(scene)}&w=960&h=540`)
    await expect(page.locator('.lz-scene')).toHaveAttribute('data-linkzag-ready', 'true')
    await expect.poll(() => page.evaluate(() => window.__LINKZAG__?.time)).toBe(8)
  })

  test('reports a missing scene parameter instead of rendering a blank page', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.lz-fatal')).toBeVisible()
    await expect(page.locator('.lz-fatal__message')).toContainText('Missing ?scene= parameter')
    await expect(page.locator('.lz-fatal h1')).toContainText('Scene could not be rendered')
  })

  test('reports an unknown scene with an actionable message', async ({ page }) => {
    await page.goto('/?scene=content%2Fscenes%2Fmissing.yaml')
    await expect(page.locator('.lz-fatal')).toBeVisible()
    await expect(page.locator('.lz-fatal__message')).toContainText('Scene not found')
  })

  test('reloads the renderer when a content file changes', async ({ page }) => {
    await page.goto(`/?scene=${encodeURIComponent(scene)}&w=960&h=540`)
    await expect(page.locator('.lz-scene')).toHaveAttribute('data-linkzag-ready', 'true')
    await page.evaluate(() => {
      ;(window as Window & { __linkzagWatchProbe?: boolean }).__linkzagWatchProbe = true
    })

    const reloaded = page.waitForFunction(
      () => !(window as Window & { __linkzagWatchProbe?: boolean }).__linkzagWatchProbe,
      null,
      { timeout: 20_000 },
    )
    try {
      await fs.writeFile(
        probeFile,
        'id: watch-probe\nitems:\n  - type: markdown\n    content: watch probe\n',
      )
      await reloaded
    } finally {
      await fs.rm(probeFile, { force: true })
    }
  })
})
