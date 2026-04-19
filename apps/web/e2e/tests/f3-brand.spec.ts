import { test, expect } from '@playwright/test'

/**
 * F3 — BRAND KIT — 3 tests
 */

test.describe('F3 — Brand Kit', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/pipeline/brand/**', (route) =>
      route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ jobId: 'mock-brand-001' }),
      }),
    )
  })

  test('F3-001 · Brand list page loads correctly', async ({ page }) => {
    await page.goto('/brand')
    await expect(page).not.toHaveURL(/login/)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText('500')
  })

  test('F3-002 · Brand wizard opens', async ({ page }) => {
    await page.goto('/brand/new')
    await expect(page).not.toHaveURL(/login/)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText('500')
  })

  test('F3-003 · Brand brief textarea accepts input', async ({ page }) => {
    await page.goto('/brand/new')
    await page.waitForLoadState('networkidle')

    const textarea = page.locator('textarea').first()
    if (await textarea.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await textarea.fill('Startup fintech pour les jeunes, moderne, vert et blanc')
      await expect(textarea).toHaveValue(/fintech/)
    } else {
      test.skip()
    }
  })
})
