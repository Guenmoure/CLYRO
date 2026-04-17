import Link from 'next/link'
import { Video, Film, Sparkles, Palette, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Data ───────────────────────────────────────────────────────────────────────

const ACTIONS = [
  {
    category:  'AI Studio',
    title:     'Faceless Video',
    blurb:     'Script → voiceover → visuals',
    href:      '/faceless/new',
    icon:      Video,
    iconColor: 'text-blue-400',
    iconBg:    'bg-blue-500/10',
    hoverGlow: 'hover:shadow-[0_0_40px_-12px_rgba(59,130,246,0.35)]',
    accentBar: 'bg-blue-500',
  },
  {
    category:  'AI Avatar',
    title:     'Avatar Studio',
    blurb:     'Present with your AI clone',
    href:      '/studio/new',
    icon:      Film,
    iconColor: 'text-rose-400',
    iconBg:    'bg-rose-500/10',
    hoverGlow: 'hover:shadow-[0_0_40px_-12px_rgba(251,113,133,0.35)]',
    accentBar: 'bg-rose-500',
  },
  {
    category:  'Animation',
    title:     'Motion Design',
    blurb:     'Animate images into clips',
    href:      '/motion/new',
    icon:      Sparkles,
    iconColor: 'text-purple-400',
    iconBg:    'bg-purple-500/10',
    hoverGlow: 'hover:shadow-[0_0_40px_-12px_rgba(168,85,247,0.35)]',
    accentBar: 'bg-purple-500',
  },
  {
    category:  'Branding',
    title:     'Brand Kit',
    blurb:     'Logo, palette, guidelines',
    href:      '/brand',
    icon:      Palette,
    iconColor: 'text-cyan-400',
    iconBg:    'bg-cyan-400/10',
    hoverGlow: 'hover:shadow-[0_0_40px_-12px_rgba(34,211,238,0.35)]',
    accentBar: 'bg-cyan-400',
  },
] as const

// ── Component ──────────────────────────────────────────────────────────────────

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {ACTIONS.map((action) => {
        const Icon = action.icon
        return (
          <Link
            key={action.href}
            href={action.href}
            className={cn(
              'group relative flex flex-col gap-4 p-4 rounded-2xl',
              'bg-card border border-border/60 hover:border-border',
              'transition-all duration-200',
              action.hoverGlow,
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            )}
          >
            {/* Accent bar — top edge */}
            <div className={cn(
              'absolute inset-x-0 top-0 h-0.5 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200',
              action.accentBar,
            )} />

            {/* Icon */}
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center',
              action.iconBg,
              'group-hover:scale-110 transition-transform duration-200',
            )}>
              <Icon size={18} className={action.iconColor} />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[--text-muted] mb-1">
                {action.category}
              </p>
              <p className="font-display text-base font-semibold text-foreground leading-tight">
                {action.title}
              </p>
              <p className="font-mono text-xs text-[--text-muted] mt-1 leading-snug">
                {action.blurb}
              </p>
            </div>

            {/* Arrow — revealed on hover */}
            <ArrowRight
              size={14}
              className={cn(
                'absolute bottom-4 right-4',
                'text-[--text-muted] opacity-0 group-hover:opacity-100',
                'translate-x-1 group-hover:translate-x-0',
                'transition-all duration-200',
              )}
            />
          </Link>
        )
      })}
    </div>
  )
}
