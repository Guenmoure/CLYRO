import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { Video, Wand2, Palette, Play, Clock, ArrowRight, Plus } from 'lucide-react'
import type { Database } from '@/lib/database.types'
import { Reveal } from '@/components/ui/reveal'

export const metadata = { title: 'Dashboard — CLYRO' }

type VideoRow = Database['public']['Tables']['videos']['Row']

const MODULE_GRADIENTS: Record<string, string> = {
  faceless: 'from-clyro-blue/20 via-navy-800 to-navy-900',
  motion:   'from-clyro-purple/20 via-navy-800 to-navy-900',
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  done:       { label: 'Completed',   cls: 'bg-success/15 text-success border-success/25' },
  processing: { label: 'Processing…', cls: 'bg-warning/15 text-warning border-warning/25' },
  storyboard: { label: 'Processing…', cls: 'bg-warning/15 text-warning border-warning/25' },
  visuals:    { label: 'Rendering…',  cls: 'bg-warning/15 text-warning border-warning/25' },
  audio:      { label: 'Rendering…',  cls: 'bg-warning/15 text-warning border-warning/25' },
  assembly:   { label: 'Rendering…',  cls: 'bg-warning/15 text-warning border-warning/25' },
  pending:    { label: 'Pending',     cls: 'bg-gray-100 dark:bg-white/[0.08] text-gray-400 dark:text-white/40 border-gray-200 dark:border-white/10' },
  error:      { label: 'Error',       cls: 'bg-error/15 text-error border-error/25' },
}

type BrandKitRow = { id: string; name: string; primary_color: string; secondary_color: string | null; logo_url: string | null; is_default: boolean }

export default async function DashboardPage() {
  const supabase = createServerComponentClient<Database>({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  const [profileResult, recentVideosResult, brandKitsResult] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user?.id ?? '').single(),
    supabase.from('videos').select('*').eq('user_id', user?.id ?? '').order('created_at', { ascending: false }).limit(6),
    supabase.from('brand_kits').select('id, name, primary_color, secondary_color, logo_url, is_default').eq('user_id', user?.id ?? '').order('is_default', { ascending: false }).order('created_at', { ascending: false }).limit(3),
  ])

  const profile      = profileResult.data as { full_name: string | null } | null
  const recentVideos = recentVideosResult.data as VideoRow[] | null
  const brandKits    = (brandKitsResult.data ?? []) as BrandKitRow[]
  const firstName    = (profile?.full_name ?? user?.email ?? 'there').split(' ')[0]

  return (
    <div className="flex-1 overflow-y-auto animate-fade-in">

      {/* ── Greeting Hero ─────────────────────────────────────── */}
      <div className="relative px-8 pt-12 pb-10 overflow-hidden">
        {/* Ambient glow blobs behind the title */}
        <div className="absolute top-0 left-[10%] w-[560px] h-[320px] bg-clyro-blue/[0.09] rounded-full blur-[110px] pointer-events-none" />
        <div className="absolute top-0 right-[10%] w-[420px] h-[280px] bg-clyro-purple/[0.11] rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-5xl mx-auto relative z-10">
          <Reveal>
            <p className="font-mono text-xs text-gray-400 dark:text-white/30 uppercase tracking-widest mb-4">Dashboard</p>
            <h1 className="font-display font-extrabold text-gray-900 dark:text-white leading-tight text-[clamp(2rem,4vw,2.75rem)]">
              Hey {firstName},
            </h1>
            <h2 className="font-display font-extrabold leading-tight mb-3 text-[clamp(2rem,4vw,2.75rem)]">
              <span className="text-gradient-animated">où veux-tu commencer ?</span>
            </h2>
            <p className="font-body text-gray-500 dark:text-white/40 text-sm mt-1">
              Choisis un module pour créer ta prochaine vidéo AI.
            </p>
          </Reveal>
        </div>
      </div>

      <div className="px-8 pb-10">
        <div className="max-w-5xl mx-auto space-y-12">

          {/* ── Module Cards 3-col ────────────────────────────── */}
          <Reveal stagger className="grid grid-cols-1 sm:grid-cols-3 gap-5">

            <ModuleCard
              href="/faceless/new"
              category="Faceless Video"
              title="Generate from a script"
              description="YouTube, TikTok, Instagram — 6 styles visuels, voiceover inclus."
              icon={<Video size={26} strokeWidth={1.3} />}
              iconColor="text-clyro-cyan"
              iconBg="bg-clyro-cyan/10 border border-clyro-cyan/20"
              topLine="via-clyro-cyan/30"
            />

            <ModuleCard
              href="/motion/new"
              category="Motion Design"
              title="After Effects-style animations"
              description="Animations fluides à partir d'un script ou d'un voiceover."
              icon={<Wand2 size={26} strokeWidth={1.3} />}
              iconColor="text-clyro-primary"
              iconBg="bg-clyro-primary/10 border border-clyro-primary/20"
              topLine="via-clyro-primary/35"
              featured
            />

            <ModuleCard
              href="/brand"
              category="Brand Kit"
              title="Logos, charte & posts réseaux"
              description="Génère des logos et visuels sociaux avec ta palette de couleurs."
              icon={<Palette size={26} strokeWidth={1.3} />}
              iconColor="text-clyro-accent"
              iconBg="bg-clyro-accent/10 border border-clyro-accent/20"
              topLine="via-clyro-accent/30"
            />

          </Reveal>

          {/* ── Brand Kit widget ──────────────────────────────── */}
          <BrandKitWidget kits={brandKits} />

          {/* ── Recent Projects ───────────────────────────────── */}
          {recentVideos && recentVideos.length > 0 && (
            <div>
              <Reveal className="flex items-center justify-between mb-5">
                <div>
                  <p className="font-mono text-[10px] text-gray-400 dark:text-white/30 uppercase tracking-widest mb-1">Historique</p>
                  <h2 className="font-display text-lg font-bold text-gray-900 dark:text-white">Projets récents</h2>
                </div>
                <Link
                  href="/projects"
                  className="flex items-center gap-1.5 font-body text-sm font-medium text-gray-400 dark:text-white/40 hover:text-clyro-accent transition-colors duration-200"
                >
                  Tout voir <ArrowRight size={13} />
                </Link>
              </Reveal>
              <Reveal stagger className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {recentVideos.map((video) => (
                  <ProjectCard key={video.id} video={video} />
                ))}
              </Reveal>
            </div>
          )}

          {/* ── Empty state ───────────────────────────────────── */}
          {(!recentVideos || recentVideos.length === 0) && (
            <div className="glass rounded-2xl py-14 text-center">
              <Play size={32} className="mx-auto mb-3 text-gray-300 dark:text-white/15" />
              <p className="font-body text-sm text-gray-400 dark:text-white/30">Tes projets apparaîtront ici.</p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

/* ── Brand Kit Widget ──────────────────────────────────────────────────────── */

function BrandKitWidget({ kits }: { kits: BrandKitRow[] }) {
  return (
    <Reveal>
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="font-mono text-[10px] text-gray-400 dark:text-white/30 uppercase tracking-widest mb-1">Brand Kit</p>
            <h2 className="font-display text-lg font-bold text-gray-900 dark:text-white">Identités de marque</h2>
          </div>
          <Link
            href="/brand"
            className="flex items-center gap-1.5 font-body text-sm font-medium text-gray-400 dark:text-white/40 hover:text-clyro-accent transition-colors duration-200"
          >
            {kits.length === 0 ? 'Créer' : 'Gérer'} <ArrowRight size={13} />
          </Link>
        </div>

        {kits.length === 0 ? (
          <Link
            href="/brand"
            className="flex items-center gap-4 p-4 rounded-xl border border-dashed border-gray-200 dark:border-white/10 hover:border-clyro-accent/40 hover:bg-clyro-accent/5 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-clyro-accent/10 border border-clyro-accent/20 flex items-center justify-center shrink-0">
              <Plus size={16} className="text-clyro-accent" />
            </div>
            <div>
              <p className="font-display text-sm font-semibold text-gray-700 dark:text-white/70 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                Créer mon premier Brand Kit
              </p>
              <p className="font-body text-xs text-gray-400 dark:text-white/30 mt-0.5">
                Logos, couleurs, posts réseaux sociaux — générés par IA
              </p>
            </div>
          </Link>
        ) : (
          <div className="flex gap-3 flex-wrap">
            {kits.map((kit) => (
              <Link
                key={kit.id}
                href="/brand"
                className="flex items-center gap-3 px-4 py-3 rounded-xl glass card-hover group min-w-0"
              >
                {/* Color swatch */}
                <div className="flex gap-1 shrink-0">
                  <div
                    className="w-5 h-5 rounded-full border border-white/20 shadow-sm"
                    style={{ backgroundColor: kit.primary_color }}
                    title={kit.primary_color}
                  />
                  {kit.secondary_color && (
                    <div
                      className="w-5 h-5 rounded-full border border-white/20 shadow-sm -ml-2"
                      style={{ backgroundColor: kit.secondary_color }}
                      title={kit.secondary_color}
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-display text-sm font-semibold text-gray-800 dark:text-white/80 truncate">
                    {kit.name}
                  </p>
                  {kit.is_default && (
                    <span className="font-mono text-[9px] uppercase tracking-wider text-clyro-accent">
                      Défaut
                    </span>
                  )}
                </div>
              </Link>
            ))}
            <Link
              href="/brand"
              className="flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-gray-200 dark:border-white/10 hover:border-clyro-accent/40 transition-all text-gray-400 dark:text-white/30 hover:text-clyro-accent"
            >
              <Plus size={14} />
              <span className="font-body text-sm">Nouveau</span>
            </Link>
          </div>
        )}
      </div>
    </Reveal>
  )
}

/* ── Module Card ───────────────────────────────────────────────────────────── */

function ModuleCard({
  href,
  category,
  title,
  description,
  icon,
  iconColor,
  iconBg,
  topLine,
  featured,
}: {
  href: string
  category: string
  title: string
  description: string
  icon: React.ReactNode
  iconColor: string
  iconBg: string
  topLine: string
  featured?: boolean
}) {
  return (
    <Link
      href={href}
      className={`group relative glass rounded-2xl p-6 card-hover overflow-hidden flex flex-col gap-5 ${featured ? 'shimmer' : ''}`}
    >
      {/* Top accent line */}
      <span className={`absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent ${topLine} to-transparent`} />

      {/* Icon */}
      <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center ${iconColor} transition-transform duration-300 group-hover:scale-110 shrink-0`}>
        {icon}
      </div>

      {/* Text block */}
      <div className="flex flex-col gap-1.5">
        <p className={`font-mono text-[10px] uppercase tracking-widest ${iconColor} opacity-70`}>
          {category}
        </p>
        <h3 className="font-display text-[15px] font-bold text-gray-900 dark:text-white leading-snug">
          {title}
        </h3>
        <p className="font-body text-xs text-gray-500 dark:text-white/40 leading-relaxed">
          {description}
        </p>
      </div>

      {/* CTA arrow */}
      <div className="mt-auto flex items-center gap-1.5 font-body text-xs font-medium text-gray-400 dark:text-white/25 group-hover:text-gray-700 dark:group-hover:text-white/60 transition-colors duration-200">
        Commencer <ArrowRight size={11} className="transition-transform duration-200 group-hover:translate-x-0.5" />
      </div>

      {featured && (
        <span className="absolute top-3 right-3 font-mono text-[9px] uppercase tracking-wider bg-clyro-primary/20 text-clyro-primary border border-clyro-primary/30 px-1.5 py-0.5 rounded-full">
          Popular
        </span>
      )}
    </Link>
  )
}

/* ── Project Card ──────────────────────────────────────────────────────────── */

function ProjectCard({ video }: { video: VideoRow }) {
  const bg     = MODULE_GRADIENTS[video.module] ?? 'from-navy-700 via-navy-800 to-navy-900'
  const status = STATUS_META[video.status] ?? STATUS_META.pending
  const isDone       = video.status === 'done'
  const isProcessing = !isDone && video.status !== 'pending' && video.status !== 'error'

  const date = new Date(video.created_at).toLocaleDateString('fr-FR', {
    month: 'short',
    day:   'numeric',
  })

  return (
    <div className="group relative glass rounded-2xl overflow-hidden card-hover">
      {/* Thumbnail */}
      <div className={`relative h-32 bg-gradient-to-br ${bg} flex items-center justify-center`}>
        {video.module === 'motion'
          ? <Wand2 size={28} strokeWidth={1} className="text-clyro-purple/40" />
          : <Video  size={28} strokeWidth={1} className="text-clyro-blue/40"  />
        }

        {isDone && video.output_url && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
            <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Play size={14} className="text-white ml-0.5" fill="white" />
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5">
            <div className="h-full w-1/2 bg-gradient-to-r from-clyro-accent to-clyro-primary animate-pulse" />
          </div>
        )}
        {isDone && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-success/60" />
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="font-body text-sm font-medium text-gray-800 dark:text-white/80 truncate mb-2">
          {video.title ?? 'Sans titre'}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className={`inline-flex items-center font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${status.cls}`}>
            {status.label}
          </span>
          <span className="flex items-center gap-1 font-mono text-[10px] text-gray-400 dark:text-white/25">
            <Clock size={10} />
            {date}
          </span>
        </div>
      </div>
    </div>
  )
}
