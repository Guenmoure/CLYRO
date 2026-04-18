import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { AlertCircle, RefreshCw } from 'lucide-react'
import type { Database } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

// Dashboard components
import { PromoBanner }        from '@/components/dashboard/PromoBanner'
import { NewProjectDropdown } from '@/components/dashboard/NewProjectDropdown'
import { QuickActions }       from '@/components/dashboard/QuickActions'
import { CreditsBanner }      from '@/components/dashboard/CreditsBanner'
import { EmptyDashboard }     from '@/components/dashboard/EmptyDashboard'
import { ProjectsSection }    from '@/components/dashboard/ProjectsSection'
import { DashboardGreeting }  from '@/components/dashboard/DashboardGreeting'
import type { VideoProject }  from '@/components/dashboard/ProjectCard'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Dashboard — CLYRO' }

// ── Types ──────────────────────────────────────────────────────────────────────

interface Profile {
  full_name: string | null
  plan:      string
  credits:   number
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  console.log('[DashboardPage] Starting render')

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('[DashboardPage] Missing Supabase env vars')
    return (
      <div className="px-4 sm:px-6 py-16 max-w-2xl mx-auto">
        <div className="bg-muted border border-border rounded-2xl p-6">
          <p className="font-display text-sm text-foreground mb-1">Missing configuration</p>
          <p className="font-body text-xs text-[--text-muted]">Supabase environment variables are not set.</p>
        </div>
      </div>
    )
  }

  let userId: string | null = null
  let userEmail: string | null = null
  let profile: Profile | null = null
  let videos: VideoProject[] = []
  let errorMsg: string | null = null

  try {
    const supabase = createServerComponentClient<Database>({ cookies })

    const { data: authData, error: authError } = await supabase.auth.getUser()

    if (authError) {
      errorMsg = `Auth: ${authError.message}`
    } else if (!authData?.user) {
      return null
    } else {
      userId    = authData.user.id
      userEmail = authData.user.email ?? null

      const [profileResult, videosResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('full_name, plan, credits')
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('videos')
          .select('id, title, module, style, status, output_url, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50),
      ])

      profile = (profileResult.data as Profile | null) ?? null
      videos  = ((videosResult.data ?? []) as VideoProject[])

      if (profileResult.error)  console.error('[DashboardPage] Profile error:', profileResult.error.message)
      if (videosResult.error)   console.error('[DashboardPage] Videos error:', videosResult.error.message)
    }
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    console.error('[DashboardPage] Uncaught error:', msg)
    errorMsg = msg
  }

  if (!userId) return null

  const firstName  = (profile?.full_name ?? userEmail ?? 'User').split(/[\s@]/)[0] ?? 'User'
  const plan       = profile?.plan ?? 'free'
  const credits    = profile?.credits ?? 0
  const draftCount = videos.filter(v => v.status === 'draft').length
  const hasProjects = videos.length > 0

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto space-y-5">

      {/* ── 1. Promo banner (dismissable, ~48px) ────────────── */}
      <PromoBanner />

      {/* ── 2. Greeting + New project button ────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <DashboardGreeting firstName={firstName} />
        <NewProjectDropdown />
      </div>

      {/* ── 3. Credits banner ────────────────────────────────── */}
      <CreditsBanner plan={plan} creditsLeft={credits} />

      {/* ── 4. Quick actions — 4 cards on 1 row ─────────────── */}
      <QuickActions />

      {/* ── Fetch error ──────────────────────────────────────── */}
      {errorMsg && (
        <Card variant="elevated" className="flex items-center gap-4 py-5 px-6">
          <div className="bg-error/10 rounded-xl p-3 shrink-0">
            <AlertCircle className="text-error" size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display text-sm text-foreground">Can&apos;t load your projects right now</p>
            <p className="font-body text-xs text-[--text-muted] mt-1 font-mono">{errorMsg}</p>
          </div>
          <Button variant="secondary" size="sm" leftIcon={<RefreshCw size={14} />} asChild>
            <Link href="/dashboard">Retry</Link>
          </Button>
        </Card>
      )}

      {/* ── 5. Projects grid or empty state ──────────────────── */}
      {!errorMsg && (
        hasProjects ? (
          <ProjectsSection videos={videos} draftCount={draftCount} />
        ) : (
          <EmptyDashboard firstName={firstName} />
        )
      )}
    </div>
  )
}
