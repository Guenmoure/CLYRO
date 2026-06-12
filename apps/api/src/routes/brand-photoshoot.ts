import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { supabaseAdmin } from '../lib/supabase'
import { logger } from '../lib/logger'
import { createFalClient } from '@fal-ai/client'
import { deductCredits, refundCredits, InsufficientCreditsError, creditCostForVideo } from '../services/credits'
import { PHOTOSHOOT_TEMPLATES, PHOTOSHOOT_TEMPLATE_MAP, publicTemplate } from '../config/photoshoot-templates'
import { renderQueue, isRedisReady } from '../queues/renderQueue'
import { runMotionAuto } from '../pipelines/motion-router'

export const brandPhotoshootRouter = Router()

const fal = createFalClient({ credentials: process.env.FAL_KEY })

const TIMEOUT_MS = 180_000
const VARIATIONS_PER_PHOTOSHOOT = 4
const CREDITS_PER_VARIATION     = 1

const TEMPLATE_PROMPTS: Record<string, string> = {
  studio: 'Professional product photography on seamless white to gray gradient backdrop, soft studio lighting, 3-point light setup, commercial catalog shot, clean reflections on surface, shot on Phase One, 80mm, 8K',
  floating: 'Product floating in mid-air against a clean gradient background, dramatic shadow beneath, zero-gravity product photography, commercial advertising shot, professional studio lighting, 8K',
  ingredient: 'Product surrounded by its key ingredients and components artfully arranged, overhead flat-lay composition, professional food and product photography, marble surface, natural window light, 8K',
  in_use: 'Product being used in a lifestyle context, natural environment, warm ambient lighting, lifestyle brand photography, shallow depth of field, editorial style, 8K',
}

const MOTION_PROMPTS: Record<string, string> = {
  zoom_in:   'Slow cinematic zoom into the center of the product, professional commercial motion, smooth camera movement',
  pan_left:  'Smooth dolly pan from right to left revealing the product, commercial motion, professional camera work',
  pan_right: 'Smooth dolly pan from left to right revealing the product, commercial motion, professional camera work',
  zoom_out:  'Slow cinematic pull-back zoom revealing the full scene, commercial motion, professional camera work',
  orbit:     'Slow 360-degree orbit around the product, professional turntable motion, smooth rotation',
  pulse:     'Subtle breathing and pulsing motion with slight scale animation, product showcase, gentle movement',
}

const photoshootSchema = z.object({
  brand_kit_id:     z.string().uuid(),
  source_image_url: z.string().url(),
  template:         z.enum(['studio', 'floating', 'ingredient', 'in_use']),
  custom_prompt:    z.string().max(300).optional(),
  catalog_item_id:  z.string().uuid().optional(),
})

const animateSchema = z.object({
  brand_kit_id:     z.string().uuid(),
  source_image_url: z.string().url(),
  motion_type:      z.enum(['zoom_in', 'pan_left', 'pan_right', 'zoom_out', 'orbit', 'pulse']),
  duration:         z.enum(['3', '5']).default('5'),
})

// ── Persistent Photoshoots — Phase 4 du portage Pomelli ─────────────────────
// L'ancienne route stateless POST /brand/photoshoot reste en place pour la
// rétro-compat. Les endpoints ci-dessous (POST /brand/photoshoots et amis)
// utilisent la table brand_photoshoots et génèrent 4 variations en parallèle.

const createPhotoshootSchema = z.object({
  brand_kit_id:     z.string().uuid(),
  mode:             z.enum(['product_template', 'generate_edit']),
  input_image_url:  z.string().url().optional(),
  reference_urls:   z.array(z.string().url()).max(10).optional(),
  template_id:      z.string().min(1).max(60).optional(),
  prompt:           z.string().max(1500).optional(),
  aspect_ratio:     z.enum(['9:16', '1:1', '4:5', '16:9']).optional(),
})

const ASPECT_TO_FAL: Record<'9:16' | '1:1' | '4:5' | '16:9', string> = {
  '9:16': '9:16',
  '1:1':  '1:1',
  '4:5':  '4:5',
  '16:9': '16:9',
}

/**
 * GET /api/v1/brand/photoshoots/templates
 * Liste publique des templates système (sans le prompt interne).
 */
brandPhotoshootRouter.get('/brand/photoshoots/templates', authMiddleware, async (_req, res) => {
  res.json({ data: PHOTOSHOOT_TEMPLATES.map(publicTemplate) })
})

/**
 * POST /api/v1/brand/photoshoots
 * Crée une session de photoshoot, lance 4 générations fal.ai en parallèle,
 * met à jour la ligne avec les URLs. Exécution INLINE (~30-60 s) car les 4
 * calls fal.ai courent en Promise.allSettled. Le front affiche un loader.
 *
 * V1 : ne supporte que `mode='product_template'`. Le mode `generate_edit`
 * (prompt libre + reference images) est posé dans le schéma mais le pipeline
 * V2 le branchera.
 */
brandPhotoshootRouter.post('/brand/photoshoots', authMiddleware, async (req, res) => {
  const parsed = createPhotoshootSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }
  const { brand_kit_id, mode, input_image_url, reference_urls, template_id, prompt, aspect_ratio } = parsed.data

  if (mode === 'product_template') {
    if (!input_image_url) {
      res.status(400).json({ error: 'input_image_url required for product_template', code: 'VALIDATION_ERROR' })
      return
    }
    if (!template_id || !PHOTOSHOOT_TEMPLATE_MAP[template_id]) {
      res.status(400).json({ error: 'Unknown template_id', code: 'UNKNOWN_TEMPLATE' })
      return
    }
  } else if (mode === 'generate_edit') {
    // V1 V2-deferred — on accepte la création mais le pipeline saute la
    // génération avec un status error explicite.
    if (!prompt || prompt.trim().length < 10) {
      res.status(400).json({ error: 'prompt required for generate_edit', code: 'VALIDATION_ERROR' })
      return
    }
  }

  try {
    // Ownership du kit
    const { data: kit } = await supabaseAdmin
      .from('brand_kits')
      .select('primary_color, secondary_color, name')
      .eq('id', brand_kit_id)
      .eq('user_id', req.userId)
      .single()
    if (!kit) {
      res.status(404).json({ error: 'Brand kit not found', code: 'NOT_FOUND' })
      return
    }

    // Crée la ligne en `generating`
    const { data: shoot, error: insertErr } = await supabaseAdmin
      .from('brand_photoshoots')
      .insert({
        brand_kit_id,
        user_id:         req.userId,
        mode,
        input_image_url: input_image_url ?? null,
        reference_urls:  reference_urls ?? [],
        prompt:          prompt ?? null,
        template_id:     template_id ?? null,
        aspect_ratio:    aspect_ratio ?? '9:16',
        status:          'generating',
      })
      .select()
      .single()
    if (insertErr || !shoot) {
      logger.error({ err: insertErr }, 'brand/photoshoots insert failed')
      res.status(500).json({ error: 'Failed to create photoshoot', code: 'DB_ERROR' })
      return
    }

    // Coût total = 4 variations × 1 crédit. Refund proportionnel au nombre
    // de variations qui échouent.
    const totalCost = VARIATIONS_PER_PHOTOSHOOT * CREDITS_PER_VARIATION
    try {
      await deductCredits(req.userId, totalCost, `brand_photoshoot:${shoot.id}`, {
        kind: 'brand_photoshoot',
        brand_kit_id,
        mode,
      })
    } catch (err) {
      await supabaseAdmin.from('brand_photoshoots').delete().eq('id', shoot.id)
      if (err instanceof InsufficientCreditsError) {
        res.status(402).json({
          error: 'Insufficient credits', code: 'INSUFFICIENT_CREDITS',
          required: err.required, available: err.available,
        })
        return
      }
      throw err
    }

    // Lance les 4 générations en parallèle (Promise.allSettled — un échec
    // d'une variation n'invalide pas les autres). Le client reçoit la ligne
    // en `generating` et poll pour le statut final.
    void (async () => {
      try {
        const brandSuffix = `, brand accent color ${kit.primary_color}${kit.secondary_color ? ` and ${kit.secondary_color}` : ''}`
        const aspect = ASPECT_TO_FAL[aspect_ratio ?? '9:16']

        // Construction du prompt + input fal selon le mode. En product_template
        // on garde le prompt curé du template + image_prompt sur la photo
        // produit. En generate_edit on prend le prompt libre de l'utilisateur,
        // et la PREMIÈRE reference URL si présente sert d'image_prompt
        // (FLUX-pro accepte une seule image de référence).
        let fullPrompt: string
        let imagePromptUrl: string | undefined
        if (mode === 'product_template') {
          const template = PHOTOSHOOT_TEMPLATE_MAP[template_id!]
          fullPrompt = prompt && prompt.trim().length > 0
            ? `${template.prompt_template}, ${prompt.trim()}${brandSuffix}`
            : `${template.prompt_template}${brandSuffix}`
          imagePromptUrl = input_image_url!
        } else {
          // generate_edit
          fullPrompt = `${prompt!.trim()}${brandSuffix}`
          imagePromptUrl = (reference_urls && reference_urls.length > 0) ? reference_urls[0] : undefined
        }

        const results = await Promise.allSettled(
          Array.from({ length: VARIATIONS_PER_PHOTOSHOOT }).map((_, idx) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const input: any = {
              prompt:           fullPrompt,
              aspect_ratio:     aspect,
              safety_tolerance: '2',
              output_format:    'jpeg',
              seed:             Date.now() + idx * 7919,
            }
            if (imagePromptUrl) {
              // Weight 0.85 pour product_template (très fidèle au produit) /
              // 0.55 pour generate_edit (la référence guide le style sans
              // dominer le prompt).
              input.image_prompt = { url: imagePromptUrl, weight: mode === 'product_template' ? 0.85 : 0.55 }
            }
            return Promise.race([
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              fal.subscribe('fal-ai/flux-pro/v1.1-ultra', { input } as any),
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error('fal.ai timeout')), TIMEOUT_MS)),
            ])
          }),
        )

        const urls: string[] = []
        let failures = 0
        for (const r of results) {
          if (r.status === 'fulfilled') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const out = ((r.value as any).data ?? r.value) as { images?: Array<{ url: string }> }
            const u = out.images?.[0]?.url
            if (u) urls.push(u); else failures++
          } else {
            failures++
            logger.warn({ photoshootId: shoot.id, reason: r.reason }, 'photoshoot variation failed')
          }
        }

        // Rembourse les variations ratées
        if (failures > 0) {
          await refundCredits(req.userId, failures * CREDITS_PER_VARIATION, `brand_photoshoot:${shoot.id}`, { reason: `${failures}_variations_failed` })
            .catch(() => null)
        }

        await supabaseAdmin
          .from('brand_photoshoots')
          .update({
            output_urls: urls,
            status:      urls.length > 0 ? 'done' : 'error',
            metadata: {
              requested:  VARIATIONS_PER_PHOTOSHOOT,
              succeeded:  urls.length,
              failed:     failures,
              prompt_used: fullPrompt,
            },
          })
          .eq('id', shoot.id)

        logger.info({ photoshootId: shoot.id, succeeded: urls.length, failed: failures }, 'Photoshoot pipeline done')
      } catch (err) {
        logger.error({ err, photoshootId: shoot.id }, 'Photoshoot pipeline crashed')
        await refundCredits(req.userId, totalCost, `brand_photoshoot:${shoot.id}`, { reason: 'pipeline_crash' })
          .catch(() => null)
        await supabaseAdmin
          .from('brand_photoshoots')
          .update({
            status:   'error',
            metadata: { error_message: err instanceof Error ? err.message : String(err) },
          })
          .eq('id', shoot.id)
          .then(() => null, () => null)
      }
    })()

    res.status(202).json({ data: shoot })
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'brand/photoshoots POST error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * GET /api/v1/brand/:brand_kit_id/photoshoots
 */
brandPhotoshootRouter.get('/brand/:brand_kit_id/photoshoots', authMiddleware, async (req, res) => {
  const brand_kit_id = String(req.params.brand_kit_id ?? '')
  try {
    const { data, error } = await supabaseAdmin
      .from('brand_photoshoots')
      .select('*')
      .eq('brand_kit_id', brand_kit_id)
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false })
      .limit(60)
    if (error) throw error
    res.json({ data: data ?? [] })
  } catch (err) {
    logger.error({ err, brand_kit_id }, 'brand/photoshoots GET list error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * GET /api/v1/brand/photoshoots/:id
 */
brandPhotoshootRouter.get('/brand/photoshoots/:id', authMiddleware, async (req, res) => {
  const id = String(req.params.id ?? '')
  try {
    const { data, error } = await supabaseAdmin
      .from('brand_photoshoots')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.userId)
      .maybeSingle()
    if (error) throw error
    if (!data) {
      res.status(404).json({ error: 'Photoshoot not found', code: 'NOT_FOUND' })
      return
    }
    res.json({ data })
  } catch (err) {
    logger.error({ err, id }, 'brand/photoshoots/:id error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * POST /api/v1/brand/photoshoots/:id/animate/:index
 * Phase 4 V2 — pont Photoshoot → Motion. La variation `output_urls[index]`
 * devient le brief d'une vidéo motion design de 6 s lancée via motion_auto.
 * Même pattern que /brand/creatives/:id/animate (Phase 3.3).
 */
brandPhotoshootRouter.post('/brand/photoshoots/:id/animate/:index', authMiddleware, async (req, res) => {
  const id = String(req.params.id ?? '')
  const indexNum = Number(req.params.index ?? '-1')
  if (!Number.isInteger(indexNum) || indexNum < 0 || indexNum > 3) {
    res.status(400).json({ error: 'index must be 0..3', code: 'VALIDATION_ERROR' })
    return
  }
  try {
    // Load photoshoot + kit
    const { data: shoot } = await supabaseAdmin
      .from('brand_photoshoots')
      .select('id, brand_kit_id, output_urls, prompt, template_id, aspect_ratio, metadata, status')
      .eq('id', id)
      .eq('user_id', req.userId)
      .maybeSingle()
    if (!shoot) {
      res.status(404).json({ error: 'Photoshoot not found', code: 'NOT_FOUND' })
      return
    }
    if (shoot.status !== 'done') {
      res.status(409).json({ error: 'Photoshoot not ready yet', code: 'NOT_READY' })
      return
    }
    const variation = (shoot.output_urls as string[])[indexNum]
    if (!variation) {
      res.status(404).json({ error: 'Variation not found at index', code: 'NOT_FOUND' })
      return
    }
    const { data: kit } = await supabaseAdmin
      .from('brand_kits')
      .select('name, primary_color, secondary_color, font_family, logo_url')
      .eq('id', shoot.brand_kit_id)
      .eq('user_id', req.userId)
      .single()
    if (!kit) {
      res.status(404).json({ error: 'Brand kit not found', code: 'NOT_FOUND' })
      return
    }

    // Aspect mapping vers Motion (Motion ne supporte pas 4:5)
    const motionFormat: '9:16' | '1:1' | '16:9' =
      shoot.aspect_ratio === '1:1'  ? '1:1'  :
      shoot.aspect_ratio === '16:9' ? '16:9' :
      shoot.aspect_ratio === '4:5'  ? '9:16' :
                                       '9:16'

    // Brief composé
    const templateName = shoot.template_id ? PHOTOSHOOT_TEMPLATE_MAP[shoot.template_id]?.name ?? shoot.template_id : 'custom'
    const lines: string[] = []
    lines.push(`Animate this ${templateName} product visual for ${kit.name}.`)
    if (shoot.prompt) lines.push(shoot.prompt)
    const promptUsed = ((shoot.metadata as { prompt_used?: string } | null)?.prompt_used) ?? null
    if (promptUsed) lines.push(`Visual reference: ${promptUsed.slice(0, 600)}`)
    const brief = lines.join('\n').slice(0, 1900)
    const title = `${kit.name} · ${templateName} animation`
    const durationSeconds = 6
    const creditCost = creditCostForVideo(durationSeconds, 'fast')
    const motionStyle = 'corporate'

    // Crée la ligne videos
    const { data: video, error: insertErr } = await supabaseAdmin
      .from('videos')
      .insert({
        user_id: req.userId,
        module:  'motion',
        style:   motionStyle,
        title,
        status:  'generating',
        metadata: {
          brief,
          format: motionFormat,
          duration: '6s',
          brand_config: kit,
          progress: 0,
          source_photoshoot_id: shoot.id,
          source_variation_url: variation,
          source_variation_index: indexNum,
        },
      })
      .select('id')
      .single()
    if (insertErr || !video) {
      logger.error({ err: insertErr }, 'photoshoot animate video insert failed')
      res.status(500).json({ error: 'Failed to create video', code: 'DB_ERROR' })
      return
    }

    const jobData = {
      type: 'motion_auto' as const,
      videoId:       video.id,
      userId:        req.userId,
      userEmail:     req.userEmail,
      title,
      brief,
      style:         motionStyle,
      format:        motionFormat,
      duration:      '6s',
      brandConfig:   { ...kit, style: motionStyle },
      voiceId:       process.env.ELEVENLABS_DEFAULT_VOICE_ID ?? '',
      creditCost,
      brandKitId:    shoot.brand_kit_id,
    }

    let enqueued = false
    if (renderQueue && isRedisReady()) {
      try {
        // jobId = videoId so /videos/:id/cancel can remove a waiting job.
        await renderQueue.remove(video.id).catch(() => null)
        await renderQueue.add('motion_auto', jobData, { jobId: video.id })
        enqueued = true
      } catch (err) {
        logger.warn({ err, videoId: video.id }, 'Photoshoot animate enqueue failed')
      }
    }
    if (!enqueued) {
      if (process.env.ALLOW_INLINE_FALLBACK !== 'true') {
        await supabaseAdmin
          .from('videos')
          .update({ status: 'error', metadata: { error_message: 'Worker unavailable', error_at: new Date().toISOString() } })
          .eq('id', video.id)
        res.status(503).json({ error: 'Worker unavailable', code: 'WORKER_UNAVAILABLE', video_id: video.id })
        return
      }
      runMotionAuto(jobData).catch(async (err: unknown) => {
        logger.error({ err, videoId: video.id }, 'Photoshoot animate inline failed')
        await supabaseAdmin
          .from('videos')
          .update({ status: 'error', metadata: { error_message: err instanceof Error ? err.message : String(err), error_at: new Date().toISOString() } })
          .eq('id', video.id)
          .then(() => null, () => null)
      })
    }

    // Déduit les crédits motion
    try {
      await deductCredits(req.userId, creditCost, `video:${video.id}`, {
        kind: 'motion',
        source: 'brand_photoshoot_animate',
        photoshoot_id: shoot.id,
        variation_index: indexNum,
      })
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        await supabaseAdmin.from('videos').update({
          status: 'error',
          metadata: { error_message: 'Insufficient credits', error_at: new Date().toISOString() },
        }).eq('id', video.id).then(() => null, () => null)
        res.status(402).json({
          error: 'Insufficient credits', code: 'INSUFFICIENT_CREDITS',
          required: err.required, available: err.available, video_id: video.id,
        })
        return
      }
      throw err
    }

    logger.info({ userId: req.userId, videoId: video.id, photoshootId: shoot.id, variation: indexNum }, 'Photoshoot variation animated')
    res.status(202).json({ data: { video_id: video.id, status: 'generating', credits_deducted: creditCost } })
  } catch (err) {
    logger.error({ err, id, index: indexNum }, 'brand/photoshoots/:id/animate error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * DELETE /api/v1/brand/photoshoots/:id
 */
brandPhotoshootRouter.delete('/brand/photoshoots/:id', authMiddleware, async (req, res) => {
  const id = String(req.params.id ?? '')
  try {
    const { error } = await supabaseAdmin
      .from('brand_photoshoots')
      .delete()
      .eq('id', id)
      .eq('user_id', req.userId)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    logger.error({ err, id }, 'brand/photoshoots DELETE error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

// ── Legacy stateless endpoint (Phase pre-4) ─────────────────────────────────

/**
 * POST /api/v1/brand/photoshoot
 * Transform a product photo into professional studio shots
 */
brandPhotoshootRouter.post('/brand/photoshoot', authMiddleware, async (req, res) => {
  const parsed = photoshootSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  const { brand_kit_id, source_image_url, template, custom_prompt } = parsed.data

  try {
    // Credit check
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('credits, plan')
      .eq('id', req.userId)
      .single()

    if (!profile) {
      res.status(404).json({ error: 'Profile not found', code: 'NOT_FOUND' })
      return
    }
    if (profile.plan !== 'studio' && profile.credits <= 0) {
      res.status(403).json({ error: 'Insufficient credits', code: 'INSUFFICIENT_CREDITS' })
      return
    }

    // Fetch brand kit
    const { data: brandKit } = await supabaseAdmin
      .from('brand_kits')
      .select('primary_color, secondary_color, name')
      .eq('id', brand_kit_id)
      .eq('user_id', req.userId)
      .single()

    if (!brandKit) {
      res.status(404).json({ error: 'Brand kit not found', code: 'NOT_FOUND' })
      return
    }

    // Build prompt
    const basePrompt = TEMPLATE_PROMPTS[template]
    const brandSuffix = `, brand accent color ${brandKit.primary_color}${brandKit.secondary_color ? ` and ${brandKit.secondary_color}` : ''}`
    const fullPrompt = custom_prompt
      ? `${basePrompt}, ${custom_prompt}${brandSuffix}`
      : `${basePrompt}${brandSuffix}`

    // Call fal.ai with image prompt (IP-adapter style)
    const result = await Promise.race([
      fal.subscribe('fal-ai/flux-pro/v1.1-ultra', {
        input: {
          prompt: fullPrompt,
          image_prompt: { url: source_image_url, weight: 0.85 },
          aspect_ratio: '1:1',
          safety_tolerance: '2',
          output_format: 'jpeg',
        },
      } as any),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('fal.ai timeout')), TIMEOUT_MS)
      ),
    ])

    const output = ((result as any).data ?? result) as { images?: Array<{ url: string }> }
    const imageUrl = output.images?.[0]?.url
    if (!imageUrl) throw new Error('No image in response')

    // Store result
    const { data: asset, error: dbError } = await supabaseAdmin
      .from('brand_assets')
      .insert({
        brand_kit_id,
        user_id: req.userId,
        type: 'social_post',
        platform: template,
        prompt: fullPrompt,
        image_url: imageUrl,
      })
      .select()
      .single()

    if (dbError) throw new Error(dbError.message)

    // Deduct credit
    if (profile.plan !== 'studio') {
      await supabaseAdmin
        .from('profiles')
        .update({ credits: profile.credits - 1 })
        .eq('id', req.userId)
    }

    logger.info({ userId: req.userId, template, brand_kit_id }, 'Photoshoot generated')
    res.status(201).json({ data: { id: asset.id, image_url: imageUrl, template, prompt_used: fullPrompt } })
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'brand/photoshoot error')
    res.status(500).json({ error: 'Photoshoot generation failed', code: 'GENERATION_ERROR' })
  }
})

/**
 * POST /api/v1/brand/animate
 * Turn a static asset into a short branded video
 */
brandPhotoshootRouter.post('/brand/animate', authMiddleware, async (req, res) => {
  const parsed = animateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  const { brand_kit_id, source_image_url, motion_type, duration } = parsed.data

  try {
    // Credit check (2 credits for video)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('credits, plan')
      .eq('id', req.userId)
      .single()

    if (!profile) {
      res.status(404).json({ error: 'Profile not found', code: 'NOT_FOUND' })
      return
    }
    if (profile.plan !== 'studio' && profile.credits < 2) {
      res.status(403).json({ error: 'Insufficient credits (need 2)', code: 'INSUFFICIENT_CREDITS' })
      return
    }

    // Verify kit ownership
    const { data: kit } = await supabaseAdmin
      .from('brand_kits')
      .select('id')
      .eq('id', brand_kit_id)
      .eq('user_id', req.userId)
      .single()

    if (!kit) {
      res.status(404).json({ error: 'Brand kit not found', code: 'NOT_FOUND' })
      return
    }

    const motionPrompt = MOTION_PROMPTS[motion_type]

    const result = await Promise.race([
      fal.subscribe('fal-ai/kling-video/v2.1/standard/image-to-video', {
        input: {
          prompt: motionPrompt,
          image_url: source_image_url,
          duration: duration,
          aspect_ratio: '16:9',
        },
      } as any),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('fal.ai video timeout')), 150_000)
      ),
    ])

    const output = (result as any).data ?? result
    const videoUrl = output?.video?.url ?? output?.video_url
    if (!videoUrl) throw new Error('No video URL in response')

    // Store result
    const { data: asset, error: dbError } = await supabaseAdmin
      .from('brand_assets')
      .insert({
        brand_kit_id,
        user_id: req.userId,
        type: 'social_post',
        platform: motion_type,
        prompt: motionPrompt,
        image_url: videoUrl,
      })
      .select()
      .single()

    if (dbError) throw new Error(dbError.message)

    // Deduct 2 credits
    if (profile.plan !== 'studio') {
      await supabaseAdmin
        .from('profiles')
        .update({ credits: profile.credits - 2 })
        .eq('id', req.userId)
    }

    logger.info({ userId: req.userId, motion_type, brand_kit_id }, 'Animation generated')
    res.status(201).json({ data: { id: asset.id, video_url: videoUrl, motion_type } })
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'brand/animate error')
    res.status(500).json({ error: 'Animation generation failed', code: 'GENERATION_ERROR' })
  }
})
