import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: 0,
  timeout: 30_000,
  reporter: 'line',
  outputDir: 'output/playwright/results',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'chrome-windows',
      use: { browserName: 'chromium', channel: 'chrome', viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'edge-windows',
      use: { browserName: 'chromium', channel: 'msedge', viewport: { width: 1366, height: 768 } },
    },
    {
      name: 'firefox-desktop',
      use: { browserName: 'firefox', viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'safari-macos-webkit',
      use: { browserName: 'webkit', viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'chrome-android',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'safari-ios-webkit',
      use: { ...devices['iPhone 15 Pro'] },
    },
  ],
})
