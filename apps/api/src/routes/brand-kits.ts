import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { supabaseAdmin } from '../lib/supabase'
import { logger } from '../lib/logger'

export const brandKitsRouter = Router()

const colorRegex = /^#[0-9A-Fa-f]{6}$/

// ── Business DNA sub-schemas (Pomelli-inspired) ──────────────────────────────
// Tous les champs sont optionnels côté création/update — un kit peut exister
// avec uniquement name + primary_color (rétro-compatible avec l'ancien shape).
// Les plafonds protègent contre un client malveillant qui balancerait des
// arrays géants ou des chaînes infinies dans la base.

const socialLinksSchema = z
  .object({
    facebook:  z.string().url().max(500).optional(),
    instagram: z.string().url().max(500).optional(),
    linkedin:  z.string().url().max(500).optional(),
    twitter:   z.string().url().max(500).optional(),
    youtube:   z.string().url().max(500).optional(),
    tiktok:    z.string().url().max(500).optional(),
    pinterest: z.string().url().max(500).optional(),
  })
  .strict() // refuse les clés inconnues — évite qu'un client poste { _hack: '...' }

const ctaLinkSchema = z.object({
  label: z.string().min(1).max(60),
  url:   z.string().url().max(500),
})

const TAGS_MAX = 20
const KEYWORDS_MAX = 30
const CTA_LINKS_MAX = 8

const createSchema = z.object({
  // — Core (compatibilité ancien shape) —
  name:                z.string().min(1).max(80),
  primary_color:       z.string().regex(colorRegex, 'Couleur hex invalide (#RRGGBB)'),
  secondary_color:     z.string().regex(colorRegex).optional(),
  font_family:         z.string().max(100).optional(),
  logo_url:            z.string().url().optional(),
  is_default:          z.boolean().optional(),

  // — Business DNA : Brand Overview —
  url:                 z.string().url().max(500).optional(),
  tagline:             z.string().max(200).optional(),
  brand_values:        z.array(z.string().min(1).max(60)).max(TAGS_MAX).optional(),
  brand_aesthetic:     z.array(z.string().min(1).max(60)).max(TAGS_MAX).optional(),
  brand_tone_of_voice: z.array(z.string().min(1).max(60)).max(TAGS_MAX).optional(),
  business_overview:   z.string().max(2000).optional(),

  // — Business DNA : Business Details —
  location:            z.string().max(200).optional(),
  phone:               z.string().max(40).optional(),
  business_hours:      z.string().max(500).optional(),
  keywords:            z.array(z.string().min(1).max(60)).max(KEYWORDS_MAX).optional(),
  social_links:        socialLinksSchema.optional(),
  cta_links:           z.array(ctaLinkSchema).max(CTA_LINKS_MAX).optional(),
  testimonials:        z.string().max(4000).optional(),
})

const updateSchema = createSchema.partial()

// Type des données Zod-validées (créeront le record). Utilisé pour le SELECT
// après INSERT/UPDATE : on retourne tous les champs au front (le shape BrandKit
// complet en @clyro/shared).
const SELECT_COLUMNS = '*'

/**
 * GET /api/v1/brand-kits
 * Retourne tous les brand kits de l'utilisateur, kit par défaut en premier.
 */
brandKitsRouter.get('/brand-kits', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('brand_kits')
      .select(SELECT_COLUMNS)
      .eq('user_id', req.userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json({ data: data ?? [] })
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'brand-kits GET error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * GET /api/v1/brand-kits/:id
 * Retourne un brand kit unique (404 si pas trouvé / pas owned).
 */
brandKitsRouter.get('/brand-kits/:id', authMiddleware, async (req, res) => {
  const { id } = req.params
  try {
    const { data, error } = await supabaseAdmin
      .from('brand_kits')
      .select(SELECT_COLUMNS)
      .eq('id', id)
      .eq('user_id', req.userId)
      .maybeSingle()

    if (error) throw error
    if (!data) {
      res.status(404).json({ error: 'Brand kit not found', code: 'NOT_FOUND' })
      return
    }
    res.json({ data })
  } catch (err) {
    logger.error({ err, userId: req.userId, id }, 'brand-kits GET by id error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * POST /api/v1/brand-kits
 * Crée un nouveau brand kit. Les champs DNA sont optionnels — un kit peut
 * être créé avec juste name + primary_color, puis enrichi par PUT.
 */
brandKitsRouter.post('/brand-kits', authMiddleware, async (req, res) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  try {
    // Si ce kit doit être default → retirer le flag sur les autres
    if (parsed.data.is_default) {
      await supabaseAdmin
        .from('brand_kits')
        .update({ is_default: false })
        .eq('user_id', req.userId)
    }

    // INSERT : on passe le shape Zod-validé directement à Supabase. Les
    // champs absents prennent leur défaut SQL ('{}' pour les arrays,
    // NULL pour les scalaires). Plus de risque d'oubli en allongeant
    // la liste des champs comme avec l'ancien destructuring.
    const insertRow = { ...parsed.data, user_id: req.userId }

    const { data, error } = await supabaseAdmin
      .from('brand_kits')
      .insert(insertRow)
      .select(SELECT_COLUMNS)
      .single()

    if (error) throw error
    logger.info({ userId: req.userId, brandKitId: data.id }, 'Brand kit created')
    res.status(201).json({ data })
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'brand-kits POST error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * PUT /api/v1/brand-kits/:id
 * Met à jour un brand kit existant. Tous les champs sont optionnels —
 * c'est ce qui permet à l'UI de faire des PATCH incrémentaux en debounce
 * sans recharger tout le payload à chaque édition.
 */
brandKitsRouter.put('/brand-kits/:id', authMiddleware, async (req, res) => {
  const { id } = req.params
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  try {
    // Vérifier que le kit appartient à l'utilisateur (200ms vs 404)
    const { data: existing } = await supabaseAdmin
      .from('brand_kits')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.userId)
      .maybeSingle()

    if (!existing) {
      res.status(404).json({ error: 'Brand kit not found', code: 'NOT_FOUND' })
      return
    }

    // Si passage en default → retirer le flag sur les autres
    if (parsed.data.is_default) {
      await supabaseAdmin
        .from('brand_kits')
        .update({ is_default: false })
        .eq('user_id', req.userId)
        .neq('id', id)
    }

    const { data, error } = await supabaseAdmin
      .from('brand_kits')
      .update(parsed.data)
      .eq('id', id)
      .eq('user_id', req.userId)
      .select(SELECT_COLUMNS)
      .single()

    if (error) throw error
    logger.info({ userId: req.userId, brandKitId: id }, 'Brand kit updated')
    res.json({ data })
  } catch (err) {
    logger.error({ err, userId: req.userId, id }, 'brand-kits PUT error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * DELETE /api/v1/brand-kits/:id
 * Hard delete (CASCADE depuis les FK assets/catalog/campagnes).
 */
brandKitsRouter.delete('/brand-kits/:id', authMiddleware, async (req, res) => {
  const { id } = req.params

  try {
    const { error } = await supabaseAdmin
      .from('brand_kits')
      .delete()
      .eq('id', id)
      .eq('user_id', req.userId)

    if (error) throw error
    logger.info({ userId: req.userId, brandKitId: id }, 'Brand kit deleted')
    res.json({ success: true })
  } catch (err) {
    logger.error({ err, userId: req.userId, id }, 'brand-kits DELETE error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})
