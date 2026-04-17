/**
 * DashboardLayout — Server Component.
 *
 * Fetches user profile + project/draft counts once at layout level.
 * Passes data down to DashboardShell (Client Component) which manages
 * sidebar collapse/mobile state.
 *
 * This avoids each page re-fetching user data and keeps the shell reactive.
 */

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/database.types'
import { DashboardShell, type SidebarUser } from '@/components/layout/DashboardShell'

// ── Helpers ────────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U'
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ── Layout ─────────────────────────────────────────────────────────────────────

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {

  // Graceful degradation — don't crash if env vars are missing
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return (
      <DashboardShell
        user={{ fullName: 'User', initials: 'U', plan: 'Free', creditsLeft: 0 }}
        projectsCount={0}
        draftsCount={0}
      >
        {children}
      </DashboardShell>
    )
  }

  let sidebarUser: SidebarUser = {
    fullName:    'User',
    initials:    'U',
    plan:        'Free',
    creditsLeft: 0,
  }
  let projectsCount = 0
  let draftsCount   = 0

  try {
    const supabase = createServerComponentClient<Database>({ cookies })

    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      // Fetch profile + video counts in parallel
      const [profileResult, allVideosResult, draftsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('full_name, plan, credits')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('videos')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('videos')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'draft'),
      ])

      const profile = profileResult.data as {
        full_name: string | null
        plan: string
        credits: number
      } | null
      const fullName = profile?.full_name
        ?? user.email?.split('@')[0]
        ?? 'User'

      sidebarUser = {
        fullName,
        initials:    getInitials(fullName),
        plan:        capitalize(profile?.plan ?? 'free'),
        creditsLeft: profile?.credits ?? 0,
      }

      projectsCount = allVideosResult.count ?? 0
      draftsCount   = draftsResult.count ?? 0
    }
  } catch (err) {
    // Log but don't break the layout — shell will render with defaults
    console.error('[DashboardLayout] Error fetching sidebar data:', err)
  }

  return (
    <DashboardShell
      user={sidebarUser}
      projectsCount={projectsCount}
      draftsCount={draftsCount}
    >
      {children}
    </DashboardShell>
  )
}
