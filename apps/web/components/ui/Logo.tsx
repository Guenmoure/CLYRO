import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'

// ── Size map ─────────────────────────────────────────────────────────────────
// `box` = collapsed sidebar / favicon slot (square)
// `img` = full wordmark display dims. Aspect 3:2 to match clyro-full-dark.jpeg
//         (1280 × 853 source → ~1.5:1 ratio). object-contain handles any drift.
const SIZE = {
  xs: { box: 'w-6 h-6 rounded-lg',    text: 'text-[10px]', wordmark: 'text-sm',   gap: 'gap-1.5', img: { w: 64,  h: 24 } },
  sm: { box: 'w-8 h-8 rounded-xl',    text: 'text-xs',     wordmark: 'text-base', gap: 'gap-2',   img: { w: 88,  h: 28 } },
  md: { box: 'w-10 h-10 rounded-xl',  text: 'text-sm',     wordmark: 'text-xl',   gap: 'gap-2.5', img: { w: 124, h: 36 } },
  lg: { box: 'w-14 h-14 rounded-2xl', text: 'text-lg',     wordmark: 'text-3xl',  gap: 'gap-3',   img: { w: 168, h: 48 } },
  xl: { box: 'w-20 h-20 rounded-3xl', text: 'text-2xl',    wordmark: 'text-5xl',  gap: 'gap-4',   img: { w: 232, h: 64 } },
} as const

type Size    = keyof typeof SIZE
type Variant = 'full' | 'icon'

interface LogoProps {
  variant?:  Variant
  size?:     Size
  href?:     string | false   // false = no link wrapper; string = custom href
  className?: string
  /**
   * Forces use of the CSS fallback (gradient C + CLYRO text) instead of the
   * real PNG/JPEG assets. Default false — uses /public/logo/* assets now.
   */
  useFallback?: boolean
}

// ── Asset paths ──────────────────────────────────────────────────────────────
// Real assets shipped May 2026 :
//   /public/logo/clyro-full-dark.jpeg — full wordmark (C swoosh + "CLYRO")
//                                       on dark background, baked in.
//   /public/logo/CLYRO_C_logo.png     — C swoosh only, transparent PNG,
//                                       works on any background (sidebar collapsed,
//                                       favicons, avatar slots, dark + light modes).
//   /public/logo/CLYRO_text_logo.png  — "CLYRO" wordmark only, transparent PNG.
//                                       Reserved for future use (e.g. light-mode
//                                       full variant once we composite C + text).

const ASSET_FULL = '/logo/clyro-full-dark.jpeg'
const ASSET_ICON = '/logo/CLYRO_C_logo.png'

// Set to true once you want the CSS fallback (gradient C + "CLYRO" text via
// background-clip) instead of the real assets. The fallback works on any
// background and adapts to dark/light mode — useful as a safety net during
// asset migrations.
const USE_FALLBACK_DEFAULT = false

/**
 * CLYRO brand logo.
 *
 * variant="full"  — full wordmark "CLYRO" (default)
 * variant="icon"  — square C-mark only (sidebar collapsed, favicons, avatar slots…)
 *
 * Uses the real /public/logo/* assets by default. Falls back to a pure-CSS
 * gradient mark when `useFallback` is true.
 */
export function Logo({
  variant      = 'full',
  size         = 'md',
  href         = '/dashboard',
  className,
  useFallback  = USE_FALLBACK_DEFAULT,
}: LogoProps) {
  if (useFallback) {
    return <LogoFallback variant={variant} size={size} href={href} className={className} />
  }

  const s   = SIZE[size]
  const src = variant === 'icon' ? ASSET_ICON : ASSET_FULL
  const alt = variant === 'icon' ? 'CLYRO' : 'CLYRO — AI video creation'

  // icon variant → square box from s.box dims (parsed from `w-N` tailwind class)
  //                The CLYRO_C_logo PNG is 768×1024 portrait with transparent
  //                margins; object-contain keeps the swoosh centered.
  // full variant → wide wordmark from s.img dims (≈3:2 aspect of the JPEG).
  const boxPx = (Number(s.box.match(/w-(\d+)/)?.[1] ?? 10)) * 4
  const dims  = variant === 'icon'
    ? { width: boxPx, height: boxPx }
    : { width: s.img.w, height: s.img.h }

  const mark = (
    <Image
      src={src}
      alt={alt}
      width={dims.width}
      height={dims.height}
      priority
      className={cn(
        'select-none',
        variant === 'icon' ? 'object-contain' : 'object-contain',
        // Round the full JPEG slightly to soften the dark rectangle on
        // light-mode surfaces. No effect when displayed on dark sidebars.
        variant === 'full' && 'rounded-md',
        className,
      )}
    />
  )

  if (href === false) return mark
  return (
    <Link
      href={href}
      className="inline-flex items-center hover:opacity-90 transition-opacity duration-200"
      aria-label="CLYRO home"
    >
      {mark}
    </Link>
  )
}

// ── LogoFallback ─────────────────────────────────────────────────────────────
//
// Pure-CSS brand mark — works without any image assets.
// Gradient "C" square + "CLYRO" wordmark in matching gradient.
// Kept as a fallback for the `useFallback` prop / future light-mode adjustments.

interface LogoFallbackProps {
  variant?:  Variant
  size?:     Size
  href?:     string | false
  className?: string
}

export function LogoFallback({
  variant    = 'full',
  size       = 'md',
  href       = '/dashboard',
  className,
}: LogoFallbackProps) {
  const s = SIZE[size]

  // icon variant → gradient C-box only (square slot: sidebar collapsed, avatars)
  // full variant  → "CLYRO" gradient wordmark only (no duplicate C-box)
  const iconMark = (
    <div
      className={cn(
        s.box,
        'relative flex items-center justify-center shrink-0',
        'bg-gradient-to-br from-[#667EEA] via-[#7C3AED] to-[#00B4FF]',
        'shadow-[0_0_20px_rgba(102,126,234,0.5)]',
      )}
    >
      {/* subtle noise overlay for depth (SVG inline — no external file) */}
      <svg className="absolute inset-0 w-full h-full rounded-[inherit] opacity-[0.08] pointer-events-none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <filter id="noise-logo-fallback">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
          <feColorMatrix type="saturate" values="0"/>
        </filter>
        <rect width="100%" height="100%" filter="url(#noise-logo-fallback)" opacity="0.4"/>
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
  )

  const wordmark = (
    <span
      className={cn(
        s.wordmark,
        'font-display font-extrabold leading-none select-none tracking-tight',
        'bg-gradient-to-r from-[#667EEA] via-[#A855F7] to-[#00B4FF]',
        'bg-clip-text text-transparent',
      )}
    >
      CLYRO
    </span>
  )

  const mark =
    variant === 'icon'
      ? <div className={cn('flex items-center', className)}>{iconMark}</div>
      : <div className={cn('flex items-center', className)}>{wordmark}</div>

  if (href === false) return mark
  return (
    <Link href={href} className="inline-flex items-center hover:opacity-90 transition-opacity duration-200" aria-label="CLYRO home">
      {mark}
    </Link>
  )
}
