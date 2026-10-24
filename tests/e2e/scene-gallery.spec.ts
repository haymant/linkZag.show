import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root = process.cwd()

function sceneFiles(dir: string): string[] {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(dir, entry.name)
    if (entry.isDirectory()) return sceneFiles(relative)
    return /\.(ya?ml|json|md)$/i.test(entry.name) ? [relative.split(path.sep).join('/')] : []
  })
}

const files = [...sceneFiles('content/scenes'), ...sceneFiles('content/examples')].sort()

test('every bundled scene renders in both themes without browser errors', async ({ page }) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 1920, height: 1080 })

  let problems: string[] = []
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`)
  })

  expect(files.length).toBeGreaterThanOrEqual(16)
  for (const file of files) {
    for (const theme of ['dark', 'light'] as const) {
      problems = []
      await page.goto(`/?scene=${encodeURIComponent(file)}&theme=${theme}`)
      const stage = page.locator('.lz-scene')
      await expect(stage, `${file} (${theme})`).toHaveAttribute('data-linkzag-ready', 'true')
      await expect(page.locator('.lz-fatal')).toHaveCount(0)
      await expect(stage).toHaveAttribute('data-theme', theme)
      expect(problems, `${file} (${theme}) browser errors`).toEqual([])
    }
  }
})
