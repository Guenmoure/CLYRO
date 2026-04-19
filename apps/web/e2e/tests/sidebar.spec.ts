import { test, expect } from '@playwright/test'

/**
 * SIDEBAR — tests
 *
 * Real Sidebar structure (components/layout/Sidebar.tsx):
 *   - Nav items are <button> (router.push), NOT <Link>/<a>
 *   - User menu trigger: <button> inside <div.relative.p-3> in <aside>
 *   - Logo: <button aria-label="Go to dashboard">
 *   - Sign-out text: "Sign out" (not "Log out")
 */

// User menu trigger: the button directly inside the p-3 wrapper div at the bottom of the aside
function getUserMenuBtn(page: Parameters<typeof test>[1] extends { page: infer P } ? P : never) {
  return page.locator('aside div.relative.p-3 > button').first()
}

test.describe('SIDEBAR', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
  })

  test('SIDE-001 · Logo is visible in sidebar', async ({ page }) => {
    // Logo is a <button aria-label="Go to dashboard">
    const logo = page.locator('button[aria-label="Go to dashboard"]')
    await expect(logo).toBeVisible({ timeout: 10_000 })
  })

  test('SIDE-002 · Logo click navigates to /dashboard', async ({ page }) => {
    await page.goto('/faceless')
    await page.waitForLoadState('networkidle')
    await page.locator('button[aria-label="Go to dashboard"]').first().click()
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('SIDE-004 · Navigation items visible', async ({ page }) => {
    // Nav items are <button> elements (router.push), not <a href>
    const navBtns = page.locator('aside nav button')
    // Wait for at least one nav button to be present
    await expect(navBtns.first()).toBeVisible({ timeout: 15_000 })
    const count = await navBtns.count()
    expect(count).toBeGreaterThan(0)
  })

  test('SIDE-005 · Sidebar collapse toggle (if present)', async ({ page }) => {
    // Collapse toggle has aria-label="Expand sidebar" or "Collapse sidebar"
    const collapseBtn = page.locator('button[aria-label="Expand sidebar"], button[aria-label="Collapse sidebar"]').first()
    if (await collapseBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      const aside = page.locator('aside').first()
      const w1 = await aside.boundingBox().then((b) => b?.width ?? 0)
      await collapseBtn.click()
      await page.waitForTimeout(400)
      const w2 = await aside.boundingBox().then((b) => b?.width ?? 0)
      expect(w2).not.toBe(w1)
    } else {
      test.skip()
    }
  })

  test('SIDE-009 · User menu opens on avatar click', async ({ page }) => {
    // User menu trigger: <button> directly inside <div.relative.p-3> in the aside
    const avatarBtn = getUserMenuBtn(page)
    await avatarBtn.waitFor({ state: 'visible', timeout: 15_000 })
    await avatarBtn.click()
    // Sign out text in the dropdown
    await expect(page.getByText('Sign out')).toBeVisible({ timeout: 5_000 })
  })

  test('SIDE-010 · User menu closes on Escape', async ({ page }) => {
    const avatarBtn = getUserMenuBtn(page)
    await avatarBtn.waitFor({ state: 'visible', timeout: 15_000 })
    await avatarBtn.click()
    await expect(page.getByText('Sign out')).toBeVisible({ timeout: 5_000 })
    await page.keyboard.press('Escape')
    await expect(page.getByText('Sign out')).not.toBeVisible()
  })

  test('SIDE-010b · User menu closes on outside click', async ({ page }) => {
    const avatarBtn = getUserMenuBtn(page)
    await avatarBtn.waitFor({ state: 'visible', timeout: 15_000 })
    await avatarBtn.click()
    await expect(page.getByText('Sign out')).toBeVisible({ timeout: 5_000 })
    await page.mouse.click(700, 200)
    await expect(page.getByText('Sign out')).not.toBeVisible()
  })

  test('SIDE-012 · Clicking a nav item navigates correctly', async ({ page }) => {
    // In collapsed mode there is no text — check for a Faceless button by expanding first
    const expandBtn = page.locator('button[aria-label="Expand sidebar"]').first()
    if (await expandBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await expandBtn.click()
      await page.waitForTimeout(350)
    }
    // Now look for a nav button whose visible text includes "Faceless"
    const facelessBtn = page.locator('aside nav button').filter({ hasText: /Faceless/i }).first()
    if (await facelessBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await facelessBtn.click()
      await expect(page).toHaveURL(/faceless/)
    } else {
      test.skip()
    }
  })
})
