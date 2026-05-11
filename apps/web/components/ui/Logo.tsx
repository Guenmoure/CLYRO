import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'

// ── Size map ─────────────────────────────────────────────────────────────────
// `box`   = collapsed sidebar / favicon slot (square, icon variant only)
// `cH`    = C-swoosh height (in px) for the `full` variant. The brand mark is
//           intentionally taller than the wordmark so it dominates.
// `textH` = "CLYRO" wordmark cap-height (in px) for the `full` variant.
//           Roughly cH ÷ 2 — the wordmark is very wide (aspect ≈ 5.83) so we
//           keep it short to balance the side-by-side composition and avoid
//           overrunning narrow containers like the 240 px sidebar.
const SIZE = {
  xs: { box: 'w-7 h-7 rounded-lg',    text: 'text-[10px]', wordmark: 'text-sm',   gap: 'gap-1.5', cH: 24, textH: 10 },
  sm: { box: 'w-9 h-9 rounded-xl',    text: 'text-xs',     wordmark: 'text-base', gap: 'gap-2',   cH: 32, textH: 14 },
  md: { box: 'w-12 h-12 rounded-xl',  text: 'text-sm',     wordmark: 'text-xl',   gap: 'gap-2.5', cH: 44, textH: 20 },
  lg: { box: 'w-16 h-16 rounded-2xl', text: 'text-lg',     wordmark: 'text-3xl',  gap: 'gap-3',   cH: 60, textH: 28 },
  xl: { box: 'w-24 h-24 rounded-3xl', text: 'text-2xl',    wordmark: 'text-5xl',  gap: 'gap-4',   cH: 84, textH: 40 },
} as const

type Size    = keyof typeof SIZE
type Variant = 'full' | 'icon'
type Tone    = 'light' | 'dark' | 'auto'

interface LogoProps {
  variant?:  Variant
  size?:     Size
  href?:     string | false   // false = no link wrapper; string = custom href
  className?: string
  /**
   * Which "CLYRO" wordmark PNG to use:
   *   tone="auto"  → navy on light theme, white on dark theme (via Tailwind dark:). DEFAULT.
   *   tone="light" → force white wordmark (use on always-dark surfaces).
   *   tone="dark"  → force navy wordmark (use on always-light surfaces).
   * Ignored when variant="icon" (the C swoosh is multicoloured, no tone variant).
   */
  tone?:     Tone
  /**
   * Forces use of the CSS fallback (gradient C + CLYRO text) instead of the
   * real PNG/JPEG assets. Default false — uses /public/logo/* assets now.
   */
  useFallback?: boolean
}

// ── Asset paths ──────────────────────────────────────────────────────────────
// Real assets shipped May 2026, all transparent PNG with white-edge stripping
// applied via ImageMagick `-fuzz 8% -transparent white` so they composite
// cleanly on any background (dark sidebar, light card, gradient hero…):
//
//   /public/logo/CLYRO_C_logo.png         — C swoosh only (gradient cyan→purple).
//                                            Multi-colour so no tone variant needed.
//                                            Used by `icon` variant and as the
//                                            prominent left mark in `full`.
//   /public/logo/CLYRO_text_logo.png       — "CLYRO" wordmark in original navy.
//                                            For LIGHT backgrounds only.
//   /public/logo/CLYRO_text_logo_white.png — "CLYRO" wordmark in white. Built
//                                            from the navy PNG by extracting its
//                                            alpha mask and filling white. For
//                                            DARK backgrounds (sidebar). DEFAULT.
//
// Caller picks via `tone="light"` (default, white wordmark on dark surface) or
// `tone="dark"` (navy wordmark on light surface).
//
// The legacy clyro-full-dark.jpeg is still in /public/logo/ but is no longer
// referenced by the component — the dark background of the JPEG made it jar
// on light surfaces. The new `full` variant composites two transparent PNGs
// side-by-side so it renders correctly on every theme.

const ASSET_C_LOGO        = '/logo/CLYRO_C_logo.png'
const ASSET_TEXT_LOGO_DARK  = '/logo/CLYRO_text_logo.png'        // original navy wordmark
const ASSET_TEXT_LOGO_LIGHT = '/logo/CLYRO_text_logo_white.png'  // pure-white wordmark (for dark surfaces)

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
  tone         = 'auto',
  useFallback  = USE_FALLBACK_DEFAULT,
}: LogoProps) {
  if (useFallback) {
    return <LogoFallback variant={variant} size={size} href={href} className={className} />
  }

  const s = SIZE[size]

  // PNGs have been tightly trimmed to their content (via `convert -trim`) +
  // a small transparent border for breathing room. Aspect ratios reflect the
  // visible artwork — not the original 768×1024 source canvas.
  //   CLYRO_C_logo.png       → 654×453  → 1.444 (wider than tall)
  //   CLYRO_text_logo*.png   → 647×111  → 5.83  (very wide, short)
  // We render each at its target HEIGHT (cH / textH); width follows aspect
  // automatically so Next.js Image won't squish or pillarbox the artwork.
  const C_ASPECT     = 654 / 453   // ≈ 1.444 — width / height
  const TEXT_ASPECT  = 647 / 111   // ≈ 5.83  — width / height

  // icon variant → square box, C swoosh fills with object-contain
  //                Apply a scale-110 transform so the swoosh visually fills
  //                more of the box (the source PNG has ~15% transparent
  //                margin on each side, which makes the icon feel small by
  //                default).
  if (variant === 'icon') {
    const boxPx = (Number(s.box.match(/w-(\d+)/)?.[1] ?? 12)) * 4
    const mark = (
      <div
        className={cn(s.box, 'relative flex items-center justify-center shrink-0 overflow-visible', className)}
        aria-label="CLYRO"
      >
        <Image
          src={ASSET_C_LOGO}
          alt="CLYRO"
          width={boxPx}
          height={boxPx}
          priority
          className="object-contain select-none scale-110"
        />
      </div>
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

  // full variant → flex row : C swoosh (bigger) + "CLYRO" wordmark (smaller)
  //                Both transparent PNG → looks correct on dark + light.
  const cMark = (
    <Image
      src={ASSET_C_LOGO}
      alt=""
      aria-hidden="true"
      width={Math.round(s.cH * C_ASPECT)}
      height={s.cH}
      priority
      className="object-contain select-none scale-110"
    />
  )
  // ── Wordmark — tone-aware ────────────────────────────────────────────────
  // tone="auto"  → render BOTH PNGs (navy + white) and let Tailwind toggle them
  //                via the `dark:` modifier; navy shows on light theme, white on dark.
  // tone="dark"  → only navy (for permanently-light surfaces)
  // tone="light" → only white (for permanently-dark surfaces)
  const textWidth = Math.round(s.textH * TEXT_ASPECT)
  const textHeight = s.textH
  const navyMark = (
    <Image
      key="navy"
      src={ASSET_TEXT_LOGO_DARK}
      alt=""
      aria-hidden="true"
      width={textWidth}
      height={textHeight}
      priority
      className={cn(
        'object-contain select-none',
        tone === 'auto' && 'dark:hidden',
      )}
    />
  )
  const whiteMark = (
    <Image
      key="white"
      src={ASSET_TEXT_LOGO_LIGHT}
      alt=""
      aria-hidden="true"
      width={textWidth}
      height={textHeight}
      priority
      className={cn(
        'object-contain select-none',
        tone === 'auto' && 'hidden dark:block',
      )}
    />
  )
  const textMark =
    tone === 'dark'  ? navyMark  :
    tone === 'light' ? whiteMark :
    /* auto */         <>{navyMark}{whiteMark}</>

  const mark = (
    <div
      className={cn('inline-flex items-center', s.gap, className)}
      aria-label="CLYRO — AI video creation"
      role="img"
    >
      {cMark}
      {textMark}
    </div>
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
