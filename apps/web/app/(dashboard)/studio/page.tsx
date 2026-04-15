import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { Plus, Film, Loader2, AlertCircle, Check } from 'lucide-react'
import type { Database } from '@/lib/database.types'
import type { StudioProject } from '@/lib/studio-types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'AI Avatar Studio — CLYRO' }

export default async function StudioIndexPage() {
  const supabase = createServerComponentClient<Database>({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  let projects: StudioProject[] = []
  try {
    // Cast via unknown — studio_projects isn't in the generated Database types yet
    const { data } = await (supabase as unknown as {
      from: (table: string) => {
        select: (s: string) => {
          eq: (col: string, val: string) => {
            order: (col: string, opts: { ascending: boolean }) => Promise<{ data: StudioProject[] | null }>
          }
        }
      }
    })
      .from('studio_projects')
      .select('*')
      .eq('user_id', user?.id ?? '')
      .order('created_at', { ascending: false })
    projects = (data ?? []) as StudioProject[]
  } catch {
    // Table may not exist if migration hasn't been applied — show empty state
    projects = []
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Film size={14} className="text-rose-500" />
              <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-secondary] font-semibold">AI Avatar Studio</p>
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground">Your avatar projects</h1>
            <p className="font-body text-sm text-[--text-secondary] mt-1 max-w-xl">
              Videos assembled with your AI avatar + typed scenes (infographic, demo, typography, b-roll).
              HeyGen + ElevenLabs + Remotion, orchestrated by Claude.
            </p>
          </div>
          <Button variant="primary" size="md" leftIcon={<Plus size={14} />} asChild>
            <Link href="/studio/new">New project</Link>
          </Button>
        </div>

        {/* Projects grid */}
        {projects.length === 0 ? (
          <Card variant="elevated" padding="xl" className="flex flex-col items-center text-center gap-5 py-20">
            <div className="relative">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-rose-500/20 to-purple-500/20 blur-2xl" />
              <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-rose-500/15 to-purple-500/15 border border-border flex items-center justify-center">
                <Film size={32} className="text-rose-500" />
              </div>
            </div>
            <div className="space-y-1">
              <h2 className="font-display text-xl font-bold text-foreground">No Studio project yet</h2>
              <p className="font-body text-sm text-[--text-secondary] max-w-md">
                Start from a script or paste a YouTube URL. CLYRO builds a complete avatar video in minutes,
                with each scene regeneratable independently.
              </p>
            </div>
            <Button variant="primary" size="md" leftIcon={<Plus size={14} />} asChild>
              <Link href="/studio/new">Create my first Studio project</Link>
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => <StudioProjectCard key={p.id} project={p} />)}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Project card ────────────────────────────────────────────────────────

const STATUS_META: Record<StudioProject['status'], { label: string; color: string; icon?: React.ReactNode }> = {
  draft:      { label: 'Draft',       color: 'bg-muted text-[--text-muted]' },
  analyzing:  { label: 'Analyzing',   color: 'bg-blue-500/15 text-blue-500',     icon: <Loader2 size={10} className="animate-spin" /> },
  generating: { label: 'Generating',  color: 'bg-amber-500/15 text-amber-500',   icon: <Loader2 size={10} className="animate-spin" /> },
  editing:    { label: 'Ready to edit', color: 'bg-blue-500/15 text-blue-500' },
  rendering:  { label: 'Rendering',   color: 'bg-purple-500/15 text-purple-500', icon: <Loader2 size={10} className="animate-spin" /> },
  done:       { label: 'Ready',       color: 'bg-emerald-500/15 text-emerald-500', icon: <Check size={10} /> },
  error:      { label: 'Error',       color: 'bg-error/15 text-error', icon: <AlertCircle size={10} /> },
}

function StudioProjectCard({ project }: { project: StudioProject }) {
  const meta = STATUS_META[project.status]
  const relativeDate = formatRelative(project.created_at)

  return (
    <Link
      href={`/studio/${project.id}/editor`}
      className="card-interactive rounded-2xl border border-border bg-card overflow-hidden block"
    >
      {/* Preview strip */}
      <div className="aspect-video relative bg-gradient-to-br from-rose-500/20 via-purple-500/10 to-blue-500/20 flex items-center justify-center">
        <div className="absolute inset-0 grid-bg opacity-[0.04]" />
        {project.final_video_url ? (
          <video src={project.final_video_url} className="absolute inset-0 w-full h-full object-cover" muted />
        ) : (
          <Film size={32} className="text-white/40 relative" />
        )}
        <span className={`absolute top-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${meta.color}`}>
          {meta.icon}
          {meta.label}
        </span>
        <Badge className="absolute top-2 right-2 bg-black/40 text-white border-white/10" variant="neutral">
          {project.format.replace('_', ':')}
        </Badge>
      </div>

      <div className="p-4 space-y-1">
        <p className="font-display font-semibold text-foreground truncate">
          {project.title}
        </p>
        <div className="flex items-center gap-2 text-xs font-mono text-[--text-muted]">
          <span>{project.input_type === 'youtube_url' ? 'From YouTube' : 'From script'}</span>
          <span>·</span>
          <span>{relativeDate}</span>
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
