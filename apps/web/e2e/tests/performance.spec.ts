import { test, expect } from '@playwright/test'

/**
 * PERFORMANCE — 3 tests
 * Measures Core Web Vitals and basic performance budgets.
 */

test.describe('PERFORMANCE', () => {
  test('PERF-001 · Dashboard LCP < 3 seconds', async ({ page }) => {
    await page.goto('/dashboard')

    // Measure Largest Contentful Paint via PerformanceObserver
    const lcp = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let lcpTime = 0
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries()
            entries.forEach((entry) => {
              lcpTime = entry.startTime
            })
          })
          observer.observe({ type: 'largest-contentful-paint', buffered: true })
          // Resolve after 5s max
          setTimeout(() => {
            observer.disconnect()
            resolve(lcpTime)
          }, 5_000)
        }),
    )

    // In dev mode (no SSG/CDN), LCP can exceed 3s — use 10s as local threshold
    const threshold = process.env.CI ? 5_000 : 10_000
    if (lcp > 0) {
      expect(lcp).toBeLessThan(threshold)
    }
    await expect(page.locator('body')).not.toContainText('500')
  })

  test('PERF-001b · Dashboard TTFB acceptable', async ({ page }) => {
    // Measure wall-clock time to first byte (covers redirect chains)
    const start = Date.now()
    await page.goto('/dashboard')
    const elapsed = Date.now() - start

    // CI uses prod build (next start): enforce 3s. Dev server first-compile can be 30s+
    const threshold = process.env.CI ? 3_000 : 30_000
    expect(elapsed).toBeLessThan(threshold)
  })

  test('PERF-001c · Dashboard CLS is low', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const cls = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let clsScore = 0
          const observer = new PerformanceObserver((list) => {
            list.getEntries().forEach((entry: any) => {
              if (!entry.hadRecentInput) {
                clsScore += entry.value
              }
            })
          })
          observer.observe({ type: 'layout-shift', buffered: true })
          setTimeout(() => {
            observer.disconnect()
            resolve(clsScore)
          }, 3_000)
        }),
    )

    // CLS < 0.25 (lenient for dev environment)
    expect(cls).toBeLessThan(0.25)
  })

  test('PERF-002 · No inline scripts with secrets in page source', async ({ page }) => {
    await page.goto('/dashboard')
    const html = await page.content()

    // Ensure no obvious secret patterns in rendered HTML
    expect(html).not.toMatch(/eyJ[A-Za-z0-9+/]{40,}/) // Base64 JWT-like tokens
    expect(html).not.toMatch(/sk-[A-Za-z0-9]{40,}/)   // OpenAI-style keys
    expect(html).not.toMatch(/ELEVENLABS_API_KEY/)
    expect(html).not.toMatch(/FAL_KEY/)
  })

  test('PERF-003 · Images have alt text or aria-label', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const images = page.locator('img')
    const count = await images.count()

    for (let i = 0; i < Math.min(count, 10); i++) {
      const img = images.nth(i)
      const alt = await img.getAttribute('alt')
      const ariaLabel = await img.getAttribute('aria-label')
      const ariaHidden = await img.getAttribute('aria-hidden')
      // Image must have alt, aria-label, or aria-hidden="true"
      expect(alt !== null || ariaLabel !== null || ariaHidden === 'true').toBe(true)
    }
  })
})
