import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { supabaseAdmin } from '../lib/supabase'
import { logger } from '../lib/logger'
import { scrapeProductPage, ScrapeError } from '../services/product-scraper'

export const brandCatalogRouter = Router()

const createSchema = z.object({
  brand_kit_id: z.string().uuid(),
  name:         z.string().min(1).max(120),
  description:  z.string().max(500).optional(),
  image_url:    z.string().url(),
  category:     z.string().max(80).optional(),
})

const updateSchema = createSchema.omit({ brand_kit_id: true }).partial()

const fromUrlSchema = z.object({
  brand_kit_id: z.string().uuid(),
  url:          z.string().url().max(2000),
})

/**
 * POST /api/v1/brand/catalog
 * Add a product to the catalog
 */
brandCatalogRouter.post('/brand/catalog', authMiddleware, async (req, res) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  const { brand_kit_id, name, description, image_url, category } = parsed.data

  try {
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

    const { data, error } = await supabaseAdmin
      .from('brand_catalog_items')
      .insert({
        brand_kit_id,
        user_id: req.userId,
        name,
        description: description ?? null,
        image_url,
        category: category ?? null,
      })
      .select()
      .single()

    if (error) throw error
    logger.info({ userId: req.userId, itemId: data.id }, 'Catalog item created')
    res.status(201).json({ data })
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'brand/catalog POST error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * POST /api/v1/brand/catalog/from-url
 * Phase 2 — scrape une URL e-commerce et renvoie un DRAFT de produit à
 * confirmer côté front. N'insère RIEN en base : l'utilisateur révise les
 * champs (le scraping rate ~20 % des cas), puis poste sur l'endpoint
 * POST /brand/catalog standard pour créer la fiche.
 *
 * Ne consomme pas de crédit : c'est un appel local (fetch + parsing
 * HTML). Protégé par authMiddleware + plafonds taille/timeout dans
 * product-scraper.ts (10 s, 2 MB).
 */
brandCatalogRouter.post('/brand/catalog/from-url', authMiddleware, async (req, res) => {
  const parsed = fromUrlSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  const { brand_kit_id, url } = parsed.data

  try {
    // Vérifier que le kit appartient à l'utilisateur avant de scraper —
    // évite que quelqu'un utilise notre serveur comme proxy de scraping
    // sans même posséder de Brand Kit.
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

    const draft = await scrapeProductPage(url)
    logger.info({ userId: req.userId, brand_kit_id, sourceUrl: url }, 'Catalog draft scraped from URL')
    res.json({ data: draft })
  } catch (err) {
    if (err instanceof ScrapeError) {
      logger.warn({ url, code: err.code }, 'Product scrape failed')
      res.status(422).json({ error: err.message, code: err.code })
      return
    }
    logger.error({ err, userId: req.userId }, 'brand/catalog/from-url error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * GET /api/v1/brand/:brand_kit_id/catalog
 * List catalog items for a kit
 */
brandCatalogRouter.get('/brand/:brand_kit_id/catalog', authMiddleware, async (req, res) => {
  const { brand_kit_id } = req.params

  try {
    const { data, error } = await supabaseAdmin
      .from('brand_catalog_items')
      .select('*')
      .eq('brand_kit_id', brand_kit_id)
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json({ data: data ?? [] })
  } catch (err) {
    logger.error({ err, brand_kit_id }, 'brand/catalog GET error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * PUT /api/v1/brand/catalog/:item_id
 * Update a catalog item
 */
brandCatalogRouter.put('/brand/catalog/:item_id', authMiddleware, async (req, res) => {
  const { item_id } = req.params
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('brand_catalog_items')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', item_id)
      .eq('user_id', req.userId)
      .select()
      .single()

    if (error) throw error
    if (!data) {
      res.status(404).json({ error: 'Item not found', code: 'NOT_FOUND' })
      return
    }
    res.json({ data })
  } catch (err) {
    logger.error({ err, item_id }, 'brand/catalog PUT error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * DELETE /api/v1/brand/catalog/:item_id
 */
brandCatalogRouter.delete('/brand/catalog/:item_id', authMiddleware, async (req, res) => {
  const { item_id } = req.params

  try {
    const { error } = await supabaseAdmin
      .from('brand_catalog_items')
      .delete()
      .eq('id', item_id)
      .eq('user_id', req.userId)

    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    logger.error({ err, item_id }, 'brand/catalog DELETE error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})
