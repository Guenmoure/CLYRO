import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { Plus, Palette, Sparkles, Clapperboard, Star } from 'lucide-react'
import type { Database } from '@/lib/database.types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Brand Kit — CLYRO' }

type BrandKit = {
  id: string
  name: string | null
  primary_color: string | null
  secondary_color: string | null
  is_default: boolean | null
  logo_url: string | null
  created_at: string
}

export default async function BrandIndexPage() {
  const supabase = createServerComponentClient<Database>({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  let kits: BrandKit[] = []
  try {
    const { data } = await supabase
      .from('brand_kits')
      .select('id, name, primary_color, secondary_color, is_default, logo_url, created_at')
      .eq('user_id', user?.id ?? '')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })
    kits = (data ?? []) as BrandKit[]
  } catch {
    kits = []
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Palette size={14} className="text-cyan-500" />
              <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-secondary] font-semibold">Brand Kit</p>
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground">Your brand kits</h1>
            <p className="font-body text-sm text-[--text-secondary] mt-1 max-w-xl">
              Lock your colors, logo and voice so every video stays on-brand.
              One default kit, as many variants as you like.
            </p>
          </div>

          {/* CTA header → Brand hub */}
          <Link href="/brand/hub" className="group relative">
            <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 opacity-70 blur-sm group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-600 to-emerald-600 text-white font-body text-sm font-semibold shadow-lg">
              <Plus size={16} className="group-hover:rotate-90 transition-transform duration-200" />
              New project
            </div>
          </Link>
        </div>

        {/* Kits grid */}
        {kits.length === 0 ? (
          <Card variant="elevated" padding="xl" className="flex flex-col items-center text-center gap-5 py-20">
            <div className="relative">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 blur-2xl" />
              <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-500/15 to-emerald-500/15 border border-border flex items-center justify-center">
                <Palette size={32} className="text-cyan-500" />
              </div>
            </div>
            <div className="space-y-1">
              <h2 className="font-display text-xl font-bold text-foreground">No Brand Kit yet</h2>
              <p className="font-body text-sm text-[--text-secondary] max-w-md">
                Create a kit once and every video — Faceless, Motion, Avatar — will pick up your colors, logo and voice automatically.
              </p>
            </div>
            <Link href="/brand/hub" className="group relative mt-2">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 opacity-60 blur-md group-hover:opacity-90 transition-opacity duration-300" />
              <div className="relative flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-600 to-emerald-600 text-white font-body text-base font-semibold shadow-xl">
                <Clapperboard size={18} />
                Create my first Brand Kit
                <Sparkles size={14} className="opacity-80" />
              </div>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <NewKitCard />
            {kits.map((k) => <BrandKitCard key={k.id} kit={k} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function NewKitCard() {
  return (
    <Link href="/brand/hub" className="group relative block rounded-2xl overflow-hidden aspect-[4/3]">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 via-teal-600 to-emerald-600 opacity-80 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="absolute inset-[1.5px] rounded-2xl bg-card group-hover:bg-card/90 transition-colors duration-300" />
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-teal-500/8 to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-500 blur-lg opacity-50 group-hover:opacity-80 transition-opacity duration-300" />
          <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 via-teal-600 to-emerald-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
            <Plus size={24} className="text-white group-hover:rotate-90 transition-transform duration-300" />
          </div>
        </div>
        <div className="text-center">
          <p className="font-display text-base font-bold text-foreground group-hover:text-white transition-colors duration-200">
            New project
          </p>
          <p className="font-body text-xs text-[--text-muted] mt-0.5 group-hover:text-white/60 transition-colors duration-200">
            Colors, logo, voice
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-cyan-500/15 to-emerald-500/15 border border-cyan-500/20 group-hover:from-cyan-500/25 group-hover:to-emerald-500/25 transition-all duration-200">
          <Sparkles size={10} className="text-cyan-400" />
          <span className="font-mono text-[10px] text-cyan-400 tracking-wider uppercase">Brand</span>
        </div>
      </div>
    </Link>
  )
}

function BrandKitCard({ kit }: { kit: BrandKit }) {
  const primary = kit.primary_color ?? '#0891b2'
  const secondary = kit.secondary_color ?? '#0d9488'

  return (
    <Link
      href="/brand/hub"
      className="card-interactive rounded-2xl border border-border bg-card overflow-hidden block"
    >
      {/* Preview: colors + logo */}
      <div
        className="aspect-video relative flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${primary}33, ${secondary}33)` }}
      >
        <div className="absolute inset-0 grid-bg opacity-[0.04]" />
        {kit.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={kit.logo_url} alt={kit.name ?? 'Brand kit'} className="max-w-[60%] max-h-[60%] object-contain relative" />
        ) : (
          <Palette size={32} className="text-white/60 relative" />
        )}
        {/* Color swatches */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1">
          <span className="w-4 h-4 rounded-full border border-white/30" style={{ background: primary }} />
          <span className="w-4 h-4 rounded-full border border-white/30" style={{ background: secondary }} />
        </div>
        {kit.is_default && (
          <Badge className="absolute top-2 right-2 bg-amber-500/90 text-white border-0" variant="neutral">
            <Star size={10} className="mr-1 fill-current" />
            Default
          </Badge>
        )}
      </div>

      <div className="p-4 space-y-1">
        <p className="font-display font-semibold text-foreground truncate">
          {kit.name ?? 'Untitled kit'}
        </p>
        <div className="flex items-center gap-2 text-xs font-mono text-[--text-muted]">
          <span>Brand</span>
          <span>·</span>
          <span>{formatRelative(kit.created_at)}</span>
        </div>
      </div>
    </Link>
  )
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}
