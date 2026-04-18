import Link from 'next/link'
import { cn } from '@/lib/utils'

// ── Size map ─────────────────────────────────────────────────────────────────

const SIZE = {
  xs: { box: 'w-6 h-6 rounded-lg',   text: 'text-[10px]', wordmark: 'text-sm',   gap: 'gap-1.5' },
  sm: { box: 'w-8 h-8 rounded-xl',   text: 'text-xs',     wordmark: 'text-base', gap: 'gap-2'   },
  md: { box: 'w-10 h-10 rounded-xl', text: 'text-sm',     wordmark: 'text-xl',   gap: 'gap-2.5' },
  lg: { box: 'w-14 h-14 rounded-2xl',text: 'text-lg',     wordmark: 'text-3xl',  gap: 'gap-3'   },
  xl: { box: 'w-20 h-20 rounded-3xl',text: 'text-2xl',    wordmark: 'text-5xl',  gap: 'gap-4'   },
} as const

type Size    = keyof typeof SIZE
type Variant = 'full' | 'icon'

interface LogoProps {
  variant?: Variant
  size?:    Size
  href?:    string | false   // false = no link wrapper; string = custom href
  className?: string
}

/**
 * CLYRO brand logo.
 *
 * variant="full"  — gradient C-box + "LYRO" wordmark (default)
 * variant="icon"  — gradient C-box only (sidebar collapsed, favicons…)
 */
export function Logo({
  variant   = 'full',
  size      = 'md',
  href      = '/dashboard',
  className,
}: LogoProps) {
  const s = SIZE[size]

  const mark = (
    <div className={cn('flex items-center', variant === 'full' && s.gap, className)}>
      {/* ── C-box ──────────────────────────────────────────────────────── */}
      <div
        className={cn(
          s.box,
          'relative flex items-center justify-center shrink-0',
          'bg-gradient-to-br from-[#667EEA] via-[#7C3AED] to-[#00B4FF]',
          'shadow-[0_0_20px_rgba(102,126,234,0.5)]',
        )}
      >
        {/* subtle noise overlay for depth (SVG inline — no external file) */}
        <svg className="absolute inset-0 w-full h-full rounded-[inherit] opacity-[0.08] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          <filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
          <rect width="100%" height="100%" filter="url(#noise)" opacity="0.4"/>
        </svg>
        <span
          className={cn(
            s.text,
            'relative font-display font-extrabold text-white select-none leading-none',
          )}
        >
          C
        </span>
      </div>

      {/* ── Wordmark ───────────────────────────────────────────────────── */}
      {variant === 'full' && (
        <span
          className={cn(
            s.wordmark,
            'font-display font-extrabold leading-none select-none',
            'bg-gradient-to-r from-[#667EEA] via-[#A855F7] to-[#00B4FF]',
            'bg-clip-text text-transparent',
          )}
        >
          LYRO
        </span>
      )}
    </div>
  )

  if (href === false) return mark
  return (
    <Link href={href} className="inline-flex items-center hover:opacity-90 transition-opacity duration-200">
      {mark}
    </Link>
  )
}
