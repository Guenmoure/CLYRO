import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { supabaseAdmin } from '../lib/supabase'
import { logger } from '../lib/logger'
import { createFalClient } from '@fal-ai/client'

export const brandPhotoshootRouter = Router()

const fal = createFalClient({ credentials: process.env.FAL_KEY })

const TIMEOUT_MS = 180_000

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
