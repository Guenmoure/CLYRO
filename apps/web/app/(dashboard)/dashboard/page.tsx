import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { Video, Wand2, Palette, Play, Clock, ArrowRight, Plus, Sparkles } from 'lucide-react'
import type { Database } from '@/lib/database.types'
import { Reveal } from '@/components/ui/reveal'

export const metadata = { title: 'Dashboard — CLYRO' }

type VideoRow = Database['public']['Tables']['videos']['Row']

const STATUS_META: Record<string, { label: string; dot: string; bg: string }> = {
  done:       { label: 'Completed',  dot: 'bg-emerald-500', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  processing: { label: 'Processing', dot: 'bg-amber-500',   bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  storyboard: { label: 'Processing', dot: 'bg-amber-500',   bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  visuals:    { label: 'Rendering',  dot: 'bg-amber-500',   bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  audio:      { label: 'Rendering',  dot: 'bg-amber-500',   bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  assembly:   { label: 'Rendering',  dot: 'bg-amber-500',   bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  pending:    { label: 'Pending',    dot: 'bg-gray-400',    bg: 'bg-gray-50 text-gray-500 border-gray-200' },
  error:      { label: 'Error',      dot: 'bg-red-500',     bg: 'bg-red-50 text-red-600 border-red-200' },
}

export default async function DashboardPage() {
  const supabase = createServerComponentClient<Database>({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  const [profileResult, recentVideosResult] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user?.id ?? '').single(),
    supabase.from('videos').select('*').eq('user_id', user?.id ?? '').order('created_at', { ascending: false }).limit(6),
  ])

  const profile      = profileResult.data as { full_name: string | null } | null
  const recentVideos = recentVideosResult.data as VideoRow[] | null
  const firstName    = (profile?.full_name ?? user?.email ?? 'there').split(' ')[0]

  return (
    <div className="flex-1 overflow-y-auto bg-[#F7F8FA]">

      {/* ── Hero Banner — HeyGen style ─────────────────────────── */}
      <div className="px-8 pt-8 pb-6">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div
              className="relative rounded-2xl overflow-hidden px-8 py-8"
              style={{
                background: 'linear-gradient(135deg, #F0EAFF 0%, #E8F3FF 50%, #F5F0FF 100%)',
                border: '1px solid #E2D9F3',
              }}
            >
              {/* Soft glow blobs */}
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-30 pointer-events-none"
                   style={{ background: 'radial-gradient(circle, #8A57EA30, transparent 70%)', transform: 'translate(30%, -30%)' }} />
              <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-20 pointer-events-none"
                   style={{ background: 'radial-gradient(circle, #4D9FFF30, transparent 70%)', transform: 'translate(-20%, 20%)' }} />

              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <div className="inline-flex items-center gap-1.5 bg-white/70 border border-[#DDD0FA] rounded-full px-3 py-1 mb-3">
                    <Sparkles size={11} className="text-[#8A57EA]" />
                    <span className="text-[10px] font-semibold text-[#8A57EA] uppercase tracking-wider">AI Video Studio</span>
                  </div>
                  <h1 className="text-2xl font-bold text-[#111827] leading-tight mb-1">
                    Hello {firstName} 👋
                  </h1>
                  <p className="text-[#6B7280] text-sm">
                    Crée ta prochaine vidéo AI — Faceless, Motion Design ou Brand.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      <div className="px-8 pb-10">
        <div className="max-w-5xl mx-auto space-y-8">

          {/* ── Module Cards — HeyGen-style 3-col ─────────────────── */}
          <div>
            <Reveal className="mb-4">
              <h2 className="text-sm font-semibold text-[#374151]">Choisir un module</h2>
            </Reveal>
            <Reveal stagger className="grid grid-cols-1 sm:grid-cols-3 gap-4">

              <ModuleCard
                href="/faceless/new"
                category="Faceless Video"
                title="Generate from a script"
                description="YouTube, TikTok, Instagram — 6 styles visuels, voiceover inclus."
                iconBg="bg-[#E8F3FF]"
                iconColor="text-[#4D9FFF]"
                icon={<Video size={22} strokeWidth={1.5} />}
                accentColor="#4D9FFF"
              />

              <ModuleCard
                href="/motion/new"
                category="Motion Design"
                title="After Effects animations"
                description="Animations fluides à partir d'un script ou voiceover."
                iconBg="bg-[#F4EFFE]"
                iconColor="text-[#8A57EA]"
                icon={<Wand2 size={22} strokeWidth={1.5} />}
                accentColor="#8A57EA"
                featured
              />

              <ModuleCard
                href="/brand"
                category="Brand Kit"
                title="Logos & Brand Assets"
                description="Génère des logos et visuels sociaux avec ta palette."
                iconBg="bg-[#E8F8F0]"
                iconColor="text-[#00B87A]"
                icon={<Palette size={22} strokeWidth={1.5} />}
                accentColor="#00B87A"
              />

            </Reveal>
          </div>

          {/* ── Recent Projects ───────────────────────────────────── */}
          {recentVideos && recentVideos.length > 0 && (
            <div>
              <Reveal className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-[#374151]">Projets récents</h2>
                <Link
                  href="/projects"
                  className="flex items-center gap-1 text-xs text-[#8A57EA] hover:text-[#7C46DC] font-medium transition-colors"
                >
                  Tout voir <ArrowRight size={12} />
                </Link>
              </Reveal>
              <Reveal stagger className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {recentVideos.map((video) => (
                  <ProjectCard key={video.id} video={video} />
                ))}
              </Reveal>
            </div>
          )}

          {/* ── Empty state ───────────────────────────────────────── */}
          {(!recentVideos || recentVideos.length === 0) && (
            <div className="bg-white border border-[#EAEAEC] rounded-2xl py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-[#F7F8FA] border border-[#EAEAEC] flex items-center justify-center mx-auto mb-3">
                <Play size={18} className="text-[#D1D5DB] ml-0.5" />
              </div>
              <p className="text-sm text-[#9CA3AF]">Tes projets apparaîtront ici</p>
              <Link
                href="/faceless/new"
                className="inline-flex items-center gap-1.5 mt-4 text-sm text-[#8A57EA] font-medium hover:text-[#7C46DC] transition-colors"
              >
                <Plus size={13} /> Créer ma première vidéo
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

/* ── Module Card — HeyGen style ──────────────────────────────────────────── */

function ModuleCard({
  href,
  category,
  title,
  description,
  icon,
  iconColor,
  iconBg,
  accentColor,
  featured,
}: {
  href: string
  category: string
  title: string
  description: string
  icon: React.ReactNode
  iconColor: string
  iconBg: string
  accentColor: string
  featured?: boolean
}) {
  return (
    <Link
      href={href}
      className="group relative bg-white border border-[#EAEAEC] rounded-2xl p-5 flex flex-col gap-4 hover:shadow-md hover:border-[#D1D5DB] transition-all duration-200 overflow-hidden"
    >
      {/* Featured ring */}
      {featured && (
        <span
          className="absolute top-3 right-3 text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border"
          style={{ color: accentColor, background: `${accentColor}15`, borderColor: `${accentColor}40` }}
        >
          Popular
        </span>
      )}

      {/* Icon */}
      <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center ${iconColor} shrink-0 transition-transform duration-200 group-hover:scale-105`}>
        {icon}
      </div>

      {/* Text */}
      <div className="flex flex-col gap-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: accentColor }}>
          {category}
        </p>
        <h3 className="text-sm font-bold text-[#111827] leading-snug">
          {title}
        </h3>
        <p className="text-xs text-[#6B7280] leading-relaxed mt-0.5">
          {description}
        </p>
      </div>

      {/* CTA */}
      <div className="mt-auto flex items-center gap-1 text-xs font-medium text-[#9CA3AF] group-hover:text-[#374151] transition-colors">
        Commencer <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  )
}

/* ── Project Card ────────────────────────────────────────────────────────── */

function ProjectCard({ video }: { video: VideoRow }) {
  const status = STATUS_META[video.status] ?? STATUS_META.pending
  const isDone       = video.status === 'done'
  const isProcessing = !isDone && video.status !== 'pending' && video.status !== 'error'

  const thumbnailBg = video.module === 'motion'
    ? 'linear-gradient(135deg, #F4EFFE 0%, #EDE0FF 100%)'
    : 'linear-gradient(135deg, #E8F3FF 0%, #D6EAFF 100%)'
  const thumbnailIcon = video.module === 'motion' ? '#8A57EA' : '#4D9FFF'

  const date = new Date(video.created_at).toLocaleDateString('fr-FR', {
    month: 'short',
    day:   'numeric',
  })

  return (
    <div className="group relative bg-white border border-[#EAEAEC] rounded-2xl overflow-hidden hover:shadow-md hover:border-[#D1D5DB] transition-all duration-200">
      {/* Thumbnail */}
      <div
        className="relative h-32 flex items-center justify-center"
        style={{ background: thumbnailBg }}
      >
        {video.module === 'motion'
          ? <Wand2 size={28} strokeWidth={1.2} style={{ color: thumbnailIcon, opacity: 0.5 }} />
          : <Video  size={28} strokeWidth={1.2} style={{ color: thumbnailIcon, opacity: 0.5 }} />
        }

        {isDone && video.output_url && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10">
            <div className="w-9 h-9 rounded-full bg-white/90 shadow-md flex items-center justify-center">
              <Play size={14} className="text-[#374151] ml-0.5" fill="currentColor" />
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#EAEAEC]">
            <div className="h-full w-1/2 bg-gradient-to-r from-[#8A57EA] to-[#4D9FFF] animate-pulse rounded-full" />
          </div>
        )}
        {isDone && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-sm font-semibold text-[#374151] truncate mb-2">
          {video.title ?? 'Sans titre'}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${status.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-[#9CA3AF]">
            <Clock size={10} />
            {date}
          </span>
        </div>
      </div>
    </div>
  )
}
