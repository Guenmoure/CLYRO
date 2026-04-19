import type { Page } from '@playwright/test'

export const TEST_CREDENTIALS = {
  standard: {
    email: 'e2e-standard@clyro-test.dev',
    password: 'E2eTest1234!',
    name: 'E2E Standard',
  },
  lowCredits: {
    email: 'e2e-low@clyro-test.dev',
    password: 'E2eTest1234!',
    name: 'E2E LowCredits',
  },
  pro: {
    email: 'e2e-pro@clyro-test.dev',
    password: 'E2eTest1234!',
    name: 'E2E Pro User',
  },
} as const

export async function login(page: Page, role: keyof typeof TEST_CREDENTIALS = 'standard') {
  const creds = TEST_CREDENTIALS[role]
  await page.goto('/login')
  await page.locator('#login-email').fill(creds.email)
  await page.locator('#login-password').fill(creds.password)
  await page.getByRole('button', { name: /sign in|connexion/i }).click()
  await page.waitForURL('**/dashboard', { timeout: 30_000 })
}

export async function logout(page: Page) {
  // User menu trigger: <button> directly inside <div.relative.p-3> in aside
  const avatarBtn = page.locator('aside div.relative.p-3 > button').first()
  await avatarBtn.waitFor({ state: 'visible', timeout: 15_000 })
  await avatarBtn.click()
  await page.getByText('Sign out').click()
  await page.waitForURL('**/login')
}
