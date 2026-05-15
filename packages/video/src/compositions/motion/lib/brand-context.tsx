import React, { createContext, useContext, useMemo } from 'react'

/**
 * Brand identity threaded to every motion-design scene.
 *
 * Before this context was introduced, only `hero_typo` and `logo_reveal`
 * consumed `brandConfig.primary_color` — the other 6 scenes hardcoded
 * `#ff6b00`, `#1a0800`, etc. so every video looked the same regardless
 * of the customer's brand. Now any scene can call `useBrand()` to read
 * the live brand palette and font.
 */
export interface BrandTheme {
  /** Hex `#RRGGBB`. Primary brand color — used for headlines, accents, particles. */
  primary:   string
  /** Hex `#RRGGBB`. Secondary brand color — used for highlights, second
   *  stat value, accent particles. Falls back to primary when missing. */
  secondary: string
  /** CSS `font-family` declaration. e.g. `"Inter, sans-serif"`. */
  fontFamily: string
}

const DEFAULT_THEME: BrandTheme = {
  primary:    '#E8593C',  // editorial terracotta — matches CLYRO web palette
  secondary:  '#0A0A14',
  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
}

const BrandContext = createContext<BrandTheme>(DEFAULT_THEME)

export const BrandProvider: React.FC<{
  value?: Partial<BrandTheme>
  children: React.ReactNode
}> = ({ value, children }) => {
  const theme = useMemo<BrandTheme>(() => ({
    primary:    value?.primary    ?? DEFAULT_THEME.primary,
    secondary:  value?.secondary  ?? value?.primary ?? DEFAULT_THEME.secondary,
    fontFamily: value?.fontFamily ?? DEFAULT_THEME.fontFamily,
  }), [value?.primary, value?.secondary, value?.fontFamily])
  return <BrandContext.Provider value={theme}>{children}</BrandContext.Provider>
}

export function useBrand(): BrandTheme {
  return useContext(BrandContext)
}

// ── Design tokens ────────────────────────────────────────────────────────
//
// Centralised values so the 8 scenes stop inventing their own font sizes
// and spacing. If a scene needs a value outside this scale, that's a
// design discussion, not an inline magic number.

export const TOKENS = {
  /** Heading & body font sizes, expressed for a 1080p canvas. Scenes
   *  scale these via `useVideoConfig().height / 1080` when rendering on
   *  9:16 (1920 height) or 1:1 (1080 height). */
  fontScale: {
    displayXL: 160,  // hero kill scene
    displayL:  120,  // standard hero
    displayM:  88,   // logo outro
    headingL:  56,   // section title (stats headline, 3d_cards headline)
    headingM:  42,
    bodyL:     22,
    bodyM:     18,
    bodyS:     14,
    labelS:    13,
  },
  /** Stops at 8px multiples — 4, 8, 12, 16, 24, 32, 48, 64, 96. */
  spacing: {
    xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48, hero: 64, mega: 96,
  },
  /** Radius for cards, pills, badges. */
  radius: {
    pill: 9999, card: 20, badge: 14, sm: 8,
  },
} as const
