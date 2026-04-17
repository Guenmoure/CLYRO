import Link from 'next/link'
import { Video, ArrowRight, Sparkles, Palette, Film } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Component ──────────────────────────────────────────────────────────────────

interface EmptyDashboardProps {
  firstName?: string
}

const STARTER_PROJECTS = [
  {
    title:       'My first faceless video',
    description: 'Paste a script and get a fully edited video with voiceover and visuals.',
    href:        '/faceless/new',
    icon:        Video,
    iconColor:   'text-blue-400',
    iconBg:      'bg-blue-500/10',
    cta:         'Start now',
  },
  {
    title:       'Animate an image',
    description: 'Turn any static image into a dynamic video clip using AI motion.',
    href:        '/motion/new',
    icon:        Sparkles,
    iconColor:   'text-purple-400',
    iconBg:      'bg-purple-500/10',
    cta:         'Try Motion Design',
  },
  {
    title:       'Build a brand identity',
    description: 'Generate your logo, color palette, and guidelines in one click.',
    href:        '/brand',
    icon:        Palette,
    iconColor:   'text-cyan-400',
    iconBg:      'bg-cyan-400/10',
    cta:         'Create Brand Kit',
  },
] as const

export function EmptyDashboard({ firstName }: EmptyDashboardProps) {
  return (
    <div className="flex flex-col items-center gap-10 py-6">
      {/* Hero message */}
      <div className="text-center space-y-3 max-w-md">
        {/* Glow orb */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-border/60 flex items-center justify-center mb-4">
          <Film size={28} className="text-blue-400" />
        </div>

        <h2 className="font-display text-2xl font-bold text-foreground">
          {firstName ? `Welcome, ${firstName}!` : 'Welcome to CLYRO!'}
        </h2>
        <p className="font-body text-sm text-[--text-secondary] leading-relaxed">
          You don&apos;t have any projects yet. Start with one of these or explore the full creation suite.
        </p>
      </div>

      {/* Starter project cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl">
        {STARTER_PROJECTS.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex flex-col gap-4 p-5 rounded-2xl',
                'bg-card border border-border/60 hover:border-border',
                'hover:shadow-card-hover transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              )}
            >
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', item.iconBg)}>
                <Icon size={18} className={item.iconColor} />
              </div>

              <div className="flex-1">
                <p className="font-display text-sm font-semibold text-foreground">{item.title}</p>
                <p className="font-body text-xs text-[--text-muted] mt-1 leading-relaxed">{item.description}</p>
              </div>

              <span className={cn(
                'inline-flex items-center gap-1',
                'font-mono text-xs font-medium',
                item.iconColor,
              )}>
                {item.cta}
                <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform duration-150" />
              </span>
            </Link>
          )
        })}
      </div>

      {/* Secondary CTA */}
      <p className="font-body text-xs text-[--text-muted]">
        Need inspiration?{' '}
        <Link href="/#showcase" className="text-blue-400 hover:text-blue-300 transition-colors">
          Watch examples made with CLYRO
        </Link>
      </p>
    </div>
  )
}
