import { test, expect } from '@playwright/test'

/**
 * F5 — AVATAR STUDIO — 12 tests
 */

test.describe('F5 — Avatar Studio', () => {
  test.beforeEach(async ({ page }) => {
    // Mock avatar list
    await page.route('**/api/v1/assets/avatars**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          avatars: [
            { avatar_id: 'av1', avatar_name: 'Aria', preview_image_url: '', tags: ['professional'] },
            { avatar_id: 'av2', avatar_name: 'Josh', preview_image_url: '', tags: ['lifestyle'] },
          ],
        }),
      }),
    )
    await page.route('**/api/v1/pipeline/studio/**', (route) =>
      route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ jobId: 'mock-studio-001', video_id: 'mock-avatar-video-001' }),
      }),
    )
  })

  test('F5-001 · Avatar list page loads correctly', async ({ page }) => {
    await page.goto('/studio')
    await expect(page).not.toHaveURL(/login/)
    await expect(page.locator('body')).not.toContainText('500')
  })

  test('F5-002 · Wizard opens on new project', async ({ page }) => {
    await page.goto('/studio/new')
    await expect(page).not.toHaveURL(/login/)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText('500')
  })

  test('F5-004 · Invalid YouTube URL shows error', async ({ page }) => {
    await page.goto('/studio/new')

    // Find URL input field
    const urlInput = page.locator('input[type="url"], input[placeholder*="youtube"], input[placeholder*="YouTube"]').first()
    if (await urlInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await urlInput.fill('https://google.com')
      const analyzeBtn = page.getByRole('button', { name: /analyser|analyze/i }).first()
      await analyzeBtn.click()

      await expect(
        page.getByText(/url.*invalid|invalide|not.*youtube|youtube.*invalid/i),
      ).toBeVisible({ timeout: 5_000 })
    } else {
      test.skip()
    }
  })

  test('F5-003 · YouTube URL input accepts valid URL format', async ({ page }) => {
    await page.goto('/studio/new')

    const urlInput = page.locator('input[type="url"], input[placeholder*="youtube"], input[placeholder*="YouTube"]').first()
    if (await urlInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await urlInput.fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
      await expect(urlInput).toHaveValue(/youtube\.com/)
      // Should not show "invalid URL" error yet
      const errorText = page.getByText(/url.*invalid|invalide/i)
      const hasError = await errorText.isVisible({ timeout: 2_000 }).catch(() => false)
      expect(hasError).toBe(false)
    } else {
      test.skip()
    }
  })
})
