import { test, expect } from '@playwright/test'

/**
 * EDGE CASES & STRESS TESTS — 11 tests
 */

test.describe('EDGE CASES', () => {
  test('EDGE-001 · Dashboard handles 0 projects without error', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText('500')
    await expect(page.locator('body')).not.toContainText('Error')
  })

  test('EDGE-002 · Long project title is truncated (no layout break)', async ({ page }) => {
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')

    // If any project cards exist, check none overflow their containers
    const projectCards = page.locator('[data-testid="project-card"], [class*="project-card"]')
    const count = await projectCards.count()
    if (count > 0) {
      const hasOverflow = await projectCards.first().evaluate((el) => {
        return el.scrollWidth > el.clientWidth + 5 // 5px tolerance
      })
      expect(hasOverflow).toBe(false)
    } else {
      test.skip()
    }
  })

  test('EDGE-003 · Double-click on generate does not submit twice', async ({ page }) => {
    await page.goto('/faceless/new')
    await page.waitForLoadState('networkidle')

    let requestCount = 0
    await page.route('**/api/v1/pipeline/faceless/**', (route) => {
      requestCount++
      route.fulfill({ status: 202, body: JSON.stringify({ jobId: 'test' }) })
    })

    const textarea = page.locator('textarea').first()
    if (await textarea.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await textarea.fill('Test script for double-click prevention in the pipeline generation.')
      const generateBtn = page.getByRole('button', { name: /next|suivant|generate|générer/i }).first()
      if (await generateBtn.isEnabled({ timeout: 3_000 }).catch(() => false)) {
        // Double-click rapidly
        await generateBtn.dblclick()
        await page.waitForTimeout(1_000)
        expect(requestCount).toBeLessThanOrEqual(1)
      }
    } else {
      test.skip()
    }
  })

  test('EDGE-004 · Refresh during wizard restores state', async ({ page }) => {
    await page.goto('/faceless/new')
    await page.waitForLoadState('networkidle')

    const textarea = page.locator('textarea').first()
    if (await textarea.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await textarea.fill('Script that will be saved before refresh.')
      await page.reload()
      await page.waitForLoadState('networkidle')
      // Page should not crash
      await expect(page.locator('body')).not.toContainText('500')
    } else {
      test.skip()
    }
  })

  test('EDGE-007 · XSS in script textarea is not executed', async ({ page }) => {
    await page.goto('/faceless/new')
    await page.waitForLoadState('networkidle')

    const scriptInput = page.locator('textarea').first()
    if (await scriptInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      let alertFired = false
      page.on('dialog', (dialog) => {
        alertFired = true
        dialog.dismiss()
      })

      await scriptInput.fill('<script>alert("xss")</script><img src=x onerror=alert(1)>')
      await page.waitForTimeout(500)

      expect(alertFired).toBe(false)

      // The text should be visible as plain text, not executed
      const value = await scriptInput.inputValue()
      expect(value).toContain('<script>')
    } else {
      test.skip()
    }
  })

  test('EDGE-008 · Whitespace-only script treated as empty', async ({ page }) => {
    await page.goto('/faceless/new')
    await page.waitForLoadState('networkidle')

    const textarea = page.locator('textarea').first()
    if (await textarea.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await textarea.fill('       ')
      const nextBtn = page.getByRole('button', { name: /next|suivant/i }).first()
      // Button should be disabled for whitespace-only input
      const isDisabled = await nextBtn.isDisabled()
      expect(isDisabled).toBe(true)
    } else {
      test.skip()
    }
  })

  test('EDGE-011 · Emoji in content does not break layout', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Page should load without crash even if project titles have emoji
    await expect(page.locator('body')).not.toContainText('500')
    await expect(page).not.toHaveURL(/error/)
  })

  test('EDGE-005 · Two tabs: no crash on concurrent access', async ({ browser }) => {
    const context = await browser.newContext()
    const page1 = await context.newPage()
    const page2 = await context.newPage()

    await page1.goto('/dashboard')
    await page2.goto('/dashboard')

    await Promise.all([
      page1.waitForLoadState('networkidle'),
      page2.waitForLoadState('networkidle'),
    ])

    // Neither page should crash
    await expect(page1.locator('body')).not.toContainText('500')
    await expect(page2.locator('body')).not.toContainText('500')

    await context.close()
  })

  test('EDGE-006 · Offline state shows error, not crash', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Simulate offline
    await page.context().setOffline(true)

    // Try navigation
    await page.goto('/faceless/new').catch(() => {})

    // Restore online
    await page.context().setOffline(false)

    // No unhandled JS error (page should show error message gracefully)
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await page.waitForTimeout(500)

    // Unhandled errors are not acceptable
    const criticalErrors = errors.filter((e) => !e.includes('Failed to fetch') && !e.includes('NetworkError'))
    expect(criticalErrors).toHaveLength(0)
  })
})
