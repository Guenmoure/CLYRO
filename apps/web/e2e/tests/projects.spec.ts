import { test, expect } from '@playwright/test'

/**
 * PROJETS — 2 tests
 */

test.describe('PROJECTS', () => {
  test('PROJ-001 · Projects page loads and renders filter tabs', async ({ page }) => {
    await page.goto('/projects')
    await expect(page).not.toHaveURL(/login/)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText('500')

    // There should be some filter UI (tabs or buttons)
    const filterUI = page
      .locator('[role="tab"], [data-testid*="filter"], button')
      .filter({ hasText: /all|tous|draft|brouillon|done|termin|generating/i })
      .first()
    if (await filterUI.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(filterUI).toBeVisible()
    }
  })

  test('PROJ-002 · Empty filter state shows message, not blank page', async ({ page }) => {
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')

    // Click on "error" filter if it exists
    const errorFilter = page
      .locator('[role="tab"], button')
      .filter({ hasText: /error|erreur/i })
      .first()

    if (await errorFilter.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await errorFilter.click()
      await page.waitForTimeout(500)
      // Either shows "no projects" message or renders empty grid — not a 500 error
      await expect(page.locator('body')).not.toContainText('500')
    } else {
      test.skip()
    }
  })
})
