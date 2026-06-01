import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { supabaseAdmin } from '../lib/supabase'
import { logger } from '../lib/logger'
import { generateSocialAsset } from '../services/fal'
import { deductCredits, refundCredits, InsufficientCreditsError } from '../services/credits'
import { runBrandCampaignPipeline, addCreativeToCampaign } from '../pipelines/brand-campaign'
import { generateCampaignSuggestions, generateCtaVariants, type BrandConfigForPrompt } from '../services/claude'
import { creditCostForVideo } from '../services/credits'
import { renderQueue, isRedisReady } from '../queues/renderQueue'
import { runMotionAuto } from '../pipelines/motion-router'
import Anthropic from '@anthropic-ai/sdk'

export const brandCampaignsRouter = Router()

// ── Persistent Campaigns model (Phase 3.1 du portage Pomelli) ───────────────
// Les endpoints ci-dessous (POST /brand/campaigns, GET, DELETE, etc.) sont
// le nouveau modèle persistant : campagnes durables avec créatives, version
// history et statut. Le bloc « legacy » plus bas (ideate / generate) reste
// pour rétro-compat avec les anciens callers, mais le front Phase 3.2 cible
// uniquement le persistant.

const CREATIVE_COUNT       = 3
const CREDIT_PER_CREATIVE  = 1
const CAMPAIGN_CREDIT_COST = CREATIVE_COUNT * CREDIT_PER_CREATIVE

const createCampaignSchema = z.object({
  brand_kit_id: z.string().uuid(),
  prompt:       z.string().min(10).max(3000),
  title:        z.string().min(1).max(160).optional(),
  product_id:   z.string().uuid().optional(),
  asset_ids:    z.array(z.string().uuid()).max(20).optional(),
  aspect_ratio: z.enum(['9:16', '1:1', '4:5']).optional(),
})

// Position d'un bloc : x,y exprimés en % du preview, clampés sur [0..100]
// pour empêcher un client malveillant de stocker des coordonnées hors-cadre.
const blockPositionSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
})

const blockPositionsSchema = z.object({
  header:      blockPositionSchema,
  description: blockPositionSchema,
  cta:         blockPositionSchema,
}).nullable()

// Multiplicateur de taille : plage raisonnable 0.5-2.5 (au-delà ça déborde
// trop souvent du cadre, et trop petit ça devient illisible)
const blockSizesSchema = z.object({
  header:      z.number().min(0.5).max(2.5),
  description: z.number().min(0.5).max(2.5),
  cta:         z.number().min(0.5).max(2.5),
}).nullable()

const updateCreativeSchema = z.object({
  header_text:      z.string().max(200).nullable().optional(),
  description_text: z.string().max(500).nullable().optional(),
  cta_text:         z.string().max(60).nullable().optional(),
  blocks_visible:   z.object({
    header:      z.boolean().optional(),
    description: z.boolean().optional(),
    cta:         z.boolean().optional(),
  }).optional(),
  block_positions:  blockPositionsSchema.optional(),
  block_sizes:      blockSizesSchema.optional(),
  /** Asset swap depuis la médiathèque — accepte une URL signée Storage du
   *  bucket brand-assets de l'utilisateur. La vérif d'appartenance se fait
   *  côté front en piochant uniquement dans `listBrandMedia(brand_kit_id)`. */
  image_url:        z.string().url().max(2000).optional(),
  position:         z.number().int().min(0).max(99).optional(),
})

/**
 * POST /api/v1/brand/campaigns/suggest
 * 3 idées de campagne dérivées du DNA — pas de persistence, pas d'image, pas
 * de crédit. Utile pour amorcer la prompt box côté front. Soumis au quota
 * Claude implicite (1 appel Sonnet, max_tokens 800).
 */
const suggestSchema = z.object({
  brand_kit_id: z.string().uuid(),
  count:        z.number().int().min(1).max(6).optional(),
})

brandCampaignsRouter.post('/brand/campaigns/suggest', authMiddleware, async (req, res) => {
  const parsed = suggestSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }
  const { brand_kit_id, count } = parsed.data
  try {
    const { data: kit } = await supabaseAdmin
      .from('brand_kits')
      .select('name, primary_color, secondary_color, font_family, tagline, brand_values, brand_aesthetic, brand_tone_of_voice, business_overview')
      .eq('id', brand_kit_id)
      .eq('user_id', req.userId)
      .maybeSingle()
    if (!kit) {
      res.status(404).json({ error: 'Brand kit not found', code: 'NOT_FOUND' })
      return
    }
    const brandForPrompt: BrandConfigForPrompt & { name?: string } = {
      name:                kit.name,
      primary_color:       kit.primary_color,
      secondary_color:     kit.secondary_color ?? undefined,
      font_family:         kit.font_family ?? undefined,
      tagline:             kit.tagline ?? undefined,
      brand_values:        kit.brand_values ?? [],
      brand_aesthetic:     kit.brand_aesthetic ?? [],
      brand_tone_of_voice: kit.brand_tone_of_voice ?? [],
      business_overview:   kit.business_overview ?? undefined,
    }
    const suggestions = await generateCampaignSuggestions(brandForPrompt, count ?? 3)
    res.json({ data: suggestions })
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'brand/campaigns/suggest error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * POST /api/v1/brand/campaigns
 * Crée une campagne en `status=generating`, déduit les crédits, lance le
 * pipeline en fire-and-forget (le front poll GET /brand/campaigns/:id).
 */
brandCampaignsRouter.post('/brand/campaigns', authMiddleware, async (req, res) => {
  const parsed = createCampaignSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  const { brand_kit_id, prompt, title, product_id, asset_ids, aspect_ratio } = parsed.data

  try {
    // Ownership du kit
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

    // Validation faible des FK optionnelles : la migration les laisse SET NULL
    // si l'item est supprimé après coup, donc on n'a pas besoin de bloquer
    // l'utilisateur si l'id n'est pas trouvé — on log juste.
    if (product_id) {
      const { data: prod } = await supabaseAdmin
        .from('brand_catalog_items')
        .select('id')
        .eq('id', product_id)
        .eq('user_id', req.userId)
        .maybeSingle()
      if (!prod) {
        res.status(404).json({ error: 'Product not found', code: 'PRODUCT_NOT_FOUND' })
        return
      }
    }

    // Création de la ligne en `generating` AVANT déduction — si la déduction
    // échoue, on supprime la ligne dans le catch.
    const { data: campaign, error: insertErr } = await supabaseAdmin
      .from('brand_campaigns')
      .insert({
        brand_kit_id,
        user_id:      req.userId,
        title:        (title ?? 'New campaign').trim().slice(0, 160),
        prompt,
        product_id:   product_id ?? null,
        asset_ids:    asset_ids ?? [],
        aspect_ratio: aspect_ratio ?? '9:16',
        status:       'generating',
      })
      .select()
      .single()

    if (insertErr || !campaign) {
      logger.error({ err: insertErr }, 'brand/campaigns insert failed')
      res.status(500).json({ error: 'Failed to create campaign', code: 'DB_ERROR' })
      return
    }

    // Déduction des crédits — InsufficientCreditsError remonte avec required/available
    try {
      await deductCredits(req.userId, CAMPAIGN_CREDIT_COST, `brand_campaign:${campaign.id}`, {
        kind:           'brand_campaign',
        brand_kit_id,
        creative_count: CREATIVE_COUNT,
      })
    } catch (err) {
      // Rollback : on supprime la campagne pour ne pas laisser de ligne fantôme
      await supabaseAdmin.from('brand_campaigns').delete().eq('id', campaign.id)
      if (err instanceof InsufficientCreditsError) {
        res.status(402).json({
          error: 'Insufficient credits', code: 'INSUFFICIENT_CREDITS',
          required: err.required, available: err.available,
        })
        return
      }
      throw err
    }

    // Lancement pipeline fire-and-forget — le worker HTTP rend la main au
    // client immédiatement. Le pipeline mettra à jour status quand fini.
    runBrandCampaignPipeline({
      campaignId:  campaign.id,
      userId:      req.userId,
      brandKitId:  brand_kit_id,
      prompt,
      productId:   product_id,
      assetIds:    asset_ids,
      aspectRatio: campaign.aspect_ratio,
      userTitle:   title,
    }).catch(async (err) => {
      logger.error({ err, campaignId: campaign.id }, 'Campaign pipeline crashed')
      await refundCredits(req.userId, CAMPAIGN_CREDIT_COST, `brand_campaign:${campaign.id}`, { reason: 'pipeline_crash' })
        .catch(() => null)
    })

    logger.info({ userId: req.userId, campaignId: campaign.id }, 'Brand campaign launched')
    res.status(202).json({ data: { campaign } })
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'brand/campaigns POST error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * GET /api/v1/brand/campaigns?brand_kit_id=:id
 * Liste des campagnes pour un Brand Kit (drafts exclus si query.exclude_draft=1).
 */
brandCampaignsRouter.get('/brand/campaigns', authMiddleware, async (req, res) => {
  const brand_kit_id = typeof req.query.brand_kit_id === 'string' ? req.query.brand_kit_id : ''
  if (!brand_kit_id) {
    res.status(400).json({ error: 'brand_kit_id query param required', code: 'VALIDATION_ERROR' })
    return
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('brand_campaigns')
      .select('*')
      .eq('brand_kit_id', brand_kit_id)
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false })
      .limit(80)
    if (error) throw error
    res.json({ data: data ?? [] })
  } catch (err) {
    logger.error({ err, brand_kit_id }, 'brand/campaigns GET error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * GET /api/v1/brand/campaigns/:id
 * Détail campagne + ses créatives (ordre `position`).
 */
brandCampaignsRouter.get('/brand/campaigns/:id', authMiddleware, async (req, res) => {
  const { id } = req.params
  try {
    const { data: campaign, error: cErr } = await supabaseAdmin
      .from('brand_campaigns')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.userId)
      .maybeSingle()
    if (cErr) throw cErr
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found', code: 'NOT_FOUND' })
      return
    }
    const { data: creatives } = await supabaseAdmin
      .from('brand_creatives')
      .select('*')
      .eq('campaign_id', id)
      .eq('user_id', req.userId)
      .order('position', { ascending: true })
    res.json({ data: { campaign, creatives: creatives ?? [] } })
  } catch (err) {
    logger.error({ err, id }, 'brand/campaigns/:id GET error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * DELETE /api/v1/brand/campaigns/:id
 * Hard delete — CASCADE supprime créatives et versions.
 */
brandCampaignsRouter.delete('/brand/campaigns/:id', authMiddleware, async (req, res) => {
  const { id } = req.params
  try {
    const { error } = await supabaseAdmin
      .from('brand_campaigns')
      .delete()
      .eq('id', id)
      .eq('user_id', req.userId)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    logger.error({ err, id }, 'brand/campaigns DELETE error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * PUT /api/v1/brand/creatives/:id
 * Met à jour les textes / blocs visibles / position d'une créative. Utilisé
 * par le Creative Editor (Phase 3.4). N'incrémente PAS la version — on
 * batche les saves côté front (un snapshot par save explicite, pas par tick
 * de debounce).
 */
brandCampaignsRouter.put('/brand/creatives/:id', authMiddleware, async (req, res) => {
  const { id } = req.params
  const parsed = updateCreativeSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }
  try {
    // Vérifier ownership ET récupérer les blocks_visible courants pour merger
    const { data: existing } = await supabaseAdmin
      .from('brand_creatives')
      .select('blocks_visible')
      .eq('id', id)
      .eq('user_id', req.userId)
      .maybeSingle()
    if (!existing) {
      res.status(404).json({ error: 'Creative not found', code: 'NOT_FOUND' })
      return
    }

    const updates: Record<string, unknown> = {}
    if ('header_text'      in parsed.data) updates.header_text      = parsed.data.header_text
    if ('description_text' in parsed.data) updates.description_text = parsed.data.description_text
    if ('cta_text'         in parsed.data) updates.cta_text         = parsed.data.cta_text
    if ('position'         in parsed.data) updates.position         = parsed.data.position
    if ('block_positions'  in parsed.data) updates.block_positions  = parsed.data.block_positions
    if ('block_sizes'      in parsed.data) updates.block_sizes      = parsed.data.block_sizes
    if ('image_url'        in parsed.data) updates.image_url        = parsed.data.image_url
    if (parsed.data.blocks_visible) {
      updates.blocks_visible = { ...(existing.blocks_visible as object), ...parsed.data.blocks_visible }
    }

    const { data, error } = await supabaseAdmin
      .from('brand_creatives')
      .update(updates)
      .eq('id', id)
      .eq('user_id', req.userId)
      .select()
      .single()
    if (error) throw error
    res.json({ data })
  } catch (err) {
    logger.error({ err, id }, 'brand/creatives PUT error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * POST /api/v1/brand/campaigns/:id/creatives
 * Ajoute UNE créative supplémentaire à une campagne existante (bouton
 * « + Add Creative » côté front). Exécute le mini-pipeline INLINE — la
 * requête bloque ~15-20 s (Claude + fal.ai). Le front affiche un loader
 * sur le bouton.
 */
brandCampaignsRouter.post('/brand/campaigns/:id/creatives', authMiddleware, async (req, res) => {
  // Normalise vers string — la signature stricte de addCreativeToCampaign
  // refuse l'union string | string[] qu'Express renvoie pour req.params.
  const id = String(req.params.id ?? '')
  try {
    // Ownership check + récupère brand_kit_id pour le contexte
    const { data: campaign } = await supabaseAdmin
      .from('brand_campaigns')
      .select('id, status')
      .eq('id', id)
      .eq('user_id', req.userId)
      .maybeSingle()
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found', code: 'NOT_FOUND' })
      return
    }
    if (campaign.status === 'generating') {
      res.status(409).json({ error: 'Campaign still generating, please wait', code: 'CAMPAIGN_BUSY' })
      return
    }

    // Déduit 1 crédit AVANT l'appel upstream (cf. .claude/rules/security.md
    // § cost-amplification). Refund en cas d'erreur.
    try {
      await deductCredits(req.userId, CREDIT_PER_CREATIVE, `brand_campaign:${id}:add_creative`, {
        kind: 'brand_campaign_add_creative',
      })
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        res.status(402).json({
          error: 'Insufficient credits', code: 'INSUFFICIENT_CREDITS',
          required: err.required, available: err.available,
        })
        return
      }
      throw err
    }

    try {
      const result = await addCreativeToCampaign({ campaignId: id, userId: req.userId })
      // Renvoie la nouvelle créative complète pour que le front l'insère
      // directement dans son state sans refetch.
      const { data: creative } = await supabaseAdmin
        .from('brand_creatives')
        .select('*')
        .eq('id', result.creativeId)
        .single()
      res.status(201).json({ data: { creative } })
    } catch (err) {
      // Refund sur échec de génération (Claude ou fal.ai)
      await refundCredits(req.userId, CREDIT_PER_CREATIVE, `brand_campaign:${id}:add_creative`, { reason: 'generation_failed' })
        .catch(() => null)
      throw err
    }
  } catch (err) {
    logger.error({ err, campaignId: id }, 'brand/campaigns add creative error')
    res.status(500).json({ error: 'Failed to add creative', code: 'GENERATION_ERROR' })
  }
})

/**
 * POST /api/v1/brand/creatives/:id/animate
 * Pont Brand Kit → Motion : la créative devient le brief d'une vidéo
 * motion design. V1 simple — pas d'injection de l'image en scène cover,
 * juste un brief composé depuis header/description/cta qui part dans le
 * pipeline motion_auto existant. Retourne `video_id` ; le front
 * redirige vers le player Motion.
 */
brandCampaignsRouter.post('/brand/creatives/:id/animate', authMiddleware, async (req, res) => {
  const { id } = req.params
  try {
    // Charge la créative + la campagne parente
    const { data: creative } = await supabaseAdmin
      .from('brand_creatives')
      .select('id, campaign_id, header_text, description_text, cta_text, image_url')
      .eq('id', id)
      .eq('user_id', req.userId)
      .maybeSingle()
    if (!creative) {
      res.status(404).json({ error: 'Creative not found', code: 'NOT_FOUND' })
      return
    }
    const { data: campaign } = await supabaseAdmin
      .from('brand_campaigns')
      .select('id, brand_kit_id, title, description, aspect_ratio')
      .eq('id', creative.campaign_id)
      .eq('user_id', req.userId)
      .single()
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found', code: 'NOT_FOUND' })
      return
    }
    const { data: kit } = await supabaseAdmin
      .from('brand_kits')
      .select('primary_color, secondary_color, font_family, logo_url')
      .eq('id', campaign.brand_kit_id)
      .eq('user_id', req.userId)
      .single()
    if (!kit) {
      res.status(404).json({ error: 'Brand kit not found', code: 'NOT_FOUND' })
      return
    }

    // Aspect ratio mapping vers Motion (4:5 retombe sur 9:16 — Motion ne
    // supporte pas 4:5)
    const motionFormat: '9:16' | '1:1' | '16:9' =
      campaign.aspect_ratio === '1:1' ? '1:1' :
      campaign.aspect_ratio === '4:5' ? '9:16' : '9:16'

    // Brief composé
    const lines: string[] = []
    lines.push(`Promote: ${campaign.title}`)
    if (campaign.description) lines.push(campaign.description)
    if (creative.header_text)      lines.push(`Hero message: "${creative.header_text}"`)
    if (creative.description_text) lines.push(creative.description_text)
    if (creative.cta_text)         lines.push(`Call to action: ${creative.cta_text}`)
    const brief = lines.join('\n').slice(0, 1900)
    const title = (campaign.title || 'Brand animation').slice(0, 200)
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
          source_creative_id: creative.id,
          source_campaign_id: campaign.id,
        },
      })
      .select('id')
      .single()
    if (insertErr || !video) {
      logger.error({ err: insertErr }, 'animate video insert failed')
      res.status(500).json({ error: 'Failed to create video', code: 'DB_ERROR' })
      return
    }

    // Job data motion_auto — mêmes champs que la route /motion classique
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
      brandKitId:    campaign.brand_kit_id,
    }

    let enqueued = false
    if (renderQueue && isRedisReady()) {
      try {
        await renderQueue.add('motion_auto', jobData)
        enqueued = true
      } catch (err) {
        logger.warn({ err, videoId: video.id }, 'Animate enqueue failed')
      }
    }
    if (!enqueued) {
      // Fallback inline (cf. /motion route — accepté si ALLOW_INLINE_FALLBACK=true)
      if (process.env.ALLOW_INLINE_FALLBACK !== 'true') {
        await supabaseAdmin
          .from('videos')
          .update({ status: 'error', metadata: { error_message: 'Worker unavailable', error_at: new Date().toISOString() } })
          .eq('id', video.id)
        res.status(503).json({ error: 'Worker unavailable', code: 'WORKER_UNAVAILABLE', video_id: video.id })
        return
      }
      runMotionAuto(jobData).catch(async (err: unknown) => {
        logger.error({ err, videoId: video.id }, 'Animate inline pipeline failed')
        await supabaseAdmin
          .from('videos')
          .update({ status: 'error', metadata: { error_message: err instanceof Error ? err.message : String(err), error_at: new Date().toISOString() } })
          .eq('id', video.id)
          .then(() => null, () => null)
      })
    }

    // Déduction crédits
    try {
      await deductCredits(req.userId, creditCost, `video:${video.id}`, {
        kind: 'motion',
        source: 'brand_animate',
        creative_id: creative.id,
      })
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        // Mark video as error (le worker tournera quand même si on était
        // déjà enqueued — c'est le risque connu, identique au /motion route).
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

    logger.info({ userId: req.userId, videoId: video.id, creativeId: creative.id }, 'Brand creative animated → motion video launched')
    res.status(202).json({ data: { video_id: video.id, status: 'generating', credits_deducted: creditCost } })
  } catch (err) {
    logger.error({ err, creativeId: id }, 'brand/creatives/:id/animate error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * GET /api/v1/brand/creatives/:id
 * Détail d'une créative + la campagne parente — utilisé par l'éditeur
 * (Phase 3.4) qui charge directement la créative depuis son URL sans
 * passer par le détail campagne.
 */
brandCampaignsRouter.get('/brand/creatives/:id', authMiddleware, async (req, res) => {
  const id = String(req.params.id ?? '')
  try {
    const { data: creative } = await supabaseAdmin
      .from('brand_creatives')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.userId)
      .maybeSingle()
    if (!creative) {
      res.status(404).json({ error: 'Creative not found', code: 'NOT_FOUND' })
      return
    }
    const { data: campaign } = await supabaseAdmin
      .from('brand_campaigns')
      .select('*')
      .eq('id', creative.campaign_id)
      .eq('user_id', req.userId)
      .single()
    res.json({ data: { creative, campaign } })
  } catch (err) {
    logger.error({ err, id }, 'brand/creatives GET error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * GET /api/v1/brand/creatives/:id/versions
 * Historique append-only des éditions, le plus récent en premier.
 */
brandCampaignsRouter.get('/brand/creatives/:id/versions', authMiddleware, async (req, res) => {
  const id = String(req.params.id ?? '')
  try {
    // Ownership via la créative
    const { data: creative } = await supabaseAdmin
      .from('brand_creatives')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.userId)
      .maybeSingle()
    if (!creative) {
      res.status(404).json({ error: 'Creative not found', code: 'NOT_FOUND' })
      return
    }
    const { data, error } = await supabaseAdmin
      .from('brand_creative_versions')
      .select('*')
      .eq('creative_id', id)
      .eq('user_id', req.userId)
      .order('version_num', { ascending: false })
      .limit(50)
    if (error) throw error
    res.json({ data: data ?? [] })
  } catch (err) {
    logger.error({ err, id }, 'brand/creatives/:id/versions GET error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * POST /api/v1/brand/creatives/:id/versions
 * Crée un snapshot de l'état courant de la créative. Append-only — ne
 * touche pas l'état de la créative, juste enregistre la photo. Bumpé
 * `current_version` pour pointer vers le nouveau snapshot.
 */
brandCampaignsRouter.post('/brand/creatives/:id/versions', authMiddleware, async (req, res) => {
  const id = String(req.params.id ?? '')
  try {
    const { data: creative } = await supabaseAdmin
      .from('brand_creatives')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.userId)
      .maybeSingle()
    if (!creative) {
      res.status(404).json({ error: 'Creative not found', code: 'NOT_FOUND' })
      return
    }
    // Numéro de version = max(version_num) + 1
    const { data: last } = await supabaseAdmin
      .from('brand_creative_versions')
      .select('version_num')
      .eq('creative_id', id)
      .order('version_num', { ascending: false })
      .limit(1)
      .maybeSingle()
    const nextVersion = (last?.version_num ?? 0) + 1

    const snapshot = {
      image_url:        creative.image_url,
      prompt:           creative.prompt,
      header_text:      creative.header_text,
      description_text: creative.description_text,
      cta_text:         creative.cta_text,
      blocks_visible:   creative.blocks_visible,
    }

    const { data: inserted, error } = await supabaseAdmin
      .from('brand_creative_versions')
      .insert({
        creative_id: id,
        user_id:     req.userId,
        version_num: nextVersion,
        snapshot,
      })
      .select()
      .single()
    if (error) throw error

    // Bumpe current_version sur la créative
    await supabaseAdmin
      .from('brand_creatives')
      .update({ current_version: nextVersion })
      .eq('id', id)

    res.status(201).json({ data: inserted })
  } catch (err) {
    logger.error({ err, id }, 'brand/creatives/:id/versions POST error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * POST /api/v1/brand/creatives/:id/restore
 * Restaure une créative à l'état d'une version donnée. Le snapshot
 * d'origine reste intact (append-only) — on ne fait que recopier ses
 * champs dans la créative.
 */
const restoreSchema = z.object({
  version_num: z.number().int().min(1),
})

brandCampaignsRouter.post('/brand/creatives/:id/restore', authMiddleware, async (req, res) => {
  const id = String(req.params.id ?? '')
  const parsed = restoreSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }
  try {
    const { data: version } = await supabaseAdmin
      .from('brand_creative_versions')
      .select('*')
      .eq('creative_id', id)
      .eq('user_id', req.userId)
      .eq('version_num', parsed.data.version_num)
      .maybeSingle()
    if (!version) {
      res.status(404).json({ error: 'Version not found', code: 'NOT_FOUND' })
      return
    }
    const snap = version.snapshot as Record<string, unknown>
    const { data: updated, error } = await supabaseAdmin
      .from('brand_creatives')
      .update({
        image_url:        snap.image_url        ?? '',
        prompt:           snap.prompt           ?? null,
        header_text:      snap.header_text      ?? null,
        description_text: snap.description_text ?? null,
        cta_text:         snap.cta_text         ?? null,
        blocks_visible:   snap.blocks_visible   ?? { header: true, description: true, cta: true },
        current_version:  parsed.data.version_num,
      })
      .eq('id', id)
      .eq('user_id', req.userId)
      .select()
      .single()
    if (error) throw error
    res.json({ data: updated })
  } catch (err) {
    logger.error({ err, id }, 'brand/creatives/:id/restore error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * POST /api/v1/brand/creatives/:id/cta-variants
 * Phase 3.4 V2 — Claude propose N variantes de CTA on-brand. Pas de
 * persistence, pas de crédit déduit (appel court).
 */
brandCampaignsRouter.post('/brand/creatives/:id/cta-variants', authMiddleware, async (req, res) => {
  const id = String(req.params.id ?? '')
  try {
    const { data: creative } = await supabaseAdmin
      .from('brand_creatives')
      .select('header_text, description_text, cta_text, campaign_id')
      .eq('id', id)
      .eq('user_id', req.userId)
      .maybeSingle()
    if (!creative) {
      res.status(404).json({ error: 'Creative not found', code: 'NOT_FOUND' })
      return
    }
    const { data: campaign } = await supabaseAdmin
      .from('brand_campaigns')
      .select('brand_kit_id')
      .eq('id', creative.campaign_id)
      .eq('user_id', req.userId)
      .single()
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found', code: 'NOT_FOUND' })
      return
    }
    const { data: kit } = await supabaseAdmin
      .from('brand_kits')
      .select('name, primary_color, secondary_color, font_family, tagline, brand_values, brand_aesthetic, brand_tone_of_voice, business_overview')
      .eq('id', campaign.brand_kit_id)
      .eq('user_id', req.userId)
      .single()
    if (!kit) {
      res.status(404).json({ error: 'Brand kit not found', code: 'NOT_FOUND' })
      return
    }
    const brand: BrandConfigForPrompt & { name?: string } = {
      name:                kit.name,
      primary_color:       kit.primary_color,
      secondary_color:     kit.secondary_color ?? undefined,
      font_family:         kit.font_family ?? undefined,
      tagline:             kit.tagline ?? undefined,
      brand_values:        kit.brand_values ?? [],
      brand_aesthetic:     kit.brand_aesthetic ?? [],
      brand_tone_of_voice: kit.brand_tone_of_voice ?? [],
      business_overview:   kit.business_overview ?? undefined,
    }
    const variants = await generateCtaVariants({
      header:      creative.header_text ?? undefined,
      description: creative.description_text ?? undefined,
      current:     creative.cta_text ?? undefined,
      brand,
      count:       3,
    })
    res.json({ data: variants })
  } catch (err) {
    logger.error({ err, id }, 'brand/creatives/:id/cta-variants error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * DELETE /api/v1/brand/creatives/:id
 */
brandCampaignsRouter.delete('/brand/creatives/:id', authMiddleware, async (req, res) => {
  const { id } = req.params
  try {
    const { error } = await supabaseAdmin
      .from('brand_creatives')
      .delete()
      .eq('id', id)
      .eq('user_id', req.userId)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    logger.error({ err, id }, 'brand/creatives DELETE error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

// ── Legacy stateless endpoints (avant Phase 3.1) ─────────────────────────────
// Workflow « ideate → generate » sans persistence. Conservé pour rétro-compat
// avec d'éventuels callers existants. Le front Phase 3.2 ne les utilise pas.

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PLATFORM_MAP: Record<string, string> = {
  instagram: 'instagram_post',
  tiktok:    'instagram_story',
  linkedin:  'linkedin',
  twitter:   'twitter',
  youtube:   'youtube_thumb',
  facebook:  'instagram_post',
}

const ideateSchema = z.object({
  brand_kit_id:     z.string().uuid(),
  goal:             z.string().min(5).max(300),
  catalog_item_ids: z.array(z.string().uuid()).optional(),
  platforms:        z.array(z.enum(['instagram', 'tiktok', 'linkedin', 'twitter', 'youtube', 'facebook'])).min(1),
})

const generateSchema = z.object({
  brand_kit_id: z.string().uuid(),
  campaign: z.object({
    name:  z.string().min(1).max(120),
    posts: z.array(z.object({
      platform:         z.string(),
      copy:             z.string(),
      visual_direction: z.string(),
      catalog_item_id:  z.string().uuid().optional(),
    })).min(1).max(10),
  }),
})

/**
 * POST /api/v1/brand/campaigns/ideate
 * Generate campaign ideas using Claude
 */
brandCampaignsRouter.post('/brand/campaigns/ideate', authMiddleware, async (req, res) => {
  const parsed = ideateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  const { brand_kit_id, goal, catalog_item_ids, platforms } = parsed.data

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
      .select('name, primary_color, secondary_color, font_family')
      .eq('id', brand_kit_id)
      .eq('user_id', req.userId)
      .single()

    if (!brandKit) {
      res.status(404).json({ error: 'Brand kit not found', code: 'NOT_FOUND' })
      return
    }

    // Fetch catalog items if specified
    let catalogContext = ''
    if (catalog_item_ids && catalog_item_ids.length > 0) {
      const { data: items } = await supabaseAdmin
        .from('brand_catalog_items')
        .select('name, description, category')
        .in('id', catalog_item_ids)
        .eq('user_id', req.userId)

      if (items && items.length > 0) {
        catalogContext = `\n\nPRODUCTS TO FEATURE:\n${items.map((i) => `- ${i.name}${i.description ? `: ${i.description}` : ''}${i.category ? ` [${i.category}]` : ''}`).join('\n')}`
      }
    }

    const prompt = `You are a creative marketing strategist. Generate exactly 3 campaign concepts for this brand.

BRAND: ${brandKit.name}
COLORS: ${brandKit.primary_color}${brandKit.secondary_color ? ` + ${brandKit.secondary_color}` : ''}
FONT: ${brandKit.font_family || 'Default'}
CAMPAIGN GOAL: ${goal}
TARGET PLATFORMS: ${platforms.join(', ')}${catalogContext}

Return ONLY valid JSON (no markdown, no explanation) with this structure:
{
  "campaigns": [
    {
      "name": "Campaign Name",
      "tagline": "Catchy tagline",
      "description": "2-3 sentence campaign description",
      "platforms": ["platform1", "platform2"],
      "suggested_posts": [
        { "platform": "instagram", "copy": "Post caption text", "visual_direction": "Detailed visual description for AI image generation" }
      ]
    }
  ]
}

Each campaign should have 2-4 suggested posts across the specified platforms.
Visual directions should be detailed, specific prompts suitable for AI image generation (describe composition, colors, objects, mood).`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Failed to parse campaign response')

    const result = JSON.parse(jsonMatch[0])

    // Deduct credit
    if (profile.plan !== 'studio') {
      await supabaseAdmin
        .from('profiles')
        .update({ credits: profile.credits - 1 })
        .eq('id', req.userId)
    }

    logger.info({ userId: req.userId, brand_kit_id, goal }, 'Campaign ideas generated')
    res.json(result)
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'brand/campaigns/ideate error')
    res.status(500).json({ error: 'Campaign ideation failed', code: 'GENERATION_ERROR' })
  }
})

/**
 * POST /api/v1/brand/campaigns/generate
 * Generate campaign assets (batch image generation)
 */
brandCampaignsRouter.post('/brand/campaigns/generate', authMiddleware, async (req, res) => {
  const parsed = generateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  const { brand_kit_id, campaign } = parsed.data

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

    const cost = campaign.posts.length
    if (profile.plan !== 'studio' && profile.credits < cost) {
      res.status(403).json({ error: `Need ${cost} credits, have ${profile.credits}`, code: 'INSUFFICIENT_CREDITS' })
      return
    }

    // Fetch brand colors
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

    const brandColors = { primary_color: brandKit.primary_color, secondary_color: brandKit.secondary_color }

    // Generate assets in parallel (max 3 concurrent)
    const assets: Array<{ platform: string; image_url: string; copy: string }> = []

    for (let i = 0; i < campaign.posts.length; i += 3) {
      const batch = campaign.posts.slice(i, i + 3)
      const results = await Promise.allSettled(
        batch.map(async (post) => {
          const platform = PLATFORM_MAP[post.platform] ?? 'instagram_post'
          const result = await generateSocialAsset(
            `${post.visual_direction}, campaign: ${campaign.name}, brand: ${brandKit.name}`,
            platform,
            brandColors
          )
          // Store in brand_assets
          await supabaseAdmin.from('brand_assets').insert({
            brand_kit_id,
            user_id: req.userId,
            type: 'social_post',
            platform: post.platform,
            prompt: post.visual_direction,
            image_url: result.imageUrl,
          })
          return { platform: post.platform, image_url: result.imageUrl, copy: post.copy }
        })
      )

      for (const r of results) {
        if (r.status === 'fulfilled') assets.push(r.value)
      }
    }

    // Deduct credits
    if (profile.plan !== 'studio') {
      await supabaseAdmin
        .from('profiles')
        .update({ credits: profile.credits - assets.length })
        .eq('id', req.userId)
    }

    logger.info({ userId: req.userId, campaign: campaign.name, count: assets.length }, 'Campaign assets generated')
    res.json({ assets })
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'brand/campaigns/generate error')
    res.status(500).json({ error: 'Campaign generation failed', code: 'GENERATION_ERROR' })
  }
})
