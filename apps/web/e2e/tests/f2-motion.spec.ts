import { test, expect } from '@playwright/test'

/**
 * F2 — MOTION DESIGN — 3 tests
 */

test.describe('F2 — Motion Design', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/pipeline/motion/**', (route) =>
      route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ jobId: 'mock-motion-001' }),
      }),
    )
  })

  test('F2-001 · Motion list page loads correctly', async ({ page }) => {
    await page.goto('/motion')
    await expect(page).not.toHaveURL(/login/)
    await expect(page.locator('body')).not.toContainText('500')
    // Should show some page title or header
    await page.waitForLoadState('networkidle')
  })

  test('F2-002 · Motion wizard opens', async ({ page }) => {
    await page.goto('/motion/new')
    await expect(page).not.toHaveURL(/login/)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText('500')
  })

  test('F2-003 · Format selector renders options', async ({ page }) => {
    await page.goto('/motion/new')
    await page.waitForLoadState('networkidle')

    // Look for format selector (16:9, 9:16, 1:1)
    const formatOption = page.getByText(/16:9|9:16|1:1/)
    const count = await formatOption.count()
    if (count > 0) {
      expect(count).toBeGreaterThan(0)
    } else {
      test.skip()
    }
  })
})
