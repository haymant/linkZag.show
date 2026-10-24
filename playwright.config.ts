import { defineConfig, devices } from '@playwright/test'

const PORT = 4317
const STUDIO_PORT = 4318

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    launchOptions: {
      args: [
        '--force-color-profile=srgb',
        '--disable-gpu',
        '--disable-gpu-compositing',
        '--disable-accelerated-2d-canvas',
        '--disable-lcd-text',
        '--font-render-hinting=none',
      ],
    },
  },
  webServer: [
    {
      command: `npm run dev:renderer -- --host 127.0.0.1 --port ${PORT} --strictPort`,
      url: `http://127.0.0.1:${PORT}/__linkzag/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: `npm run dev --workspace=@linkzag/studio -- --host 127.0.0.1 --port ${STUDIO_PORT} --strictPort`,
      url: `http://127.0.0.1:${STUDIO_PORT}/__linkzag/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
