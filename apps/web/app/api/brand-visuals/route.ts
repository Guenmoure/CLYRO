import { NextRequest, NextResponse } from 'next/server'
import { createFalClient } from '@fal-ai/client'
import type { BrandBrief, BrandDirection } from '@clyro/shared'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const fal = createFalClient({ credentials: process.env.FAL_KEY })

type FalModel = 'fal-ai/flux-pro/v1.1-ultra' | 'fal-ai/flux/dev' | 'fal-ai/recraft-v3'

interface AssetJob {
  key: string
  label: string
  model: FalModel
  prompt: string
  image_size: string
  style?: string
}

async function runJob(job: AssetJob): Promise<{ key: string; url: string | undefined }> {
  try {
    const input: Record<string, unknown> = {
      prompt: job.prompt,
      image_size: job.image_size,
      num_images: 1,
    }
    if (job.style) input.style = job.style
    if (job.model === 'fal-ai/flux/dev') input.num_inference_steps = 28
    if (job.model === 'fal-ai/flux-pro/v1.1-ultra') input.num_inference_steps = 28

    const result = await fal.run(job.model, { input }) as any
    const url = result?.images?.[0]?.url ?? result?.data?.images?.[0]?.url
    return { key: job.key, url }
  } catch (err) {
    console.error(`[brand-visuals] ${job.key} failed:`, err)
    return { key: job.key, url: undefined }
  }
}

async function runBatch(jobs: AssetJob[]): Promise<Record<string, string | undefined>> {
  const results = await Promise.all(jobs.map(runJob))
  return Object.fromEntries(results.map(r => [r.key, r.url]))
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { brief: BrandBrief; direction: BrandDirection; referenceUrl?: string }
    const { brief, direction, referenceUrl } = body

    if (!brief || !direction) return NextResponse.json({ error: 'brief and direction required' }, { status: 400 })
    if (!process.env.FAL_KEY) return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })

    const style = `${direction.keywords.join(', ')}, ${direction.mood}`
    const colors = `primary ${direction.palette.primary}, secondary ${direction.palette.secondary}, accent ${direction.palette.accent}`
    const brandBase = `"${brief.name}" brand, ${brief.secteur} industry, ${style}, ${colors}`
    const lifestyleCtx = referenceUrl ? `, inspired by reference image style` : ''

    const allJobs: AssetJob[] = [
      // Batch 1: Core identity assets
      {
        key: 'mockup_business_card',
        label: 'Carte de visite',
        model: 'fal-ai/flux/dev',
        prompt: `professional business card design mockup, ${brandBase}, ${direction.typography.heading} font, minimal clean layout, top-down flat lay, white marble surface, soft shadow, ultra-realistic product photo, square format`,
        image_size: 'square_hd',
      },
      {
        key: 'mockup_social_post',
        label: 'Post social media',
        model: 'fal-ai/flux/dev',
        prompt: `square social media post 1080x1080, ${brandBase}, bold typography "${direction.tagline}", clean branded graphic design, no people, professional content creation`,
        image_size: 'square_hd',
      },
      {
        key: 'mockup_letterhead',
        label: 'En-tête courrier',
        model: 'fal-ai/flux/dev',
        prompt: `A4 letterhead stationery design, ${brandBase}, professional corporate document, top header with brand colors, clean white page, subtle texture, flat lay photo`,
        image_size: 'portrait_4_3',
      },
      {
        key: 'mockup_email_header',
        label: 'Bannière email',
        model: 'fal-ai/flux/dev',
        prompt: `email newsletter header banner, horizontal format, ${brandBase}, ${direction.mood}, subtle gradient background, no people, professional digital marketing`,
        image_size: 'landscape_16_9',
      },
      // Batch 2: Lifestyle + patterns
      {
        key: 'lifestyle_mockup',
        label: 'Lifestyle mockup',
        model: 'fal-ai/flux-pro/v1.1-ultra',
        prompt: `professional lifestyle product photography, ${brandBase}${lifestyleCtx}, modern ${brief.secteur} setting, natural light, aspirational lifestyle, editorial quality, high-end advertising photo`,
        image_size: 'landscape_16_9',
      },
      {
        key: 'pattern_url',
        label: 'Pattern textile',
        model: 'fal-ai/flux/dev',
        prompt: `seamless repeating brand pattern, ${direction.keywords.join(' ')}, ${colors}, geometric minimal motifs, textile surface design, no text, clean vector-like repeat pattern`,
        image_size: 'square_hd',
      },
      {
        key: 'brand_banner',
        label: 'Bannière web',
        model: 'fal-ai/flux/dev',
        prompt: `modern website hero banner, ${brandBase}, "${direction.tagline}" tagline, bold impactful composition, no people, clean digital design, ${direction.typography.heading} typography style`,
        image_size: 'landscape_16_9',
      },
      {
        key: 'illustration_url',
        label: 'Illustration éditoriale',
        model: 'fal-ai/recraft-v3',
        prompt: `editorial illustration for ${brief.name} brand, ${style}, ${colors}, flat vector illustration, ${brief.secteur} concept, modern graphic art, no text`,
        image_size: 'square_hd',
        style: 'vector_illustration',
      },
      // Batch 3: Extended mockups
      {
        key: 'mockup_packaging',
        label: 'Packaging / Boîte',
        model: 'fal-ai/flux-pro/v1.1-ultra',
        prompt: `premium product packaging mockup, ${brandBase}, 3D box or bag on clean surface, ${direction.mood}, studio lighting, e-commerce quality product photo`,
        image_size: 'square_hd',
      },
      {
        key: 'og_image_url',
        label: 'Image OG / Meta',
        model: 'fal-ai/flux/dev',
        prompt: `open graph social preview image 1200x630, ${brandBase}, clean modern branded card, "${brief.name}" prominent, "${direction.tagline}", professional graphic`,
        image_size: 'landscape_16_9',
      },
    ]

    // Run in batches of 4 to respect rate limits
    const batches: AssetJob[][] = []
    for (let i = 0; i < allJobs.length; i += 4) {
      batches.push(allJobs.slice(i, i + 4))
    }

    let allResults: Record<string, string | undefined> = {}
    for (const batch of batches) {
      const batchResult = await runBatch(batch)
      allResults = { ...allResults, ...batchResult }
    }

    return NextResponse.json(allResults)
  } catch (err) {
    console.error('[brand-visuals]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Asset generation failed' }, { status: 500 })
  }
}
