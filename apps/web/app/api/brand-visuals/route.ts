import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createFalClient } from '@fal-ai/client'
import type { BrandBrief, BrandDirection } from '@clyro/shared'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

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

/**
 * POST /api/brand-visuals
 *
 * Two modes:
 *
 * 1) Bulk (default) — body = { brief, direction, referenceUrl? }
 *    Builds all 10 asset jobs and returns `{ [key]: url }`. Runs in
 *    batches of 4 to respect fal.ai's rate limit.
 *
 * 2) Single regen — body = { brief, direction, key }
 *    Regenerates ONE asset by its key (e.g. "mockup_business_card") and
 *    returns `{ key, url }`. Saves both compute time and credits when
 *    the user is iterating on a single tile.
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: this route calls fal.ai flux-pro / flux-dev / recraft-v3
    // — up to 10 images per bulk run, ~$0.05/image. Unauthenticated would
    // allow a single curl loop to drain the FAL_KEY balance.
    // See .claude/rules/security.md → "Cost-amplification protection".
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Un appel bulk = jusqu'à 10 images flux-pro/flux-dev/recraft → quota serré.
    const limit = checkRateLimit('brand-visuals', user.id, 20)
    if (!limit.allowed) return rateLimitResponse(limit)

    const body = await request.json() as {
      brief: BrandBrief
      direction: BrandDirection
      referenceUrl?: string
      key?: string
    }
    const { brief, direction, referenceUrl, key: regenKey } = body

    if (!brief || !direction) return NextResponse.json({ error: 'brief and direction required' }, { status: 400 })
    if (!process.env.FAL_KEY) return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })

    // ── Build a rich brief summary used by every prompt ────────────────────
    // Before: each prompt only had "<name> brand, <secteur> industry" — far
    // too thin for fal.ai/flux to anchor on. Now we feed cible, USP, values
    // and concurrents so the generator has a reason to make THIS brand's
    // visuals look different from any other in the same sector.
    const colors        = `primary ${direction.palette.primary}, secondary ${direction.palette.secondary}, accent ${direction.palette.accent}, neutral ${direction.palette.neutral}`
    const moodWords     = direction.keywords.slice(0, 5).join(', ')
    const briefLine     = [
      `brand "${brief.name}"`,
      `${brief.secteur} sector`,
      brief.cible           ? `for ${brief.cible.slice(0, 80)}`             : null,
      brief.usp             ? `unique angle: ${brief.usp.slice(0, 120)}`    : null,
      brief.valeurs?.length ? `values ${brief.valeurs.slice(0,3).join(', ')}` : null,
      brief.concurrents     ? `AVOID looking like ${brief.concurrents}`     : null,
    ].filter(Boolean).join('; ')
    const moodLine      = `direction "${direction.name}", mood: ${moodWords}; ${direction.mood.slice(0, 120)}`
    const styleAxioms   = `palette colors strictly: ${colors}. Cinematic, art-directed, magazine quality. No stock-photo cliché.`
    const lifestyleCtx  = referenceUrl ? ' Inspired by the visual style of an attached reference image.' : ''

    // Helper to compose a prompt with the standard "brief / mood / job /
    // constraints" structure. Keeping prompts to ~4 sentences keeps Flux on
    // task — longer prompts dilute the strongest signals.
    const composePrompt = (jobLine: string, constraints: string) =>
      `${jobLine}. Brief: ${briefLine}. ${moodLine}. ${styleAxioms} ${constraints}`

    const allJobs: AssetJob[] = [
      // Batch 1: Core identity assets ────────────────────────────────────────
      {
        key: 'mockup_business_card',
        label: 'Carte de visite',
        model: 'fal-ai/flux/dev',
        prompt: composePrompt(
          `Professional business card mockup, top-down flat lay on a textured ${direction.palette.neutral} surface, soft directional natural light, single card centred with subtle shadow`,
          `${direction.typography.heading}-style typography visible on the card. Constraints: no real text legibility required (letters can be abstract), no people, no extra props, square framing, photorealistic product shot.`,
        ),
        image_size: 'square_hd',
      },
      {
        key: 'mockup_social_post',
        label: 'Post social media',
        model: 'fal-ai/flux/dev',
        prompt: composePrompt(
          `Square 1080×1080 social media post graphic, bold editorial layout, the tagline "${direction.tagline}" set as oversized centered typography (heading font feel)`,
          `Constraints: NO people, NO faces, single layout only, branded graphic design, generous negative space (≥35 %), suitable for Instagram / LinkedIn.`,
        ),
        image_size: 'square_hd',
      },
      {
        key: 'mockup_letterhead',
        label: 'En-tête courrier',
        model: 'fal-ai/flux/dev',
        prompt: composePrompt(
          `A4 letterhead stationery design, portrait orientation, flat lay on a plain off-white desk, single sheet only, top header strip in brand primary color with tiny logo placeholder, body left blank or with faint lorem ipsum grey`,
          `Constraints: photorealistic top-down product shot, NO people, NO text legibility required, soft natural light, subtle paper texture.`,
        ),
        image_size: 'portrait_4_3',
      },
      {
        key: 'mockup_email_header',
        label: 'Bannière email',
        model: 'fal-ai/flux/dev',
        prompt: composePrompt(
          `Email newsletter header banner, 16:9 horizontal, subtle gradient using brand primary→secondary, abstract geometric motif on the right, room for a logo on the left`,
          `Constraints: NO people, NO real text, web-safe color usage, professional digital marketing banner suitable for Mailchimp / Klaviyo headers.`,
        ),
        image_size: 'landscape_16_9',
      },
      // Batch 2: Lifestyle + patterns ───────────────────────────────────────
      {
        key: 'lifestyle_mockup',
        label: 'Lifestyle mockup',
        model: 'fal-ai/flux-pro/v1.1-ultra',
        prompt: composePrompt(
          `Editorial lifestyle scene tied to the ${brief.secteur} sector, modern aspirational setting that matches the cible (${brief.cible?.slice(0, 60) || 'the target audience'}), natural directional light, shallow depth of field${lifestyleCtx}`,
          `Constraints: hands/silhouettes OK but NO recognisable faces, real-looking environment (not studio cyclo), magazine-cover quality, color grading aligned with the brand palette (highlights ${direction.palette.accent}, shadows ${direction.palette.primary}).`,
        ),
        image_size: 'landscape_16_9',
      },
      {
        key: 'pattern_url',
        label: 'Pattern textile',
        model: 'fal-ai/flux/dev',
        prompt: composePrompt(
          `Seamless repeating brand pattern, geometric minimal motifs derived from the keywords (${moodWords}), tileable surface design suitable for packaging or web background`,
          `Constraints: NO text, NO logos, NO faces, palette restricted to brand colors only, vector-like flat repeat, motif size visible at 800 px.`,
        ),
        image_size: 'square_hd',
      },
      {
        key: 'brand_banner',
        label: 'Bannière web',
        model: 'fal-ai/flux/dev',
        prompt: composePrompt(
          `Website hero banner, 16:9, bold impactful composition, the tagline "${direction.tagline}" set in large ${direction.typography.heading}-style typography on the left half, abstract brand motif on the right half`,
          `Constraints: NO people, NO faces, professional digital design suitable as Webflow / Framer hero, clear focal point.`,
        ),
        image_size: 'landscape_16_9',
      },
      {
        key: 'illustration_url',
        label: 'Illustration éditoriale',
        model: 'fal-ai/recraft-v3',
        prompt: composePrompt(
          `Editorial flat vector illustration that visualises the brand's unique angle (${brief.usp?.slice(0, 80) || `${brief.secteur} expertise`}), modern graphic art, single scene composition, magazine-spread quality`,
          `Constraints: flat vector style, NO text, NO logos, brand palette only, suitable for hero illustration on landing page.`,
        ),
        image_size: 'square_hd',
        style: 'vector_illustration',
      },
      // Batch 3: Extended mockups ───────────────────────────────────────────
      {
        key: 'mockup_packaging',
        label: 'Packaging / Boîte',
        model: 'fal-ai/flux-pro/v1.1-ultra',
        prompt: composePrompt(
          `Premium product packaging mockup tailored to ${brief.secteur} (box, jar, bottle, tube — pick the most plausible for the sector), studio lighting on a tinted ${direction.palette.background} backdrop, single hero product centred`,
          `Constraints: e-commerce quality product photography, NO people, real-looking material (cardboard, glass, frosted plastic — pick one), brand colors visible on packaging surface but no legible text required.`,
        ),
        image_size: 'square_hd',
      },
      {
        key: 'og_image_url',
        label: 'Image OG / Meta',
        model: 'fal-ai/flux/dev',
        prompt: composePrompt(
          `Open Graph social preview card 1200×630, clean branded layout, the brand name "${brief.name}" set as bold centered title and the tagline "${direction.tagline}" below in lighter weight`,
          `Constraints: clear hierarchy, NO people, NO photo background — flat brand-color background only, professional graphic suitable as og:image meta tag.`,
        ),
        image_size: 'landscape_16_9',
      },
    ]

    // ── Mode 2 : single-asset regen ──────────────────────────────────────
    if (regenKey) {
      const job = allJobs.find(j => j.key === regenKey)
      if (!job) {
        return NextResponse.json({ error: `unknown asset key "${regenKey}"`, validKeys: allJobs.map(j => j.key) }, { status: 400 })
      }
      const { url } = await runJob(job)
      if (!url) return NextResponse.json({ error: 'Asset regeneration failed' }, { status: 502 })
      return NextResponse.json({ key: regenKey, url })
    }

    // ── Mode 1 : bulk — run in batches of 4 to respect rate limits ────────
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
    // Generic message only — err.message can leak fal.ai account details.
    console.error('[brand-visuals]', err)
    return NextResponse.json({ error: 'Asset generation failed', code: 'GENERATION_ERROR' }, { status: 500 })
  }
}
