import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { Plus, Video, Loader2, AlertCircle, Check, Sparkles, Clapperboard } from 'lucide-react'
import type { Database } from '@/lib/database.types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Faceless Videos — CLYRO' }

type FacelessVideo = {
  id: string
  title: string | null
  status: string
  output_url: string | null
  thumbnail_url: string | null
  created_at: string
  duration_seconds: number | null
}

export default async function FacelessIndexPage() {
  const supabase = createServerComponentClient<Database>({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  let videos: FacelessVideo[] = []
  try {
    const { data } = await supabase
      .from('videos')
      .select('id, title, status, output_url, thumbnail_url, created_at, duration_seconds')
      .eq('user_id', user?.id ?? '')
      .eq('module', 'faceless')
      .neq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(60)
    videos = (data ?? []) as FacelessVideo[]
  } catch {
    videos = []
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Video size={14} className="text-blue-500" />
              <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-secondary] font-semibold">Faceless Videos</p>
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground">Your faceless videos</h1>
            <p className="font-body text-sm text-[--text-secondary] mt-1 max-w-xl">
              Script-driven narrated videos with stock footage and captions.
              ElevenLabs + stock library + Remotion, orchestrated by Claude.
            </p>
          </div>

          {/* CTA header — prominent gradient button → Faceless hub */}
          <Link href="/faceless/hub" className="group relative">
            <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-500 opacity-70 blur-sm group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 via-indigo-600 to-cyan-600 text-white font-body text-sm font-semibold shadow-lg">
              <Plus size={16} className="group-hover:rotate-90 transition-transform duration-200" />
              New project
            </div>
          </Link>
        </div>

        {/* Projects grid */}
        {videos.length === 0 ? (
          <Card variant="elevated" padding="xl" className="flex flex-col items-center text-center gap-5 py-20">
            <div className="relative">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 blur-2xl" />
              <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500/15 to-cyan-500/15 border border-border flex items-center justify-center">
                <Video size={32} className="text-blue-500" />
              </div>
            </div>
            <div className="space-y-1">
              <h2 className="font-display text-xl font-bold text-foreground">No Faceless video yet</h2>
              <p className="font-body text-sm text-[--text-secondary] max-w-md">
                Start from a script. CLYRO picks the footage, generates the narration and ships a ready-to-post video in minutes.
              </p>
            </div>
            <Link href="/faceless/hub" className="group relative mt-2">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-500 opacity-60 blur-md group-hover:opacity-90 transition-opacity duration-300" />
              <div className="relative flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-gradient-to-r from-blue-500 via-indigo-600 to-cyan-600 text-white font-body text-base font-semibold shadow-xl">
                <Clapperboard size={18} />
                Create my first Faceless video
                <Sparkles size={14} className="opacity-80" />
              </div>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <NewProjectCard />
            {videos.map((v) => <FacelessVideoCard key={v.id} video={v} />)}
          </div>
        )}
      </div>
    </div>
  )
}

// ── New project card ─────────────────────────────────────────────────────

function NewProjectCard() {
  return (
    <Link href="/faceless/hub" className="group relative block rounded-2xl overflow-hidden aspect-[4/3]">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-indigo-600 to-cyan-600 opacity-80 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="absolute inset-[1.5px] rounded-2xl bg-card group-hover:bg-card/90 transition-colors duration-300" />
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-indigo-500/8 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 via-indigo-500 to-cyan-500 blur-lg opacity-50 group-hover:opacity-80 transition-opacity duration-300" />
          <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 via-indigo-600 to-cyan-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
            <Plus size={24} className="text-white group-hover:rotate-90 transition-transform duration-300" />
          </div>
        </div>
        <div className="text-center">
          <p className="font-display text-base font-bold text-foreground group-hover:text-white transition-colors duration-200">
            New project
          </p>
          <p className="font-body text-xs text-[--text-muted] mt-0.5 group-hover:text-white/60 transition-colors duration-200">
            From a script
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-blue-500/15 to-cyan-500/15 border border-blue-500/20 group-hover:from-blue-500/25 group-hover:to-cyan-500/25 transition-all duration-200">
          <Sparkles size={10} className="text-blue-400" />
          <span className="font-mono text-[10px] text-blue-400 tracking-wider uppercase">Faceless</span>
        </div>
      </div>
    </Link>
  )
}

// ── Project card ─────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; icon?: React.ReactNode }> = {
  pending:    { label: 'Pending',    color: 'bg-muted text-[--text-muted]' },
  processing: { label: 'Processing', color: 'bg-blue-500/15 text-blue-500',   icon: <Loader2 size={10} className="animate-spin" /> },
  storyboard: { label: 'Storyboard', color: 'bg-blue-500/15 text-blue-500',   icon: <Loader2 size={10} className="animate-spin" /> },
  visuals:    { label: 'Visuals',    color: 'bg-amber-500/15 text-amber-500', icon: <Loader2 size={10} className="animate-spin" /> },
  audio:      { label: 'Audio',      color: 'bg-purple-500/15 text-purple-500', icon: <Loader2 size={10} className="animate-spin" /> },
  assembly:   { label: 'Rendering',  color: 'bg-purple-500/15 text-purple-500', icon: <Loader2 size={10} className="animate-spin" /> },
  done:       { label: 'Ready',      color: 'bg-emerald-500/15 text-emerald-500', icon: <Check size={10} /> },
  error:      { label: 'Error',      color: 'bg-error/15 text-error',         icon: <AlertCircle size={10} /> },
}

function FacelessVideoCard({ video }: { video: FacelessVideo }) {
  const meta = STATUS_META[video.status] ?? STATUS_META.pending
  const relativeDate = formatRelative(video.created_at)

  return (
    <Link
      href={`/faceless/${video.id}`}
      className="card-interactive rounded-2xl border border-border bg-card overflow-hidden block"
    >
      <div className="aspect-video relative bg-gradient-to-br from-blue-500/20 via-indigo-500/10 to-cyan-500/20 flex items-center justify-center">
        <div className="absolute inset-0 grid-bg opacity-[0.04]" />
        {video.output_url ? (
          <video src={video.output_url} className="absolute inset-0 w-full h-full object-cover" muted />
        ) : (
          <Video size={32} className="text-white/40 relative" />
        )}
        <span className={`absolute top-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${meta.color}`}>
          {meta.icon}
          {meta.label}
        </span>
        {video.duration_seconds != null && (
          <Badge className="absolute top-2 right-2 bg-black/40 text-white border-white/10" variant="neutral">
            {formatDuration(video.duration_seconds)}
          </Badge>
        )}
      </div>

      <div className="p-4 space-y-1">
        <p className="font-display font-semibold text-foreground truncate">
          {video.title ?? 'Untitled'}
        </p>
        <div className="flex items-center gap-2 text-xs font-mono text-[--text-muted]">
          <span>Faceless</span>
          <span>·</span>
          <span>{relativeDate}</span>
        </div>
      </div>
    </Link>
  )
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
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
