import { createSSRClient } from '@/lib/supabase-server'

// Dashboard components — HeyGen-pattern home: greeting → create tiles → recent projects.
// The "+ Create" dropdown now lives in the TopBar; HomeHero / HomeFeatureGrid were
// replaced by CreateTiles (one large tile per module).
import { CreateTiles }        from '@/components/dashboard/CreateTiles'
import { CreditsBanner }      from '@/components/dashboard/CreditsBanner'
import { DashboardErrorCard } from '@/components/dashboard/DashboardErrorCard'
import { EmptyDashboard }     from '@/components/dashboard/EmptyDashboard'
import { ProjectsSection }    from '@/components/dashboard/ProjectsSection'
import { PromptHero }         from '@/components/dashboard/PromptHero'
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
    const supabase = createSSRClient()

    const { data: authData, error: authError } = await supabase.auth.getUser()

    if (authError) {
      console.error('[DashboardPage] Auth error:', authError.message)
      errorMsg = 'auth_failed'
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
          .select('id, title, module, style, status, output_url, thumbnail_url, created_at')
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
    console.error('[DashboardPage] Uncaught error:', err)
    errorMsg = 'load_failed'
  }

  if (!userId) return null

  const firstName  = (profile?.full_name ?? userEmail ?? 'User').split(/[\s@]/)[0] ?? 'User'
  const plan       = profile?.plan ?? 'free'
  const credits    = profile?.credits ?? 0
  const draftCount = videos.filter(v => v.status === 'draft').length
  const hasProjects = videos.length > 0

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-6xl mx-auto space-y-8">

      {/* ── 1. Prompt-first hero — greeting + (visual) input card ─ */}
      <PromptHero firstName={firstName} />

      {/* ── 2. Create tiles — one per module (HeyGen pattern) ──── */}
      <CreateTiles />

      {/* ── 3. Credits banner — low/empty credit warnings ──────── */}
      <CreditsBanner plan={plan} creditsLeft={credits} />

      {/* ── Fetch error ──────────────────────────────────────── */}
      {errorMsg && <DashboardErrorCard />}

      {/* ── 4. Recent projects grid (realtime) or empty state ── */}
      {!errorMsg && (
        hasProjects ? (
          <ProjectsSection videos={videos} draftCount={draftCount} userId={userId} />
        ) : (
          <EmptyDashboard firstName={firstName} />
        )
      )}
    </div>
  )
}
