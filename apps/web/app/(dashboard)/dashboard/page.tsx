import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import Link from 'next/link'
import {
  Zap, ArrowRight, AlertCircle, RefreshCw,
} from 'lucide-react'
import type { Database } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { HeroBanner } from '@/components/dashboard/HeroBanner'
import { FeatureCards } from '@/components/dashboard/FeatureCards'
import ProjectSectionsClient from './ProjectSectionsClient'

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

  // Guard env vars — évite le crash SSR si Vercel n'a pas les variables Supabase
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
      userId = authData.user.id
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
          .select('id, title, module, style, status, output_url, created_at')
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

  const firstName = (profile?.full_name ?? userEmail ?? 'là').split(/[\s@]/)[0] ?? 'là'
  const plan      = profile?.plan ?? 'free'
  const credits   = profile?.credits ?? 0
  const isStarter = plan !== 'pro' && plan !== 'studio'

  console.log('[DashboardPage] Rendering JSX')

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto space-y-10">

      {/* ── Greeting (subtle, no big block) ─────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="font-body text-sm text-[--text-secondary]">
          Hi <span className="text-foreground font-medium">{firstName}</span> · ready to create?
        </p>
      </div>

      {/* ── Hero carousel ──────────────────────────────────────────── */}
      <HeroBanner />

      {/* ── Plan banner — Starter only — demoted to info strip, no primary CTA ──
           (The HeroBanner above already has the primary CTA; this is just a nudge.) */}
      {isStarter && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/50 px-4 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <Zap className="text-warning shrink-0" size={14} />
            <p className="font-body text-xs text-[--text-secondary] truncate">
              <span className="text-foreground font-medium">Starter plan</span>
              <span className="mx-2 text-[--text-muted]">·</span>
              {credits} credit{credits !== 1 ? 's' : ''} left this month
            </p>
          </div>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1 shrink-0 text-xs font-medium text-blue-500 hover:text-blue-400 transition-colors"
          >
            Upgrade to Pro
            <ArrowRight size={12} />
          </Link>
        </div>
      )}

      {/* ── Feature cards ──────────────────────────────────────────── */}
      <FeatureCards />

      {/* ── Fetch error banner ─────────────────────────────────────── */}
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

      {/* ── Recent / Drafts (client-only, no SSR) ────────────────── */}
      {!errorMsg && (
        <ProjectSectionsClient
          userId={userId}
          videos={videos ?? []}
        />
      )}
    </div>
  )
}
