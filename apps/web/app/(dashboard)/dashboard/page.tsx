import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import Link from 'next/link'
import {
  AlertCircle, RefreshCw,
} from 'lucide-react'
import type { Database } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

// Dashboard components
import { PromoBanner }        from '@/components/dashboard/PromoBanner'
import { NewProjectDropdown } from '@/components/dashboard/NewProjectDropdown'
import { QuickActions }       from '@/components/dashboard/QuickActions'
import { CreditsBanner }      from '@/components/dashboard/CreditsBanner'
import { EmptyDashboard }     from '@/components/dashboard/EmptyDashboard'
import ProjectSectionsClient  from './ProjectSectionsClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Dashboard — CLYRO' }

// ── Types ──────────────────────────────────────────────────────────────────────

type VideoRow = Database['public']['Tables']['videos']['Row']

interface Profile {
  full_name: string | null
  plan: string
  credits: number
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  console.log('[DashboardPage] Starting render')

  // Guard env vars — prevents SSR crash when Supabase env vars are missing
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('[DashboardPage] Missing Supabase env vars')
    return (
      <div className="px-4 sm:px-6 py-16 max-w-2xl mx-auto">
        <div className="bg-muted border border-border rounded-2xl p-6">
          <p className="font-display text-sm text-foreground mb-1">Missing configuration</p>
          <p className="font-body text-xs text-[--text-muted]">
            Supabase environment variables aren&apos;t set on this deployment.
          </p>
        </div>
      </div>
    )
  }

  let userId: string | null = null
  let userEmail: string | null = null
  let profile: Profile | null = null
  let videos: VideoRow[] | null = null
  let errorMsg: string | null = null

  try {
    console.log('[DashboardPage] Creating Supabase client')
    const supabase = createServerComponentClient<Database>({ cookies })

    console.log('[DashboardPage] Fetching user')
    const { data: authData, error: authError } = await supabase.auth.getUser()

    if (authError) {
      console.error('[DashboardPage] Auth error:', authError.message)
      errorMsg = `Auth: ${authError.message}`
    } else if (!authData?.user) {
      console.log('[DashboardPage] No user — middleware will redirect')
      return null
    } else {
      userId    = authData.user.id
      userEmail = authData.user.email ?? null
      console.log('[DashboardPage] User authenticated:', userId)

      console.log('[DashboardPage] Fetching profile + videos')
      const [profileResult, videosResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('full_name, plan, credits')
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('videos')
          .select('id, title, module, style, status, output_url, created_at, thumbnail_url, duration_seconds')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50),
      ])

      if (profileResult.error) {
        console.error('[DashboardPage] Profile fetch error:', profileResult.error.message)
      }
      if (videosResult.error) {
        console.error('[DashboardPage] Videos fetch error:', videosResult.error.message)
      }

      profile = (profileResult.data as Profile | null) ?? null
      videos  = (videosResult.data as VideoRow[] | null) ?? []
      console.log('[DashboardPage] Loaded profile + videos, count:', videos?.length ?? 0)
    }
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    console.error('[DashboardPage] Uncaught server error:', msg, err)
    errorMsg = msg
  }

  if (!userId) {
    console.log('[DashboardPage] No userId after auth block — returning null')
    return null
  }

  const firstName   = (profile?.full_name ?? userEmail ?? 'User').split(/[\s@]/)[0] ?? 'User'
  const plan        = profile?.plan ?? 'free'
  const credits     = profile?.credits ?? 0
  const hasProjects = (videos?.length ?? 0) > 0

  console.log('[DashboardPage] Rendering JSX')

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto space-y-6">

      {/* ── Greeting + New project button ─────────────────────── */}
      <div className="flex items-center justify-between gap-4 min-h-[36px]">
        <p className="font-body text-sm text-[--text-secondary]">
          Hi <span className="text-foreground font-medium">{firstName}</span>{' '}
          <span className="text-[--text-muted]">· ready to create?</span>
        </p>
        <NewProjectDropdown />
      </div>

      {/* ── Promo banner (dismissable) ────────────────────────── */}
      <PromoBanner />

      {/* ── Credits (always visible, contextualized) ─────────── */}
      <CreditsBanner credits={credits} plan={plan} />

      {/* ── Quick actions — 4 cards ───────────────────────────── */}
      <div className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-widest text-[--text-muted]">
          Create
        </p>
        <QuickActions />
      </div>

      {/* ── Fetch error banner ─────────────────────────────────── */}
      {errorMsg && (
        <Card variant="elevated" className="flex items-center gap-4 py-5 px-6">
          <div className="bg-error/10 rounded-xl p-3 shrink-0">
            <AlertCircle className="text-error" size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display text-sm text-foreground">
              Can&apos;t load your projects right now
            </p>
            <p className="font-body text-xs text-[--text-muted] mt-1 font-mono">
              {errorMsg}
            </p>
          </div>
          <Button variant="secondary" size="sm" leftIcon={<RefreshCw size={14} />} asChild>
            <Link href="/dashboard">Retry</Link>
          </Button>
        </Card>
      )}

      {/* ── Projects or empty state ───────────────────────────── */}
      {!errorMsg && (
        hasProjects ? (
          <ProjectSectionsClient
            userId={userId}
            videos={videos ?? []}
          />
        ) : (
          <EmptyDashboard firstName={firstName} />
        )
      )}
    </div>
  )
}
