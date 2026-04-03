import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { Video, Wand2, Mic2, Play, Clock } from 'lucide-react'
import type { Database } from '@/lib/database.types'

export const metadata = { title: 'Dashboard — CLYRO' }

type VideoRow = Database['public']['Tables']['videos']['Row']

const MODULE_GRADIENTS: Record<string, string> = {
  faceless: 'from-clyro-blue/20 via-navy-800 to-navy-900',
  motion:   'from-clyro-purple/20 via-navy-800 to-navy-900',
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  done:       { label: 'Completed',   cls: 'bg-green-500/15 text-green-400 border-green-500/25' },
  processing: { label: 'Processing…', cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25' },
  storyboard: { label: 'Processing…', cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25' },
  visuals:    { label: 'Rendering…',  cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25' },
  audio:      { label: 'Rendering…',  cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25' },
  assembly:   { label: 'Rendering…',  cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25' },
  pending:    { label: 'Pending',      cls: 'bg-white/8 text-white/40 border-white/10' },
  error:      { label: 'Error',        cls: 'bg-red-500/15 text-red-400 border-red-500/25' },
}

export default async function DashboardPage() {
  const supabase = createServerComponentClient<Database>({ cookies })
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: recentVideos } = (await supabase
    .from('videos')
    .select('*')
    .eq('user_id', user?.id ?? '')
    .order('created_at', { ascending: false })
    .limit(6)) as { data: VideoRow[] | null; error: unknown }

  return (
    <div className="flex-1 overflow-y-auto bg-navy-950 px-8 py-8">
      <div className="max-w-5xl mx-auto space-y-10 animate-fade-in">

        {/* Create New Video */}
        <div>
          <h2 className="font-display text-xl font-bold text-white mb-5">
            Create New Video
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <CreationCard
              href="/faceless/new"
              icon={<Video size={36} strokeWidth={1.2} className="text-clyro-cyan" />}
              iconBg="bg-gradient-to-br from-clyro-blue/20 to-clyro-cyan/10"
              accent="blue"
              title="Faceless Video"
              description="YouTube, TikTok, Instagram — 6 visual styles, voiceover included."
            />
            <CreationCard
              href="/motion/new"
              icon={<Wand2 size={36} strokeWidth={1.2} className="text-clyro-purple" />}
              iconBg="bg-gradient-to-br from-clyro-purple/20 to-clyro-blue/10"
              accent="purple"
              title="Motion Design"
              description="After Effects-style animations from a script or voiceover."
              featured
            />
            <CreationCard
              href="/voices"
              icon={<Mic2 size={36} strokeWidth={1.2} className="text-clyro-cyan" />}
              iconBg="bg-gradient-to-br from-clyro-cyan/20 to-navy-800"
              accent="cyan"
              title="AI Voiceover"
              description="Public voice library + your cloned voices for any generation."
            />
          </div>
        </div>

        {/* Recent Projects */}
        {recentVideos && recentVideos.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl font-bold text-white">
                Recent Projects
              </h2>
              <Link
                href="/projects"
                className="text-sm font-medium text-clyro-blue hover:text-clyro-cyan transition-colors"
              >
                See all →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {recentVideos.map((video) => (
                <ProjectCard key={video.id} video={video} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {(!recentVideos || recentVideos.length === 0) && (
          <div className="text-center py-16">
            <Play size={40} className="mx-auto mb-3 text-white/20" />
            <p className="font-body text-sm text-white/30">Your projects will appear here.</p>
          </div>
        )}

      </div>
    </div>
  )
}

/* ── Creation Card ─────────────────────────────────────────── */
type Accent = 'blue' | 'purple' | 'cyan'

const ACCENT_STYLES: Record<Accent, { border: string; glow: string; bar: string }> = {
  blue:   { border: 'border-clyro-blue/30',   glow: 'hover:shadow-[0_0_28px_rgba(59,142,240,0.2)]',   bar: 'from-clyro-blue to-transparent' },
  purple: { border: 'border-clyro-purple/50', glow: 'hover:shadow-[0_0_28px_rgba(155,92,246,0.3)]',   bar: 'from-clyro-purple to-transparent' },
  cyan:   { border: 'border-clyro-cyan/30',   glow: 'hover:shadow-[0_0_28px_rgba(56,232,255,0.18)]',  bar: 'from-clyro-cyan to-transparent' },
}

function CreationCard({
  href,
  icon,
  iconBg,
  accent,
  title,
  description,
  featured,
}: {
  href: string
  icon: React.ReactNode
  iconBg: string
  accent: Accent
  title: string
  description: string
  featured?: boolean
}) {
  const s = ACCENT_STYLES[accent]
  return (
    <Link
      href={href}
      className={`group relative flex flex-col items-center text-center bg-navy-900 border ${s.border} ${s.glow} rounded-2xl p-6 transition-all duration-200 hover:scale-[1.02] overflow-hidden`}
    >
      {/* Bottom accent line */}
      <span className={`absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r ${s.bar} opacity-70`} />

      {/* Icon */}
      <div className={`w-20 h-20 rounded-2xl ${iconBg} flex items-center justify-center mb-5`}>
        {icon}
      </div>

      <h3 className="font-display text-base font-bold text-white mb-1.5">{title}</h3>
      <p className="font-body text-xs text-white/40 leading-relaxed">{description}</p>

      {featured && (
        <span className="absolute top-3 right-3 font-mono text-[9px] uppercase tracking-wider bg-clyro-purple/20 text-clyro-purple border border-clyro-purple/30 px-1.5 py-0.5 rounded-full">
          Popular
        </span>
      )}
    </Link>
  )
}

/* ── Project Card ──────────────────────────────────────────── */
function ProjectCard({ video }: { video: VideoRow }) {
  const bg = MODULE_GRADIENTS[video.module] ?? 'from-navy-700 via-navy-800 to-navy-900'
  const status = STATUS_META[video.status] ?? STATUS_META.pending
  const isDone       = video.status === 'done'
  const isProcessing = !isDone && video.status !== 'pending' && video.status !== 'error'

  const date = new Date(video.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="group relative bg-navy-900 border border-navy-700 rounded-2xl overflow-hidden hover:border-navy-600 transition-all duration-200">
      {/* Thumbnail */}
      <div className={`relative h-36 bg-gradient-to-br ${bg} flex items-center justify-center`}>
        {video.module === 'motion'
          ? <Wand2 size={32} strokeWidth={1} className="text-clyro-purple/35" />
          : <Video  size={32} strokeWidth={1} className="text-clyro-blue/35"   />
        }

        {/* Play overlay on hover when done */}
        {isDone && video.output_url && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Play size={16} className="text-white ml-0.5" fill="white" />
            </div>
          </div>
        )}

        {/* Progress bar bottom */}
        {isProcessing && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-navy-700">
            <div className="h-full w-1/2 bg-gradient-to-r from-clyro-blue to-clyro-purple animate-pulse" />
          </div>
        )}
        {isDone && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500/50" />
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="font-body text-sm font-medium text-white truncate mb-2">
          {video.title ?? 'Untitled'}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className={`inline-flex items-center font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${status.cls}`}>
            {status.label}
          </span>
          <span className="flex items-center gap-1 font-mono text-[10px] text-white/25">
            <Clock size={10} />
            {date}
          </span>
        </div>
      </div>
    </div>
  )
}
