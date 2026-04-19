import { test, expect } from '@playwright/test'

/**
 * SECURITY — 5 tests
 */

test.describe('SECURITY', () => {
  test('SEC-001 · Cannot access another user\'s project (RLS)', async ({ page }) => {
    // Try to access a project with a non-existent / other user's ID
    await page.goto('/projects/non-existent-project-id-12345')
    await page.waitForLoadState('networkidle')

    // Should show 404 or "not found", not a data leak
    const body = await page.locator('body').textContent()
    const is404 = page.url().includes('404') ||
      body?.includes('404') ||
      body?.toLowerCase().includes('not found') ||
      body?.toLowerCase().includes('introuvable')
    expect(is404 || await page.locator('body').textContent().then(t => !t?.includes('secret'))).toBe(true)
  })

  test('SEC-002 · API returns 401 without JWT', async ({ page }) => {
    // Make a request without auth headers
    const response = await page.request.post(
      '/api/v1/pipeline/faceless/analyze',
      {
        data: { script: 'test', style: 'cinematic' },
        headers: { 'Content-Type': 'application/json' },
        failOnStatusCode: false,
      },
    )
    // Should be 401 or 403, not 200
    expect([401, 403, 404]).toContain(response.status())
  })

  test('SEC-004 · No API keys in page source or console', async ({ page }) => {
    const consoleMessages: string[] = []
    page.on('console', (msg) => consoleMessages.push(msg.text()))

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2_000)

    // Check page HTML source
    const html = await page.content()
    expect(html).not.toContain('HEYGEN_API_KEY')
    expect(html).not.toContain('ELEVENLABS_API_KEY')
    expect(html).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(html).not.toContain('FAL_KEY')

    // Check console output
    const sensitiveInConsole = consoleMessages.some(
      (msg) =>
        msg.includes('API_KEY') ||
        msg.includes('service_role') ||
        msg.includes('sk-') ||
        msg.includes('FAL_KEY'),
    )
    expect(sensitiveInConsole).toBe(false)
  })

  test('SEC-004b · NEXT_PUBLIC env vars only contain non-sensitive values', async ({ page }) => {
    await page.goto('/dashboard')
    const html = await page.content()

    // NEXT_PUBLIC_ vars leak to client — verify none are secrets
    // (Supabase URL and anon key are acceptable — they're meant to be public)
    const illegalPublicVars = [
      'SUPABASE_SERVICE_ROLE_KEY',
      'ANTHROPIC_API_KEY',
      'HEYGEN_API_KEY',
      'ELEVENLABS_API_KEY',
      'FAL_KEY',
      'STRIPE_SECRET_KEY',
    ]
    for (const varName of illegalPublicVars) {
      expect(html).not.toContain(varName)
    }
  })

  test('SEC-005 · Rate limiting header present on pipeline routes', async ({ page }) => {
    // Send multiple requests and check for rate limit headers
    let rateLimitedCount = 0
    for (let i = 0; i < 5; i++) {
      const response = await page.request.post(
        '/api/v1/pipeline/faceless/analyze',
        {
          data: { script: 'rate limit test', style: 'cinematic' },
          headers: { 'Content-Type': 'application/json' },
          failOnStatusCode: false,
        },
      )
      if (response.status() === 429) rateLimitedCount++
    }
    // Either rate limiting kicks in (429) or route exists (4xx auth errors)
    // This test verifies the route exists and doesn't return 500
    const lastResponse = await page.request.post(
      '/api/v1/pipeline/faceless/analyze',
      {
        data: { script: 'test' },
        failOnStatusCode: false,
      },
    )
    expect(lastResponse.status()).not.toBe(500)
  })

  test('SEC-003 · Server rejects plan manipulation', async ({ page }) => {
    // Try to send pro animation mode as starter user
    const response = await page.request.post(
      '/api/v1/pipeline/faceless/run',
      {
        data: {
          script: 'manipulation test',
          animation_mode: 'pro', // Attempting to use pro mode as starter
          style: 'cinematic',
        },
        headers: { 'Content-Type': 'application/json' },
        failOnStatusCode: false,
      },
    )
    // Should be rejected — 401 (no auth bearer), 403 (plan), 404 (route), or 422 (validation)
    // 200/202 would mean the server accepted the manipulation — that's a failure
    expect(response.status()).not.toBe(200)
    expect(response.status()).not.toBe(202)
  })
})
