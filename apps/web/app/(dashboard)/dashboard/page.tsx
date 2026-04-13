import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import Link from 'next/link'
import {
  Plus, Zap, ArrowRight, Video, Sparkles, Palette, AlertCircle, RefreshCw,
} from 'lucide-react'
import type { Database } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ProjectSections } from './ProjectSections'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Dashboard — CLYRO' }

// ── Types ──────────────────────────────────────────────────────────────────────

type VideoRow = Database['public']['Tables']['videos']['Row']

interface Profile {
  full_name: string | null
  plan: string
  credits: number
}

// ── Module config ──────────────────────────────────────────────────────────────

const MODULES = [
  {
    key:       'faceless',
    label:     'Faceless Videos',
    icon:      Video,
    iconColor: 'text-blue-400',
    iconBg:    'bg-blue-500/10',
    href:      '/faceless',
    newHref:   '/faceless/new',
  },
  {
    key:       'motion',
    label:     'Motion Design',
    icon:      Sparkles,
    iconColor: 'text-purple-400',
    iconBg:    'bg-purple-500/10',
    href:      '/motion',
    newHref:   '/motion/new',
  },
  {
    key:       'brand',
    label:     'Brand Kit',
    icon:      Palette,
    iconColor: 'text-cyan-400',
    iconBg:    'bg-cyan-400/10',
    href:      '/brand',
    newHref:   '/brand',
  },
] as const

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = createServerComponentClient<Database>({ cookies })
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return null // middleware handles redirect
  }

  const [profileResult, videosResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, plan, credits')
      .eq('id', user.id)
      .single(),
    supabase
      .from('videos')
      .select('id, title, module, style, status, output_url, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const profile  = profileResult.data as Profile | null
  const videos   = videosResult.data as VideoRow[] | null
  const fetchErr = videosResult.error

  const firstName = (profile?.full_name ?? user.email ?? 'là').split(/[\s@]/)[0]
  const plan      = profile?.plan ?? 'free'
  const credits   = profile?.credits ?? 0
  const isStarter = plan !== 'pro' && plan !== 'studio'

  return (
    <div className="px-4 sm:px-6 py-8 max-w-7xl mx-auto space-y-10">

      {/* ── Welcome header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
        <div>
          <h1 className="font-display text-2xl text-foreground">
            Bonjour, {firstName} 👋
          </h1>
          <p className="font-body text-sm text-[--text-secondary] mt-1">
            Voici un aperçu de ton espace CLYRO.
          </p>
        </div>
        <Button variant="primary" size="md" leftIcon={<Plus size={16} />} asChild>
          <Link href="/faceless/new">Nouveau projet</Link>
        </Button>
      </div>

      {/* ── Plan banner — Starter only ─────────────────────────────── */}
      {isStarter && (
        <Card variant="gradient" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 px-6">
          <div className="flex items-center gap-3">
            <div className="bg-warning/15 rounded-xl p-2 shrink-0">
              <Zap className="text-warning" size={18} />
            </div>
            <div>
              <p className="font-display text-sm text-foreground">
                Tu es sur le plan Starter
              </p>
              <p className="font-body text-xs text-[--text-secondary] mt-0.5">
                Il te reste {credits} crédit{credits !== 1 ? 's' : ''} ce mois.
                Passe au Pro pour une création illimitée.
              </p>
            </div>
          </div>
          <Button variant="primary" size="sm" rightIcon={<ArrowRight size={13} />} asChild>
            <Link href="/settings?tab=billing">Passer au Pro — 19€/mois</Link>
          </Button>
        </Card>
      )}

      {/* ── Fetch error ────────────────────────────────────────────── */}
      {fetchErr && (
        <Card variant="elevated" className="flex items-center gap-4 py-5 px-6">
          <div className="bg-error/10 rounded-xl p-3 shrink-0">
            <AlertCircle className="text-error" size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display text-sm text-foreground">
              Impossible de charger tes projets
            </p>
            <p className="font-body text-xs text-[--text-muted] mt-1">
              Une erreur est survenue. Actualise la page ou contacte le support si le problème persiste.
            </p>
          </div>
          <Button variant="secondary" size="sm" leftIcon={<RefreshCw size={14} />} asChild>
            <Link href="/dashboard">Réessayer</Link>
          </Button>
        </Card>
      )}

      {/* ── Project sections (client component for realtime) ────────── */}
      {!fetchErr && (
        <ProjectSections
          userId={user.id}
          videos={(videos ?? []) as VideoRow[]}
          modules={MODULES as unknown as typeof MODULES}
        />
      )}
    </div>
  )
}
