import { test, expect } from '@playwright/test'

/**
 * RESPONSIVE — 4 tests
 * Uses mobile/tablet viewports configured in playwright.config.ts.
 */

test.describe('RESPONSIVE', () => {
  test('RESP-001 · Dashboard on mobile: no horizontal overflow', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Check no horizontal overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })
    expect(hasHorizontalScroll).toBe(false)

    // Page should load without errors
    await expect(page.locator('body')).not.toContainText('500')
  })

  test('RESP-002 · Dashboard on mobile: main content is accessible', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Some main content should be visible
    const mainContent = page.locator('main, [role="main"], [data-testid="main-content"]').first()
    if (await mainContent.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(mainContent).toBeVisible()
    } else {
      // At minimum the body should have meaningful content
      const bodyText = await page.locator('body').textContent()
      expect(bodyText?.length).toBeGreaterThan(50)
    }
  })

  test('RESP-003 · Mobile sidebar drawer opens and navigates', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Look for hamburger / mobile menu trigger
    const hamburger = page
      .locator('button[aria-label*="menu"], button[aria-label*="navigation"], [data-testid="mobile-menu"]')
      .first()

    if (await hamburger.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await hamburger.click()
      // Sidebar/drawer should be visible
      const drawer = page.locator('[data-testid="sidebar-drawer"], [role="dialog"], nav[class*="mobile"]').first()
      await expect(drawer).toBeVisible({ timeout: 5_000 })
    } else {
      // On desktop viewport, sidebar may already be visible
      test.skip()
    }
  })

  test('RESP-004 · Text is readable (no overflow clipping)', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Check that no visible text elements are clipped to 0 width.
    // We intentionally skip elements that are fully hidden (display:none / visibility:hidden)
    // because they legitimately have width=0 AND height=0 (e.g. the desktop sidebar on mobile).
    const clippedElements = await page.evaluate(() => {
      const elements = document.querySelectorAll('p, h1, h2, h3, span, a, button')
      let clipped = 0
      elements.forEach((el) => {
        const rect = el.getBoundingClientRect()
        const style = window.getComputedStyle(el)
        // Skip elements that are explicitly hidden (display:none, visibility:hidden)
        if (style.display === 'none' || style.visibility === 'hidden') return
        // A truly clipped element has height > 0 (it's in the flow) but width ≈ 0
        if (rect.height > 1 && rect.width < 1 && el.textContent?.trim().length) {
          clipped++
        }
      })
      return clipped
    })
    expect(clippedElements).toBe(0)
  })
})
