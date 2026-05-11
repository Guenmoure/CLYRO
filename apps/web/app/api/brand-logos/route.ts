import { NextRequest, NextResponse } from 'next/server'
import { createFalClient } from '@fal-ai/client'
import type { BrandBrief, BrandDirection } from '@clyro/shared'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const fal = createFalClient({ credentials: process.env.FAL_KEY })

// Each concept now gets a richer style descriptor PLUS a "construction" rule
// so recraft-v3 produces visually distinct outputs (without the rule, the 3
// concepts collapse into the same abstract mark).
const LOGO_CONCEPTS = [
  {
    name: 'Monogramme',
    style_hint: 'bold monogram lettermark logo, single capital letter or 2-letter ligature, abstract geometric construction, balanced negative space, no text around it, no full word',
    construction: 'a single capital letter or two interlocked letters forming the brand initials',
  },
  {
    name: 'Wordmark',
    style_hint: 'clean elegant wordmark logotype, brand name spelled out in refined custom-feeling typography, single weight, no icon element, no underline, no flourish',
    construction: 'the brand name set in custom-feeling type, no accompanying icon',
  },
  {
    name: 'Emblème',
    style_hint: 'compact emblem combining a SIMPLE geometric icon and the brand name, badge or seal arrangement, contained composition, icon above or beside the name',
    construction: 'a minimal geometric icon paired with the brand name in a contained badge layout',
  },
] as const

// Extract 3-5 concrete differentiator words from the brief to feed the model.
// The result reads like a creative brief, not a tag soup.
function buildBriefSummary(brief: BrandBrief, direction: BrandDirection): string {
  const parts: string[] = []
  parts.push(`for "${brief.name}", a ${brief.secteur} brand`)
  if (brief.cible)             parts.push(`targeting ${brief.cible}`)
  if (brief.usp)               parts.push(`whose differentiator is: ${brief.usp.slice(0, 140)}`)
  if (brief.valeurs?.length)   parts.push(`brand values: ${brief.valeurs.slice(0, 3).join(', ')}`)
  parts.push(`direction "${direction.name}" — mood: ${direction.mood.slice(0, 100)}`)
  parts.push(`keywords: ${direction.keywords.slice(0, 5).join(', ')}`)
  if (brief.concurrents)       parts.push(`AVOID looking like: ${brief.concurrents}`)
  return parts.join('. ')
}

async function generateLogoVariant(brief: BrandBrief, direction: BrandDirection, concept: typeof LOGO_CONCEPTS[number], bgColor: string): Promise<string | undefined> {
  const isLight = bgColor === '#FFFFFF'
  const isDark = bgColor === '#0A0A0A'
  const textColor = isLight ? direction.palette.primary : '#FFFFFF'

  const briefSummary = buildBriefSummary(brief, direction)

  // IMPORTANT: Do NOT include brand NAME as literal text in the prompt for
  // monogram/emblem variants — recraft-v3 generates illegible/misspelled
  // text. For the wordmark concept we DO allow the name through "lettering
  // suggestion" so the model produces a more wordmark-shaped output (we
  // still overlay the real text via CSS in LogoConceptCard).
  const wordmarkHint = concept.name === 'Wordmark'
    ? `letterforms inspired by the word "${brief.name.slice(0, 12)}" but rendered as abstract refined lettering (do NOT spell the actual word — letters may be illegible)`
    : 'no text, no letters, no words'

  const prompt = [
    `Professional brand logo design — ${concept.construction}.`,
    briefSummary + '.',
    concept.style_hint + '.',
    `Composition: isolated centred mark on a ${isLight ? 'pure white' : isDark ? 'pure black' : 'brand-colored'} background, generous negative space, single object only, no surrounding elements, no decorative frame.`,
    `Color: render the mark in ${textColor} (HEX ${textColor}). No gradients unless elegant and subtle.`,
    `Style: vector flat, award-winning identity design, geometric precision, looks at home in a 2026 design annual.`,
    `Constraints: ${wordmarkHint}, no photo realism, no 3D, no shadow, no glow, no rasterized texture, no mockup.`,
  ].join(' ')

  try {
    const result = await fal.run('fal-ai/recraft-v3', {
      input: {
        prompt,
        image_size: 'square_hd',
        style: 'vector_illustration',
        colors: [
          { r: parseInt(textColor.slice(1,3), 16), g: parseInt(textColor.slice(3,5), 16), b: parseInt(textColor.slice(5,7), 16) },
        ],
      },
    }) as any
    return result?.images?.[0]?.url ?? (result?.data?.images?.[0]?.url)
  } catch (err) {
    console.error('[brand-logos] fal error:', err)
    return undefined
  }
}

/**
 * POST /api/brand-logos
 *
 * Two modes:
 *
 * 1) Bulk (default) — body = { brief, direction }
 *    Generates the full grid (3 concepts × 3 backgrounds = 9 logos) in
 *    parallel and returns { concepts: BrandLogoConcept[] }.
 *
 * 2) Single regen — body = { brief, direction, conceptIndex, bg }
 *    Regenerates ONE specific cell (concept × background) without re-running
 *    the other 8. Returns { url, conceptIndex, bg }. Used by the per-card
 *    "Regenerate" button in brand-studio.tsx to refresh a single tile.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      brief:         BrandBrief
      direction:     BrandDirection
      conceptIndex?: number
      bg?:           'white' | 'brand' | 'black'
    }
    const { brief, direction, conceptIndex, bg } = body

    if (!brief || !direction) return NextResponse.json({ error: 'brief and direction required' }, { status: 400 })
    if (!process.env.FAL_KEY) return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })

    const primaryBg = direction.palette.primary

    // ── Mode 2 : single-cell regen ──────────────────────────────────────────
    if (typeof conceptIndex === 'number' && bg) {
      if (conceptIndex < 0 || conceptIndex >= LOGO_CONCEPTS.length) {
        return NextResponse.json({ error: `conceptIndex out of range (0-${LOGO_CONCEPTS.length - 1})` }, { status: 400 })
      }
      const concept = LOGO_CONCEPTS[conceptIndex]
      const bgColor = bg === 'white' ? '#FFFFFF' : bg === 'black' ? '#0A0A0A' : primaryBg
      const url = await generateLogoVariant(brief, direction, concept, bgColor)
      if (!url) return NextResponse.json({ error: 'Logo regeneration failed' }, { status: 502 })
      return NextResponse.json({ url, conceptIndex, bg })
    }

    // ── Mode 1 : bulk grid (3 × 3) ─────────────────────────────────────────
    const allJobs = LOGO_CONCEPTS.flatMap((concept, ci) => [
      generateLogoVariant(brief, direction, concept, '#FFFFFF').then(url => ({ ci, bg: 'white' as const, url })),
      generateLogoVariant(brief, direction, concept, primaryBg).then(url => ({ ci, bg: 'brand' as const, url })),
      generateLogoVariant(brief, direction, concept, '#0A0A0A').then(url => ({ ci, bg: 'black' as const, url })),
    ])

    const results = await Promise.all(allJobs)

    const concepts = LOGO_CONCEPTS.map((concept, ci) => ({
      name: concept.name,
      logo_white_bg: results.find(r => r.ci === ci && r.bg === 'white')?.url,
      logo_brand_bg: results.find(r => r.ci === ci && r.bg === 'brand')?.url,
      logo_black_bg: results.find(r => r.ci === ci && r.bg === 'black')?.url,
    }))

    return NextResponse.json({ concepts })
  } catch (err) {
    console.error('[brand-logos]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Logo generation failed' }, { status: 500 })
  }
}
