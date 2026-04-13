import { NextRequest, NextResponse } from 'next/server'
import { createFalClient } from '@fal-ai/client'
import type { BrandBrief, BrandDirection } from '@clyro/shared'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const fal = createFalClient({ credentials: process.env.FAL_KEY })

const LOGO_CONCEPTS = [
  { name: 'Monogramme', style_hint: 'bold monogram lettermark, single letter or initials, abstract geometric form, no text around it' },
  { name: 'Wordmark', style_hint: 'clean elegant wordmark logotype, brand name only in refined typography, no icon element' },
  { name: 'Emblème', style_hint: 'compact emblem combining a simple geometric icon above the brand name, badge or seal style' },
]

const BG_MAP = {
  white: '#FFFFFF',
  black: '#0A0A0A',
}

async function generateLogoVariant(brief: BrandBrief, direction: BrandDirection, concept: typeof LOGO_CONCEPTS[0], bgColor: string): Promise<string | undefined> {
  const isLight = bgColor === '#FFFFFF'
  const isDark = bgColor === '#0A0A0A'
  const textColor = isLight ? direction.palette.primary : (isDark ? '#FFFFFF' : '#FFFFFF')

  // IMPORTANT: Do NOT include brand name in the prompt — recraft-v3 generates illegible/misspelled text.
  // The brand name is overlaid in CSS via LogoConceptCard (brand-studio.tsx) with the correct Google Font.
  const prompt = `professional logo design, ${concept.style_hint}, ${direction.keywords.join(', ')}, color ${textColor} on ${bgColor} background, vector style, clean minimal professional branding, isolated centered composition, no text, no letters, no words, no gradients unless elegant, no decorative frames, award-winning identity design, ${brief.secteur} industry`

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { brief: BrandBrief; direction: BrandDirection }
    const { brief, direction } = body

    if (!brief || !direction) return NextResponse.json({ error: 'brief and direction required' }, { status: 400 })
    if (!process.env.FAL_KEY) return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })

    const primaryBg = direction.palette.primary

    // 9 parallel calls: 3 concepts × 3 backgrounds
    const allJobs = LOGO_CONCEPTS.flatMap((concept, ci) => [
      generateLogoVariant(brief, direction, concept, '#FFFFFF').then(url => ({ ci, bg: 'white', url })),
      generateLogoVariant(brief, direction, concept, primaryBg).then(url => ({ ci, bg: 'brand', url })),
      generateLogoVariant(brief, direction, concept, '#0A0A0A').then(url => ({ ci, bg: 'black', url })),
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
