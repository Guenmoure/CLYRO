import { chromium, type FullConfig } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import fs from 'fs'

/**
 * Global setup — runs once before all tests.
 * Creates 3 test users in Supabase and saves their session cookies.
 *
 * Required env vars:
 *   E2E_SUPABASE_URL           — Supabase project URL
 *   E2E_SUPABASE_SERVICE_KEY   — service_role key (for direct DB access)
 *   E2E_BASE_URL               — app base URL (default: http://localhost:3000)
 */

const SUPABASE_URL =
  process.env.E2E_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  ''
const SUPABASE_SERVICE_KEY =
  process.env.E2E_SUPABASE_SERVICE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  ''
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'

const TEST_USERS = {
  standard: {
    email: 'e2e-standard@clyro-test.dev',
    password: 'E2eTest1234!',
    full_name: 'E2E Standard',
    plan: 'starter',
    credits: 250,
    stateFile: 'user.json',
  },
  lowCredits: {
    email: 'e2e-low@clyro-test.dev',
    password: 'E2eTest1234!',
    full_name: 'E2E LowCredits',
    plan: 'starter',
    credits: 30,
    stateFile: 'user-low-credits.json',
  },
  pro: {
    email: 'e2e-pro@clyro-test.dev',
    password: 'E2eTest1234!',
    full_name: 'E2E Pro User',
    plan: 'pro',
    credits: 3000,
    stateFile: 'user-pro.json',
  },
} as const

async function upsertTestUser(
  supabase: ReturnType<typeof createClient>,
  user: (typeof TEST_USERS)[keyof typeof TEST_USERS],
) {
  // Create or update auth user
  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  const existing = existingUsers?.users.find((u) => u.email === user.email)

  let userId: string

  if (existing) {
    userId = existing.id
    await supabase.auth.admin.updateUserById(userId, { password: user.password })
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { full_name: user.full_name },
    })
    if (error) throw new Error(`Failed to create user ${user.email}: ${error.message}`)
    userId = data.user.id
  }

  // Upsert profile
  await supabase.from('profiles').upsert({
    id: userId,
    full_name: user.full_name,
    plan: user.plan,
    credits_left: user.credits,
    credits_total: user.plan === 'pro' ? 3000 : 250,
    updated_at: new Date().toISOString(),
  })

  return userId
}

async function saveSessionState(
  browser: ReturnType<typeof chromium.launch> extends Promise<infer T> ? T : never,
  email: string,
  password: string,
  stateFile: string,
) {
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto(`${BASE_URL}/login`)
  await page.locator('#login-email').fill(email)
  await page.locator('#login-password').fill(password)
  await page.getByRole('button', { name: /sign in|connexion/i }).click()
  await page.waitForURL('**/dashboard', { timeout: 30_000 })

  const authDir = path.join(__dirname, '.auth')
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true })

  await context.storageState({ path: path.join(authDir, stateFile) })
  await context.close()
}

export default async function globalSetup(config: FullConfig) {
  const authDir = path.join(__dirname, '.auth')
  const allSessionsExist = Object.values(TEST_USERS).every((u) =>
    fs.existsSync(path.join(authDir, u.stateFile)),
  )

  // If all session files exist, skip user creation (fast path for re-runs)
  if (!allSessionsExist) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.warn('[global-setup] Supabase env vars missing — skipping user creation')
      console.warn('  Set E2E_SUPABASE_URL and E2E_SUPABASE_SERVICE_KEY')
    } else {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })

      console.log('[global-setup] Creating test users...')
      for (const user of Object.values(TEST_USERS)) {
        try {
          await upsertTestUser(supabase, user)
          console.log(`  ✓ ${user.email} (${user.plan}, ${user.credits} credits)`)
        } catch (err) {
          console.warn(`  ⚠ ${user.email} — skipped (${(err as Error).message})`)
        }
      }
    }
  } else {
    console.log('[global-setup] Session files already exist — skipping user creation')
  }

  const browser = await chromium.launch()
  console.log('[global-setup] Saving session cookies...')

  for (const user of Object.values(TEST_USERS)) {
    await saveSessionState(browser, user.email, user.password, user.stateFile)
    console.log(`  ✓ ${user.stateFile}`)
  }

  await browser.close()
  console.log('[global-setup] Done.')
}
