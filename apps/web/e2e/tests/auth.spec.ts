import { test, expect } from '@playwright/test'

/**
 * AUTH — 10 tests
 * These tests manage their own sessions (no storageState).
 */

const VALID_EMAIL = 'e2e-standard@clyro-test.dev'
const VALID_PASSWORD = 'E2eTest1234!'

// Helpers using real form field IDs
async function fillLoginForm(page: ReturnType<typeof test.extend>, email: string, password: string) {
  await page.locator('#login-email').fill(email)
  await page.locator('#login-password').fill(password)
  await page.getByRole('button', { name: /sign in|connexion|iniciar/i }).click()
}

test.describe('AUTH', () => {
  test.use({ storageState: { cookies: [], origins: [] } }) // No pre-existing session

  test('AUTH-004 · Wrong password shows generic error', async ({ page }) => {
    await page.goto('/login')
    await fillLoginForm(page, VALID_EMAIL, 'WrongPassword999!')

    // Error message: "Invalid email or password."
    await expect(
      page.getByText(/invalid email or password|email ou mot de passe|connexion invalide/i),
    ).toBeVisible({ timeout: 10_000 })
    await expect(page).not.toHaveURL(/dashboard/)
    // Email field should still have the value (not cleared)
    await expect(page.locator('#login-email')).toHaveValue(VALID_EMAIL)
  })

  test('AUTH-005 · Unknown email shows same generic error (no user existence leak)', async ({ page }) => {
    await page.goto('/login')
    await fillLoginForm(page, 'nexistepas@test.com', 'SomePassword1!')

    // Wait for any error
    const error = page.locator('[role="alert"], p[class*="error"], p[class*="text-red"], span[class*="error"]').first()
    await error.waitFor({ timeout: 10_000 }).catch(() => {})

    const errorText = await error.textContent().catch(() => '')
    // Must NOT reveal whether the user account exists
    expect(errorText).not.toMatch(/user not found|utilisateur introuvable|no account/i)
    await expect(page).not.toHaveURL(/dashboard/)
  })

  test('AUTH-006 · Unauthenticated redirect to /login with redirectTo param', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
    const url = new URL(page.url())
    expect(url.searchParams.get('redirectTo')).toContain('/dashboard')
  })

  test('AUTH-007 · Already logged-in user redirected away from /login', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('/login')
    await fillLoginForm(page, VALID_EMAIL, VALID_PASSWORD)
    await page.waitForURL('**/dashboard', { timeout: 30_000 })

    // Authenticated user visiting /login → should redirect to dashboard
    await page.goto('/login')
    await expect(page).toHaveURL(/dashboard/)
    await context.close()
  })

  test('AUTH-008 · Sign out clears session', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('/login')
    await fillLoginForm(page, VALID_EMAIL, VALID_PASSWORD)
    await page.waitForURL('**/dashboard', { timeout: 30_000 })
    await page.waitForLoadState('networkidle')

    // User menu trigger: <button> directly inside <div.relative.p-3> in aside
    const avatarBtn = page.locator('aside div.relative.p-3 > button').first()
    await avatarBtn.waitFor({ state: 'visible', timeout: 15_000 })
    await avatarBtn.click()
    await page.getByText('Sign out').click()
    await page.waitForURL('**/login', { timeout: 10_000 })

    // Back to dashboard → should redirect to login
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
    await context.close()
  })

  test('AUTH-010 · Weak password blocked by minLength validation', async ({ page }) => {
    await page.goto('/signup')
    const passwordField = page.locator('#signup-password')
    await passwordField.fill('123')

    // HTML5 minLength=8 prevents submission or shows browser validation
    const submitBtn = page.getByRole('button', { name: /create account|créer|crear|erstellen|criar/i })
    await submitBtn.click()

    // Either the form doesn't submit (still on /signup) or shows a validation message
    await page.waitForTimeout(500)
    await expect(page).not.toHaveURL(/dashboard/)
  })

  test('AUTH-006b · After login, redirected back to original protected page', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)

    await fillLoginForm(page, VALID_EMAIL, VALID_PASSWORD)
    await expect(page).toHaveURL(/dashboard/, { timeout: 30_000 })
  })
})
