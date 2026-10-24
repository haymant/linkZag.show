import { expect, test } from '@playwright/test'

const STUDIO = 'http://127.0.0.1:4318'

test.describe('studio', () => {
  test('loads the scene list and previews the final frame', async ({ page }) => {
    await page.goto(STUDIO)
    await expect(page.locator('.studio__scene')).toHaveCount(14)
    const stage = page.locator('.lz-scene')
    await expect(stage).toHaveAttribute('data-scene-id', 'agentic-coding')
    await expect(stage).toHaveAttribute('data-linkzag-ready', 'true')
    await expect(page.locator('.studio__time strong')).toHaveText('10.00s')
    await expect(page.locator('.studio__ready')).toHaveText('ready')
  })

  test('switches scenes and keeps the preview in sync', async ({ page }) => {
    await page.goto(STUDIO)
    await expect(page.locator('.lz-scene')).toHaveAttribute('data-scene-id', 'agentic-coding')
    await page.locator('.studio__scene', { hasText: 'demo-hook' }).click()
    await expect(page.locator('.lz-scene')).toHaveAttribute('data-scene-id', 'demo-hook')
    await expect(page.locator('.lz-scene')).toHaveAttribute('data-linkzag-ready', 'true')
    await expect(page.locator('.studio__time strong')).toHaveText('6.00s')
  })

  test('applies theme and composition overrides', async ({ page }) => {
    await page.goto(STUDIO)
    const stage = page.locator('.lz-scene')
    await expect(stage).toHaveAttribute('data-linkzag-ready', 'true')

    await page.getByLabel('Theme').selectOption('light')
    await expect(stage).toHaveAttribute('data-theme', 'light')

    await page.getByLabel('Composition').selectOption('item')
    await expect(stage).toHaveAttribute('data-variant', 'item')

    await page.getByLabel('Transparent background').check()
    await expect(stage).toHaveAttribute('data-background', 'transparent')
    await expect(page.locator('.studio__canvas')).toHaveClass(/is-transparent/)
  })

  test('scrubs, plays, and pauses on the timeline', async ({ page }) => {
    await page.goto(STUDIO)
    const stage = page.locator('.lz-scene')
    await expect(stage).toHaveAttribute('data-linkzag-ready', 'true')

    const slider = page.getByLabel('Scene time')
    await slider.evaluate((element) => {
      const input = element as HTMLInputElement
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(input, '2.5')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await expect(page.locator('.studio__time strong')).toHaveText('2.50s')

    await page.locator('.studio__play').click()
    await expect(page.locator('.studio__play')).toHaveText('Pause')
    await expect
      .poll(async () => Number((await page.locator('.studio__time strong').textContent())?.replace('s', '')))
      .toBeGreaterThan(2.5)
    await page.locator('.studio__play').click()
    await expect(page.locator('.studio__play')).toHaveText('Play')
  })

  test('links to the renderer at the current time and overrides', async ({ page }) => {
    await page.goto(STUDIO)
    await expect(page.locator('.lz-scene')).toHaveAttribute('data-linkzag-ready', 'true')
    const href = await page.locator('.studio__link').getAttribute('href')
    expect(href).toContain('scene=content%2Fscenes%2Fagentic-coding.yaml')
    expect(href).toContain('theme=dark')
    expect(href).toContain('variant=slide')
    expect(href).toContain('t=10.000')
  })
})
