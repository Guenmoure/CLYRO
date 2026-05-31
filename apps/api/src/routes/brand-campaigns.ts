import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { supabaseAdmin } from '../lib/supabase'
import { logger } from '../lib/logger'
import { generateSocialAsset } from '../services/fal'
import { deductCredits, refundCredits, InsufficientCreditsError } from '../services/credits'
import { runBrandCampaignPipeline } from '../pipelines/brand-campaign'
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

const updateCreativeSchema = z.object({
  header_text:      z.string().max(200).nullable().optional(),
  description_text: z.string().max(500).nullable().optional(),
  cta_text:         z.string().max(60).nullable().optional(),
  blocks_visible:   z.object({
    header:      z.boolean().optional(),
    description: z.boolean().optional(),
    cta:         z.boolean().optional(),
  }).optional(),
  position:         z.number().int().min(0).max(99).optional(),
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
