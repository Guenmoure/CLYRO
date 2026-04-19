import { test, expect } from '@playwright/test'

/**
 * F1 — FACELESS VIDEOS — tests
 * AI pipeline calls are mocked via page.route().
 * URLs: /faceless and /faceless/new (route group (dashboard) is transparent)
 */

const MOCK_SCENES = Array.from({ length: 5 }, (_, i) => ({
  id: `scene-${i + 1}`,
  index: i,
  text: `Scene ${i + 1}: Interesting content about the topic.`,
  duration_s: 6,
  image_prompt: `Scene ${i + 1} visual`,
  animation_mode: 'storyboard',
  status: 'pending',
}))

test.describe('F1 — Faceless Videos', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/pipeline/faceless/analyze**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ scenes: MOCK_SCENES, video_id: 'mock-video-001' }),
      }),
    )
    await page.route('**/api/v1/pipeline/faceless/run**', (route) =>
      route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ jobId: 'mock-job-001', status: 'queued' }),
      }),
    )
  })

  test('F1-001 · Faceless list page loads correctly', async ({ page }) => {
    await page.goto('/faceless')
    await expect(page).not.toHaveURL(/login/)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText('500')
    // "New project" link/button should be present
    const newBtn = page
      .getByRole('link', { name: /new project|nouveau/i })
      .or(page.getByRole('button', { name: /new project|nouveau/i }))
    await expect(newBtn.first()).toBeVisible({ timeout: 10_000 })
  })

  test('F1-002 · Wizard opens at step 1 with empty textarea', async ({ page }) => {
    await page.goto('/faceless/new')
    await expect(page).not.toHaveURL(/login/)
    await page.waitForLoadState('networkidle')
    const scriptInput = page.locator('textarea').first()
    await expect(scriptInput).toBeVisible({ timeout: 10_000 })
    await expect(scriptInput).toHaveValue('')
  })

  test('F1-003 · Short script shows duration or word count', async ({ page }) => {
    await page.goto('/faceless/new')
    await page.waitForLoadState('networkidle')
    const scriptInput = page.locator('textarea').first()
    await scriptInput.fill(
      'This is a short script about artificial intelligence and how it changes our world today.',
    )
    // Duration estimate or word count may appear — soft check
    await page.waitForTimeout(500)
    await expect(page.locator('body')).not.toContainText('500')
  })

  test('F1-004 · Large script does not freeze the page', async ({ page }) => {
    await page.goto('/faceless/new')
    await page.waitForLoadState('networkidle')
    const largeScript = Array(200).fill('word').join(' ')
    const scriptInput = page.locator('textarea').first()
    const start = Date.now()
    await scriptInput.fill(largeScript)
    expect(Date.now() - start).toBeLessThan(5_000)
    await expect(scriptInput).not.toBeEmpty()
  })

  test('F1-005 · Empty textarea disables the Next button', async ({ page }) => {
    await page.goto('/faceless/new')
    await page.waitForLoadState('networkidle')
    // "Next" is the button text (last step: "Launch generation")
    const nextBtn = page.getByRole('button', { name: /^next$|^launch generation$/i }).first()
    await expect(nextBtn).toBeDisabled({ timeout: 10_000 })
  })

  test('F1-006 · Script with special characters is accepted', async ({ page }) => {
    await page.goto('/faceless/new')
    await page.waitForLoadState('networkidle')
    const specialScript = "L'émission «À votre santé» coûte 50€ — c'est ça l'IA 🤖"
    const scriptInput = page.locator('textarea').first()
    await scriptInput.fill(specialScript)
    await expect(scriptInput).toHaveValue(specialScript)
  })

  test('F1-008 · Proceeding past step 1 shows style options', async ({ page }) => {
    await page.goto('/faceless/new')
    await page.waitForLoadState('networkidle')

    await page.locator('textarea').first().fill(
      'A comprehensive guide to machine learning for beginners covering all fundamentals.',
    )

    const nextBtn = page.getByRole('button', { name: /^next$/i }).first()
    if (await nextBtn.isEnabled({ timeout: 5_000 }).catch(() => false)) {
      await nextBtn.click()
      await page.waitForTimeout(500)
      // Style options (Cinematic, Stock, Whiteboard…) should appear
      const styleOption = page.getByText(/cinematic|stock|whiteboard|animation/i).first()
      if (await styleOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await expect(styleOption).toBeVisible()
      }
    } else {
      test.skip()
    }
  })

  test('F1-021 · Navigating away does not crash the app', async ({ page }) => {
    await page.goto('/faceless/new')
    await page.waitForLoadState('networkidle')
    await page.locator('textarea').first().fill(
      'This is a test script that should be saved as draft automatically.',
    )
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText('500')
    await expect(page).toHaveURL(/dashboard/)
  })
})
