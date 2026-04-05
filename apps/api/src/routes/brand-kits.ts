import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { supabaseAdmin } from '../lib/supabase'
import { logger } from '../lib/logger'

export const brandKitsRouter = Router()

const colorRegex = /^#[0-9A-Fa-f]{6}$/

const createSchema = z.object({
  name:            z.string().min(1).max(80),
  primary_color:   z.string().regex(colorRegex, 'Couleur hex invalide (#RRGGBB)'),
  secondary_color: z.string().regex(colorRegex).optional(),
  font_family:     z.string().max(100).optional(),
  logo_url:        z.string().url().optional(),
  is_default:      z.boolean().optional(),
})

const updateSchema = createSchema.partial()

/**
 * GET /api/v1/brand-kits
 * Retourne tous les brand kits de l'utilisateur
 */
brandKitsRouter.get('/brand-kits', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('brand_kits')
      .select('*')
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
 * POST /api/v1/brand-kits
 * Crée un nouveau brand kit
 */
brandKitsRouter.post('/brand-kits', authMiddleware, async (req, res) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  const { name, primary_color, secondary_color, font_family, logo_url, is_default } = parsed.data

  try {
    // Si ce kit doit être default → retirer le flag sur les autres
    if (is_default) {
      await supabaseAdmin
        .from('brand_kits')
        .update({ is_default: false })
        .eq('user_id', req.userId)
    }

    const { data, error } = await supabaseAdmin
      .from('brand_kits')
      .insert({
        user_id: req.userId,
        name,
        primary_color,
        secondary_color: secondary_color ?? null,
        font_family:     font_family ?? null,
        logo_url:        logo_url ?? null,
        is_default:      is_default ?? false,
      })
      .select()
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
 * Met à jour un brand kit existant
 */
brandKitsRouter.put('/brand-kits/:id', authMiddleware, async (req, res) => {
  const { id } = req.params
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  try {
    // Vérifier que le kit appartient à l'utilisateur
    const { data: existing } = await supabaseAdmin
      .from('brand_kits')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.userId)
      .single()

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
      .select()
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
