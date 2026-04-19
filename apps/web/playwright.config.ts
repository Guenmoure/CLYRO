import { defineConfig, devices } from '@playwright/test'
import path from 'path'
import { config as loadEnv } from 'dotenv'

// Load .env.local first (real credentials), then .env.test as fallback for any missing vars.
// IMPORTANT: .env.local must come first so its values are not overridden by .env.test templates.
loadEnv({ path: path.join(__dirname, '.env.local'), override: false })
loadEnv({ path: path.join(__dirname, '.env.test'), override: false })

/**
 * CLYRO — Playwright E2E configuration
 * Tests run against a local Next.js dev server (or $BASE_URL in CI).
 * Auth state is stored per-role in e2e/.auth/ and reused across tests.
 */

export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'

// Reusable auth state files (populated by global-setup.ts)
export const AUTH_STATE = path.join(__dirname, 'e2e', '.auth', 'user.json')
export const AUTH_STATE_LOW_CREDITS = path.join(__dirname, 'e2e', '.auth', 'user-low-credits.json')
export const AUTH_STATE_PRO = path.join(__dirname, 'e2e', '.auth', 'user-pro.json')

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ...(process.env.CI ? [['github'] as ['github']] : []),
  ],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    // Dev server first-compile can be slow — CI prod build is faster
    navigationTimeout: process.env.CI ? 30_000 : 60_000,
  },

  // Global setup creates Supabase test users and saves session cookies
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',

  projects: [
    // ── Desktop ──────────────────────────────────────────────────────────────
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_STATE,
      },
      testIgnore: ['**/responsive.spec.ts'],
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: AUTH_STATE,
      },
      testMatch: ['**/auth.spec.ts', '**/security.spec.ts'],
    },

    // ── Auth tests (no storageState — tests manage their own sessions) ────────
    {
      name: 'auth',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/auth.spec.ts',
    },

    // ── Responsive ────────────────────────────────────────────────────────────
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: AUTH_STATE,
      },
      testMatch: '**/responsive.spec.ts',
    },
    {
      name: 'iphone-se',
      use: {
        ...devices['iPhone SE'],
        storageState: AUTH_STATE,
      },
      testMatch: '**/responsive.spec.ts',
    },
    {
      name: 'ipad',
      use: {
        ...devices['iPad (gen 7)'],
        storageState: AUTH_STATE,
      },
      testMatch: '**/responsive.spec.ts',
    },
  ],

  webServer: {
    command: process.env.CI ? 'npm run start' : 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
