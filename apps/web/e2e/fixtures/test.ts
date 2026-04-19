import { test as base, expect } from '@playwright/test'

// ── Extended fixtures ─────────────────────────────────────────────────────────

export type TestFixtures = {
  /** Navigate to dashboard and verify it loaded */
  dashboard: void
}

export const test = base.extend<TestFixtures>({
  dashboard: [
    async ({ page }, use) => {
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      await use()
    },
    { auto: false },
  ],
})

export { expect }
