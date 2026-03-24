import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import Link from 'next/link'
import type { Database } from '@/lib/database.types'

export const metadata = { title: 'Dashboard — CLYRO' }

export default async function DashboardPage() {
  const supabase = createServerComponentClient<Database>({ cookies })
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id ?? '')
    .single()

  const { count: videoCount } = await supabase
    .from('videos')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user?.id ?? '')

  const { count: doneCount } = await supabase
    .from('videos')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user?.id ?? '')
    .eq('status', 'done')

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome */}
      <div>
        <p className="label-mono mb-2">Dashboard</p>
        <h1 className="font-display text-3xl font-bold text-foreground">
          Bonjour,{' '}
          <span className="text-gradient-primary">
            {profile?.full_name?.split(' ')[0] ?? 'Créateur'}
          </span>{' '}
          👋
        </h1>
        <p className="text-muted-foreground font-body mt-1">
          Tu as <strong className="text-clyro-blue">{profile?.credits ?? 0} crédit(s)</strong>{' '}
          disponibles. Plan actuel :{' '}
          <span className="capitalize font-semibold text-clyro-purple">{profile?.plan ?? 'free'}</span>
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Vidéos créées" value={videoCount ?? 0} accent="blue" />
        <StatCard label="Vidéos terminées" value={doneCount ?? 0} accent="purple" />
        <StatCard label="Crédits restants" value={profile?.credits ?? 0} accent="cyan" />
      </div>

      {/* Modules CTA */}
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground mb-4">
          Créer une vidéo
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ModuleCard
            href="/faceless/new"
            title="Faceless Videos"
            description="Vidéos YouTube, TikTok, Instagram sans apparaître à l'écran. 6 styles disponibles."
            badge="6 styles"
            gradient="from-clyro-blue to-clyro-purple"
          />
          <ModuleCard
            href="/motion/new"
            title="Motion Graphics"
            description="Publicités animées, présentations produit, contenus marketing avec votre identité de marque."
            badge="4 formats"
            gradient="from-clyro-purple to-clyro-cyan"
          />
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent: 'blue' | 'purple' | 'cyan'
}) {
  const accentColors = {
    blue: 'text-clyro-blue',
    purple: 'text-clyro-purple',
    cyan: 'text-clyro-cyan',
  }

  return (
    <div className="bg-navy-900 border border-border rounded-xl p-6">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
        {label}
      </p>
      <p className={`font-display text-4xl font-bold ${accentColors[accent]}`}>{value}</p>
    </div>
  )
}

function ModuleCard({
  href,
  title,
  description,
  badge,
  gradient,
}: {
  href: string
  title: string
  description: string
  badge: string
  gradient: string
}) {
  return (
    <Link href={href} className="group block">
      <div className="bg-navy-900 border border-border rounded-xl p-6 hover:border-clyro-blue/50 transition-all duration-300 hover:shadow-glow-blue">
        <div className="flex items-start justify-between mb-4">
          <div
            className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center`}
          >
            <span className="text-white text-lg">▶</span>
          </div>
          <span className="font-mono text-xs bg-navy-800 text-clyro-blue px-2 py-1 rounded-full border border-clyro-blue/20">
            {badge}
          </span>
        </div>
        <h3 className="font-display text-lg font-semibold text-foreground mb-2 group-hover:text-gradient-primary transition-all">
          {title}
        </h3>
        <p className="font-body text-sm text-muted-foreground">{description}</p>
        <div className="mt-4 flex items-center text-clyro-blue text-sm font-medium">
          Commencer <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
        </div>
      </div>
    </Link>
  )
}
