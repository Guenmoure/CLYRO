import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { supabaseAdmin } from '../lib/supabase'
import { logger } from '../lib/logger'
import { generateSocialAsset } from '../services/fal'
import Anthropic from '@anthropic-ai/sdk'

export const brandCampaignsRouter = Router()

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
