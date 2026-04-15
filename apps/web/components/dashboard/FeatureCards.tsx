import Link from 'next/link'
import {
  Video, Sparkles, Palette, Mic2, Image as ImageIcon, History,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Feature {
  category: string
  title: string
  description: string
  href: string
  icon: React.ElementType
  iconColor: string
  iconBg: string
  iconRing: string
  hoverGlow: string
}

const FEATURES: Feature[] = [
  {
    category: 'AI Studio',
    title: 'Faceless Video',
    description: 'Turn a script into a faceless video. AI voiceover, AI visuals, auto-edited.',
    href: '/faceless/new',
    icon: Video,
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/10',
    iconRing: 'ring-blue-500/30',
    hoverGlow: 'hover:shadow-[0_0_40px_-10px_rgba(59,142,240,0.3)]',
  },
  {
    category: 'Animation',
    title: 'Motion Design',
    description: 'Animate your static images into dynamic clips with Kling, Wan or Runway.',
    href: '/motion/new',
    icon: Sparkles,
    iconColor: 'text-purple-400',
    iconBg: 'bg-purple-500/10',
    iconRing: 'ring-purple-500/30',
    hoverGlow: 'hover:shadow-[0_0_40px_-10px_rgba(155,92,246,0.3)]',
  },
  {
    category: 'Visual identity',
    title: 'Brand Kit',
    description: 'Logo, color palette, typography, guidelines. Build your brand identity in a few clicks.',
    href: '/brand',
    icon: Palette,
    iconColor: 'text-cyan-400',
    iconBg: 'bg-cyan-400/10',
    iconRing: 'ring-cyan-400/30',
    hoverGlow: 'hover:shadow-[0_0_40px_-10px_rgba(56,232,255,0.3)]',
  },
  {
    category: 'Voice',
    title: 'My Voices',
    description: 'Clone your voice once and use it across every creation you make.',
    href: '/voices',
    icon: Mic2,
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10',
    iconRing: 'ring-emerald-500/30',
    hoverGlow: 'hover:shadow-[0_0_40px_-10px_rgba(34,197,94,0.3)]',
  },
  {
    category: 'Assets',
    title: 'Library',
    description: 'All your visual assets, brand kits and prompts within reach.',
    href: '/projects',
    icon: ImageIcon,
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/10',
    iconRing: 'ring-amber-500/30',
    hoverGlow: 'hover:shadow-[0_0_40px_-10px_rgba(245,158,11,0.3)]',
  },
  {
    category: 'Archive',
    title: 'History',
    description: 'All your past projects, ready to edit, duplicate or export.',
    href: '/history',
    icon: History,
    iconColor: 'text-pink-400',
    iconBg: 'bg-pink-500/10',
    iconRing: 'ring-pink-500/30',
    hoverGlow: 'hover:shadow-[0_0_40px_-10px_rgba(236,72,153,0.3)]',
  },
]

export function FeatureCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {FEATURES.map((feature) => {
        const Icon = feature.icon
        return (
          <Link
            key={feature.title}
            href={feature.href}
            className={cn(
              'group card-interactive relative overflow-hidden rounded-2xl border border-border/60 bg-card p-6',
              feature.hoverGlow,
            )}
          >
            {/* Subtle gradient on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative space-y-4">
              {/* Icon */}
              <div className={cn(
                'inline-flex items-center justify-center w-11 h-11 rounded-xl ring-1 transition-transform duration-300 group-hover:scale-110',
                feature.iconBg,
                feature.iconRing,
              )}>
                <Icon size={20} className={feature.iconColor} />
              </div>

              {/* Category */}
              <div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-muted] mb-1.5">
                  {feature.category}
                </p>
                <h3 className="font-display text-xl text-foreground leading-tight">
                  {feature.title}
                </h3>
              </div>

              {/* Description */}
              <p className="font-body text-sm text-[--text-secondary] leading-relaxed">
                {feature.description}
              </p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
