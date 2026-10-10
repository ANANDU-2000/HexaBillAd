// UI regression suite. Local/dev only — never point at production tenants.
// Run: HEXABILL_OWNER_PASSWORD=... npm run test:e2e
// Needs the API on :5000 and Vite on :5173 (docs/RUN_LOCALLY.md) and tenants from scripts/tier0-local-bootstrap.mjs.
import { defineConfig } from '@playwright/test'

export const VIEWPORTS = [
  { name: 'm360', width: 360, height: 800 },
  { name: 'm390', width: 390, height: 844 },
  { name: 't768', width: 768, height: 1024 },
  { name: 'd1024', width: 1024, height: 768 },
  { name: 'd1440', width: 1440, height: 900 },
]

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.results',
  timeout: 60_000,
  fullyParallel: false,
  workers: 2,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: './e2e/.report', open: 'never' }]],
  use: {
    // Uses the installed Edge/Chrome so no browser download is needed; override with PW_CHANNEL.
    channel: process.env.PW_CHANNEL || 'msedge',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: VIEWPORTS.map((vp) => ({
    name: vp.name,
    use: { viewport: { width: vp.width, height: vp.height }, isMobile: false },
  })),
})
