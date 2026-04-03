import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { Video, Wand2, Mic2, PenTool } from 'lucide-react'
import type { Database } from '@/lib/database.types'

export const metadata = { title: 'Dashboard — CLYRO' }

type Profile = Database['public']['Tables']['profiles']['Row']

export default async function DashboardPage() {
  const supabase = createServerComponentClient<Database>({ cookies })
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id ?? '')
    .single() as { data: Profile | null; error: unknown }

  type VideoRow = Database['public']['Tables']['videos']['Row']
  const { data: recentVideos } = await supabase
    .from('videos')
    .select('*')
    .eq('user_id', user?.id ?? '')
    .order('created_at', { ascending: false })
    .limit(4) as { data: VideoRow[] | null; error: unknown }

  return (
    <div className="flex-1 overflow-y-auto px-8 py-8">
    <div className="max-w-5xl mx-auto space-y-10 animate-fade-in">

      {/* Heading */}
      <div className="text-center pt-4">
        <h1 className="font-display text-4xl font-bold text-brand-text">
          Where do you want to start?
        </h1>
        <p className="text-brand-muted font-body mt-2">
          Bonjour{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''} — tu as{' '}
          <span className="text-brand-primary font-semibold">{profile?.credits ?? 0} crédits</span>
        </p>
      </div>

      {/* Main creation cards — 2×2 grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CreationCard
          href="/faceless/new"
          icon={<Video size={22} strokeWidth={1.5} className="text-brand-primary" />}
          category="Faceless Video"
          title="Generate a faceless video"
          description="YouTube, TikTok, Instagram — 6 visual styles, voiceover included."
        />
        <CreationCard
          href="/motion/new"
          icon={<Wand2 size={22} strokeWidth={1.5} className="text-brand-secondary" />}
          category="Motion Design"
          title="Animate from a script"
          description="After Effects-style animations from a script or voiceover."
        />
        <CreationCard
          href="/voices"
          icon={<Mic2 size={22} strokeWidth={1.5} className="text-[#27ae60]" />}
          category="Voices"
          title="Clone or browse voices"
          description="Public voice library + your cloned voices for any generation."
        />
        <CreationCard
          href="#"
          soon
          icon={<PenTool size={22} strokeWidth={1.5} className="text-brand-muted" />}
          category="Graphic Design"
          title="Design visuals with AI"
          description="Brand kits, thumbnails, and social assets — coming soon."
        />
      </div>

      {/* Recent creations */}
      {recentVideos && recentVideos.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-sm font-semibold text-brand-muted uppercase tracking-widest">
              Recent Creations
            </h2>
            <Link
              href="/projects"
              className="text-sm font-medium text-brand-primary hover:underline"
            >
              See all →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {recentVideos.map((video) => (
              <div
                key={video.id}
                className="bg-brand-surface border border-brand-border rounded-xl p-4"
              >
                <div className="w-8 h-8 rounded-lg bg-brand-bg flex items-center justify-center mb-3">
                  <Video size={16} className="text-brand-muted" />
                </div>
                <p className="font-body text-sm font-medium text-brand-text truncate">
                  {video.title ?? 'Sans titre'}
                </p>
                <span
                  className={`inline-block mt-1 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    video.status === 'done'
                      ? 'bg-[#eafaf1] text-[#27ae60]'
                      : video.status === 'processing'
                        ? 'bg-brand-primary-light text-brand-primary'
                        : 'bg-brand-bg text-brand-muted'
                  }`}
                >
                  {video.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    </div>
  )
}

function CreationCard({
  href,
  icon,
  category,
  title,
  description,
  soon,
}: {
  href: string
  icon: React.ReactNode
  category: string
  title: string
  description: string
  soon?: boolean
}) {
  return (
    <Link
      href={soon ? '#' : href}
      aria-disabled={soon}
      className={`group block bg-brand-surface border border-brand-border rounded-2xl p-6 transition-all duration-200 ${
        soon
          ? 'opacity-60 cursor-not-allowed pointer-events-none'
          : 'hover:border-brand-primary/40 hover:shadow-brand-md'
      }`}
    >
      {/* Icon pill */}
      <div className="w-10 h-10 rounded-xl bg-brand-bg flex items-center justify-center mb-4">
        {icon}
      </div>

      <p className="font-mono text-[11px] uppercase tracking-widest text-brand-muted mb-1">
        {category}
      </p>
      <h3 className="font-display text-base font-semibold text-brand-text mb-1">
        {title}
      </h3>
      <p className="font-body text-sm text-brand-muted leading-relaxed">
        {description}
      </p>

      {soon && (
        <span className="inline-block mt-3 font-mono text-[10px] uppercase tracking-wider bg-brand-accent/10 text-brand-accent px-2 py-0.5 rounded-full border border-brand-accent/20">
          Coming soon
        </span>
      )}
    </Link>
  )
}
