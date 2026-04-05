import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { supabaseAdmin } from '../lib/supabase'
import { logger } from '../lib/logger'
import { generateLogo, generateSocialAsset } from '../services/fal'

export const brandGenerateRouter = Router()

const ASSET_TYPES = ['logo', 'social_post'] as const
const PLATFORMS   = ['instagram_post', 'instagram_story', 'linkedin', 'twitter', 'youtube_thumb', 'tiktok'] as const

const generateSchema = z.object({
  brand_kit_id: z.string().uuid(),
  type:         z.enum(ASSET_TYPES),
  prompt:       z.string().min(5).max(500),
  platform:     z.enum(PLATFORMS).optional(), // requis si type === 'social_post'
})

/**
 * POST /api/v1/brand/generate
 * Génère un asset visuel (logo ou post réseaux) lié à un Brand Kit
 * Utilise les couleurs du kit pour conditionner fal.ai
 */
brandGenerateRouter.post('/brand/generate', authMiddleware, async (req, res) => {
  const parsed = generateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  const { brand_kit_id, type, prompt, platform } = parsed.data

  if (type === 'social_post' && !platform) {
    res.status(400).json({ error: 'platform is required for social_post type', code: 'VALIDATION_ERROR' })
    return
  }

  try {
    // Vérifier crédits
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

    // Vérifier que le brand kit appartient à l'utilisateur + récupérer les couleurs
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

    const brandColors = {
      primary_color:   brandKit.primary_color,
      secondary_color: brandKit.secondary_color,
    }

    // Génération IA
    let imageUrl: string

    if (type === 'logo') {
      const result = await generateLogo(prompt, brandColors)
      imageUrl = result.imageUrl
    } else {
      const result = await generateSocialAsset(prompt, platform!, brandColors)
      imageUrl = result.imageUrl
    }

    // Stocker le résultat
    const { data: asset, error: dbError } = await supabaseAdmin
      .from('brand_assets')
      .insert({
        brand_kit_id,
        user_id:   req.userId,
        type,
        platform:  platform ?? null,
        prompt,
        image_url: imageUrl,
      })
      .select()
      .single()

    if (dbError) throw new Error(dbError.message)

    // Décrémenter les crédits (sauf studio)
    if (profile.plan !== 'studio') {
      await supabaseAdmin
        .from('profiles')
        .update({ credits: profile.credits - 1 })
        .eq('id', req.userId)
    }

    logger.info({ userId: req.userId, brand_kit_id, type }, 'Brand asset generated')
    res.status(201).json({ data: asset })
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'brand/generate error')
    res.status(500).json({ error: 'Generation failed', code: 'GENERATION_ERROR' })
  }
})

/**
 * GET /api/v1/brand/:brand_kit_id/assets
 * Récupère les assets générés pour un brand kit
 */
brandGenerateRouter.get('/brand/:brand_kit_id/assets', authMiddleware, async (req, res) => {
  const { brand_kit_id } = req.params
  const { type } = req.query

  try {
    let query = supabaseAdmin
      .from('brand_assets')
      .select('*')
      .eq('brand_kit_id', brand_kit_id)
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false })

    if (type && typeof type === 'string') {
      query = query.eq('type', type)
    }

    const { data, error } = await query
    if (error) throw error

    res.json({ data: data ?? [] })
  } catch (err) {
    logger.error({ err, brand_kit_id }, 'brand/assets GET error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * DELETE /api/v1/brand/assets/:asset_id
 */
brandGenerateRouter.delete('/brand/assets/:asset_id', authMiddleware, async (req, res) => {
  const { asset_id } = req.params

  try {
    const { error } = await supabaseAdmin
      .from('brand_assets')
      .delete()
      .eq('id', asset_id)
      .eq('user_id', req.userId)

    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    logger.error({ err, asset_id }, 'brand/assets DELETE error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})
