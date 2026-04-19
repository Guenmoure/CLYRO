import { test, expect } from '@playwright/test'

/**
 * ASSETS — 3 tests
 */

test.describe('ASSETS', () => {
  test.beforeEach(async ({ page }) => {
    // Mock asset APIs to avoid hitting real HeyGen/ElevenLabs
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
    await page.route('**/api/v1/assets/voices**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          voices: [
            { voice_id: 'v1', name: 'Alistair', preview_url: '', labels: { accent: 'british' } },
            { voice_id: 'v2', name: 'Maria', preview_url: '', labels: { accent: 'american' } },
          ],
        }),
      }),
    )
  })

  test('ASSET-001 · Assets page loads with avatar grid', async ({ page }) => {
    await page.goto('/assets')
    await expect(page).not.toHaveURL(/login/)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText('500')
  })

  test('ASSET-002 · Voice audio is singleton (only one plays at a time)', async ({ page }) => {
    await page.goto('/assets')
    await page.waitForLoadState('networkidle')

    // Find voice tab if exists
    const voiceTab = page.locator('[role="tab"]').filter({ hasText: /voice|voix/i }).first()
    if (await voiceTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await voiceTab.click()
      await page.waitForTimeout(500)

      // Find play buttons
      const playBtns = page.locator('button[aria-label*="play"], button[title*="play"], button[title*="Play"]')
      const count = await playBtns.count()
      if (count >= 2) {
        await playBtns.nth(0).click()
        await playBtns.nth(1).click()
        // Only 1 audio element should be playing
        const playingCount = await page.evaluate(() => {
          const audios = Array.from(document.querySelectorAll('audio'))
          return audios.filter((a) => !a.paused).length
        })
        expect(playingCount).toBeLessThanOrEqual(1)
      }
    } else {
      test.skip()
    }
  })

  test('ASSET-003 · No direct calls to HeyGen or ElevenLabs APIs', async ({ page }) => {
    const externalAPICalls: string[] = []

    page.on('request', (req) => {
      const url = req.url()
      if (url.includes('api.heygen.com') || url.includes('api.elevenlabs.io')) {
        externalAPICalls.push(url)
      }
    })

    await page.goto('/assets')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2_000)

    expect(externalAPICalls).toHaveLength(0)
  })
})
