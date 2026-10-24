import fs from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'

const SCENE = 'content/scenes/agentic-coding.yaml'
const GOLDEN_DIR = path.join(process.cwd(), 'tests', 'goldens')

async function compareGolden(
  name: string,
  actualBuffer: Buffer,
  width: number,
  height: number,
): Promise<void> {
  const expectedBuffer = await fs.readFile(path.join(GOLDEN_DIR, `${name}.png`))
  const expected = PNG.sync.read(expectedBuffer)
  const actual = PNG.sync.read(actualBuffer)
  expect(actual.width).toBe(width)
  expect(actual.height).toBe(height)
  expect(expected.width).toBe(width)
  expect(expected.height).toBe(height)

  const diff = new PNG({ width, height })
  const diffPixels = pixelmatch(expected.data, actual.data, diff.data, width, height, {
    threshold: 0.15,
    includeAA: false,
  })
  const ratio = diffPixels / (width * height)

  if (ratio > 0.01) {
    const outDir = path.join(process.cwd(), 'test-results', 'golden')
    await fs.mkdir(outDir, { recursive: true })
    await fs.writeFile(path.join(outDir, `${name}-actual.png`), actualBuffer)
    await fs.writeFile(path.join(outDir, `${name}-diff.png`), PNG.sync.write(diff))
  }

  expect(
    ratio,
    `${name}: ${diffPixels} of ${width * height} pixels differ (${(ratio * 100).toFixed(3)}%)`,
  ).toBeLessThan(0.01)
}

test.describe('golden frames', () => {
  for (const theme of ['dark', 'light'] as const) {
    test(`agentic-coding renders the ${theme} golden`, async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 })
      await page.goto(`/?scene=${encodeURIComponent(SCENE)}&theme=${theme}&t=6`)
      await expect(page.locator('.lz-scene')).toHaveAttribute('data-linkzag-ready', 'true')
      await page.waitForTimeout(300)
      const buffer = await page.screenshot({
        type: 'png',
        animations: 'disabled',
        caret: 'hide',
      })
      await compareGolden(`agentic-${theme}`, buffer, 1920, 1080)
    })
  }
})
