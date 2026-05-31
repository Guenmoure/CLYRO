/**
 * Brand Campaign pipeline — Phase 3.1 du portage Pomelli.
 *
 * Une campagne arrive ici déjà créée en base avec `status='generating'`.
 * Le pipeline :
 *   1. Charge le Brand Kit (avec DNA enrichi), le produit éventuel et les
 *      assets éventuels.
 *   2. Appelle Claude pour produire un brief structuré (titre, description,
 *      N créatives = visual_prompt + header + description + cta).
 *   3. Met à jour le titre/description de la campagne avec ce que Claude a
 *      proposé (si l'utilisateur n'avait pas forcé un titre).
 *   4. Génère les images fal.ai en parallèle (Promise.allSettled — un échec
 *      d'image n'empêche pas les autres).
 *   5. Insère les créatives avec leur snapshot version 1 dans
 *      brand_creative_versions (append-only).
 *   6. Passe la campagne en `status='done'` (ou `error` si tout a échoué).
 *
 * Pas d'enqueue BullMQ : exécution inline fire-and-forget depuis la route.
 * Le front poll GET /brand/campaigns/:id pour le suivi.
 */

import * as Sentry from '@sentry/node'
import { supabaseAdmin } from '../lib/supabase'
import { logger } from '../lib/logger'
import {
  generateCampaignBrief,
  type BrandConfigForPrompt,
  type CampaignBriefInput,
} from '../services/claude'
import { generateSocialAsset } from '../services/fal'

export interface BrandCampaignPipelineParams {
  campaignId:   string
  userId:       string
  brandKitId:   string
  prompt:       string
  productId?:   string
  assetIds?:    string[]
  aspectRatio:  '9:16' | '1:1' | '4:5'
  /** Titre forcé par l'utilisateur — si présent, on n'écrase pas avec celui
   *  de Claude. */
  userTitle?:   string
}

const PLATFORM_BY_RATIO: Record<'9:16' | '1:1' | '4:5', string> = {
  '9:16': 'instagram_story',
  '1:1':  'instagram_post',
  '4:5':  'instagram_post',
}

const DEFAULT_CREATIVE_COUNT = 3

export async function runBrandCampaignPipeline(
  params: BrandCampaignPipelineParams,
): Promise<void> {
  const { campaignId, userId, brandKitId, prompt, productId, assetIds, aspectRatio, userTitle } = params

  try {
    // ── 1. Fetch context ────────────────────────────────────────────────────
    const { data: brandKit } = await supabaseAdmin
      .from('brand_kits')
      .select('name, primary_color, secondary_color, font_family, logo_url, tagline, brand_values, brand_aesthetic, brand_tone_of_voice, business_overview')
      .eq('id', brandKitId)
      .eq('user_id', userId)
      .maybeSingle()

    if (!brandKit) {
      throw new Error('Brand kit not found')
    }

    let product: CampaignBriefInput['product'] = null
    if (productId) {
      const { data } = await supabaseAdmin
        .from('brand_catalog_items')
        .select('name, description, category')
        .eq('id', productId)
        .eq('user_id', userId)
        .maybeSingle()
      product = data ?? null
    }

    let assetHints: string[] = []
    if (assetIds && assetIds.length > 0) {
      const { data: assets } = await supabaseAdmin
        .from('brand_media_library')
        .select('filename, tags')
        .in('id', assetIds)
        .eq('user_id', userId)
      assetHints = (assets ?? []).map((a) => {
        const tagPart = a.tags && a.tags.length > 0 ? ` [tags: ${a.tags.join(', ')}]` : ''
        return `${a.filename}${tagPart}`
      })
    }

    // ── 2. Brand context pour Claude ────────────────────────────────────────
    const brandForPrompt: BrandConfigForPrompt & { name?: string } = {
      name:                brandKit.name,
      primary_color:       brandKit.primary_color,
      secondary_color:     brandKit.secondary_color ?? undefined,
      font_family:         brandKit.font_family ?? undefined,
      logo_url:            brandKit.logo_url ?? undefined,
      tagline:             brandKit.tagline ?? undefined,
      brand_values:        brandKit.brand_values ?? [],
      brand_aesthetic:     brandKit.brand_aesthetic ?? [],
      brand_tone_of_voice: brandKit.brand_tone_of_voice ?? [],
      business_overview:   brandKit.business_overview ?? undefined,
    }

    const brief = await generateCampaignBrief({
      prompt,
      brandKit:   brandForPrompt,
      product,
      assetHints,
      count:      DEFAULT_CREATIVE_COUNT,
    })

    // ── 3. Mise à jour titre / description de la campagne ───────────────────
    // userTitle prend le pas s'il a été fourni à la création — on respecte
    // l'intention utilisateur même si Claude a une meilleure idée.
    await supabaseAdmin
      .from('brand_campaigns')
      .update({
        title:       userTitle?.trim() || brief.campaign_title,
        description: brief.campaign_description,
        metadata:    { ai_title: brief.campaign_title },
      })
      .eq('id', campaignId)

    // ── 4. Génération fal.ai en parallèle ───────────────────────────────────
    const platform = PLATFORM_BY_RATIO[aspectRatio]
    const brandColors = {
      primary_color:   brandKit.primary_color,
      secondary_color: brandKit.secondary_color ?? undefined,
    }

    const imageResults = await Promise.allSettled(
      brief.creatives.map((c, idx) =>
        generateSocialAsset(c.visual_prompt, platform, brandColors).then(({ imageUrl }) => ({
          idx,
          creative: c,
          imageUrl,
        })),
      ),
    )

    let successCount = 0
    for (const r of imageResults) {
      if (r.status !== 'fulfilled') {
        logger.warn({ campaignId, reason: r.reason }, 'Campaign creative image failed')
        continue
      }
      const { idx, creative, imageUrl } = r.value

      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from('brand_creatives')
        .insert({
          campaign_id:      campaignId,
          user_id:          userId,
          image_url:        imageUrl,
          prompt:           creative.visual_prompt,
          header_text:      creative.header,
          description_text: creative.description,
          cta_text:         creative.cta,
          current_version:  1,
          position:         idx,
        })
        .select()
        .single()

      if (insertErr || !inserted) {
        logger.warn({ campaignId, err: insertErr }, 'Creative insert failed')
        continue
      }

      // Snapshot V1 (append-only). Erreur non bloquante.
      const { error: versionErr } = await supabaseAdmin
        .from('brand_creative_versions')
        .insert({
          creative_id: inserted.id,
          user_id:     userId,
          version_num: 1,
          snapshot: {
            image_url:        imageUrl,
            prompt:           creative.visual_prompt,
            header_text:      creative.header,
            description_text: creative.description,
            cta_text:         creative.cta,
            blocks_visible:   { header: true, description: true, cta: true },
          },
        })
      if (versionErr) {
        logger.warn({ creativeId: inserted.id, err: versionErr }, 'Version 1 snapshot failed')
      }

      successCount++
    }

    // ── 5. Statut final ─────────────────────────────────────────────────────
    if (successCount === 0) {
      throw new Error('All creative generations failed')
    }

    await supabaseAdmin
      .from('brand_campaigns')
      .update({
        status: 'done',
        metadata: {
          ai_title:           brief.campaign_title,
          requested_count:    DEFAULT_CREATIVE_COUNT,
          succeeded_count:    successCount,
        },
      })
      .eq('id', campaignId)

    logger.info({ campaignId, successCount, totalRequested: brief.creatives.length }, 'Brand campaign pipeline completed')
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    Sentry.captureException(err, { extra: { campaignId, userId, brandKitId } })
    logger.error({ err, campaignId }, 'Brand campaign pipeline error')

    await supabaseAdmin
      .from('brand_campaigns')
      .update({
        status: 'error',
        metadata: { error_message: errorMessage, error_at: new Date().toISOString() },
      })
      .eq('id', campaignId)
      .then(() => null, () => null)
  }
}
