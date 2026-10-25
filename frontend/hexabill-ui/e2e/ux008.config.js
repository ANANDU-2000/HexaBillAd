// UX-008 mocked run at the four audit widths. No backend needed, only Vite on :5173.
import { defineConfig } from '@playwright/test'
const W = [[320, 640], [390, 844], [768, 1024], [1440, 900]]
export default defineConfig({
  testDir: '.',
  testMatch: /invoice-number-change\.spec\.js/,
  outputDir: './.results-ux008',
  timeout: 60_000,
  workers: 2,
  reporter: [['list']],
  use: { channel: process.env.PW_CHANNEL || 'chromium', headless: true, trace: 'off' },
  projects: W.map(([width, height]) => ({ name: `w${width}`, use: { viewport: { width, height } } })),
})
