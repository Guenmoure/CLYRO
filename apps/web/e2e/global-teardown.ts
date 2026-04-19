/**
 * Global teardown — runs once after all tests.
 * Cleans up test projects created during the test run.
 * Test users themselves are NOT deleted (they are reused across runs).
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL =
  process.env.E2E_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  ''
const SUPABASE_SERVICE_KEY =
  process.env.E2E_SUPABASE_SERVICE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  ''

const TEST_EMAILS = [
  'e2e-standard@clyro-test.dev',
  'e2e-low@clyro-test.dev',
  'e2e-pro@clyro-test.dev',
]

export default async function globalTeardown() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Get test user IDs
  const { data: users } = await supabase.auth.admin.listUsers()
  const testUserIds = users?.users
    .filter((u) => TEST_EMAILS.includes(u.email ?? ''))
    .map((u) => u.id) ?? []

  if (testUserIds.length === 0) return

  // Delete projects created during tests
  await supabase
    .from('projects')
    .delete()
    .in('user_id', testUserIds)
    .like('title', 'E2E%')

  console.log('[global-teardown] Test projects cleaned up.')
}
