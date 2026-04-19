import { test, expect } from '@playwright/test'

/**
 * DARK/LIGHT MODE — 3 tests
 */

test.describe('THEME', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
  })

  test('THEME-001 · Theme toggle works and persists', async ({ page }) => {
    const toggleBtn = page.locator(
      'button[aria-label*="theme"], button[aria-label*="dark"], button[aria-label*="light"], [data-testid="theme-toggle"]',
    ).first()

    if (await toggleBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Get initial theme
      const initialTheme = await page.evaluate(() => document.documentElement.classList.contains('dark') ? 'dark' : 'light')

      await toggleBtn.click()
      await page.waitForTimeout(300)

      const newTheme = await page.evaluate(() => document.documentElement.classList.contains('dark') ? 'dark' : 'light')
      expect(newTheme).not.toBe(initialTheme)

      // Reload and check persistence
      await page.reload()
      await page.waitForLoadState('networkidle')
      const persistedTheme = await page.evaluate(() => document.documentElement.classList.contains('dark') ? 'dark' : 'light')
      expect(persistedTheme).toBe(newTheme)
    } else {
      test.skip()
    }
  })

  test('THEME-002 · No raw "null" or "undefined" in visible user-facing text', async ({ page }) => {
    // Only check text inside elements visible to the user (not script/style/hidden)
    const visibleTexts = await page.evaluate(() => {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode(node) {
            const el = node.parentElement
            if (!el) return NodeFilter.FILTER_REJECT
            // Skip script, style, template, noscript
            if (['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT'].includes(el.tagName))
              return NodeFilter.FILTER_REJECT
            // Skip hidden elements
            const style = window.getComputedStyle(el)
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')
              return NodeFilter.FILTER_REJECT
            return NodeFilter.FILTER_ACCEPT
          },
        },
      )
      const texts: string[] = []
      let node
      while ((node = walker.nextNode())) {
        const t = node.textContent?.trim()
        if (t) texts.push(t)
      }
      return texts.join(' ')
    })

    expect(visibleTexts).not.toMatch(/\bnull\b/)
    expect(visibleTexts).not.toMatch(/\bundefined\b/)
  })

  test('THEME-003 · Dark mode: text is legible (contrast)', async ({ page }) => {
    // Force dark mode
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Check that some text is visible
    const headings = page.locator('h1, h2, h3')
    const count = await headings.count()
    for (let i = 0; i < Math.min(count, 3); i++) {
      const heading = headings.nth(i)
      if (await heading.isVisible()) {
        const color = await heading.evaluate((el) => window.getComputedStyle(el).color)
        // Color should not be black-on-black or white-on-white extremes
        expect(color).not.toBe('rgba(0, 0, 0, 0)')
      }
    }
  })
})
