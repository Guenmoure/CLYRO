/**
 * Brand Book routes — Phase 5 du portage Pomelli.
 *
 * Endpoints :
 *   POST /brand/book                — génère une nouvelle version du book
 *                                     depuis le DNA courant du kit
 *   GET  /brand/book?brand_kit_id=  — dernière version pour un kit
 *   GET  /brand/book/:id            — version spécifique (debug / restore UI)
 *   POST /brand/book/:id/publish    — toggle publication, crée le public_token
 *   POST /brand/book/:id/unpublish  — révoque le public_token
 *   DELETE /brand/book/:id
 *   GET  /brand/book/public/:token  — HTML public sans auth (signed by token)
 *
 * Note RLS : la route publique utilise le service_role pour bypasser RLS et
 * matche explicitement is_published=true. Voir migration 20260604.
 */

import { Router } from 'express'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { authMiddleware } from '../middleware/auth'
import { supabaseAdmin } from '../lib/supabase'
import { logger } from '../lib/logger'
import { renderBrandBookHtml } from '../services/brand-book-renderer'
import { renderBrandBookPdf } from '../services/brand-book-pdf-renderer'

export const brandBookRouter = Router()

const generateSchema = z.object({
  brand_kit_id: z.string().uuid(),
})

/**
 * POST /api/v1/brand/book
 * Lit le Brand Kit, rend le HTML via le template par défaut, insère une
 * nouvelle ligne avec version = max(version) + 1. Pas de crédit déduit
 * (rendu local, pas d'appel IA).
 */
brandBookRouter.post('/brand/book', authMiddleware, async (req, res) => {
  const parsed = generateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }
  const { brand_kit_id } = parsed.data
  try {
    const { data: kit } = await supabaseAdmin
      .from('brand_kits')
      .select('name, url, tagline, primary_color, secondary_color, font_family, logo_url, brand_values, brand_aesthetic, brand_tone_of_voice, business_overview')
      .eq('id', brand_kit_id)
      .eq('user_id', req.userId)
      .maybeSingle()
    if (!kit) {
      res.status(404).json({ error: 'Brand kit not found', code: 'NOT_FOUND' })
      return
    }

    // Numéro de version = max(version) + 1 pour ce kit
    const { data: lastBook } = await supabaseAdmin
      .from('brand_books')
      .select('version')
      .eq('brand_kit_id', brand_kit_id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()
    const nextVersion = (lastBook?.version ?? 0) + 1

    const html = await renderBrandBookHtml({
      name:                kit.name,
      url:                 kit.url,
      tagline:             kit.tagline,
      primary_color:       kit.primary_color,
      secondary_color:     kit.secondary_color,
      font_family:         kit.font_family,
      logo_url:            kit.logo_url,
      brand_values:        kit.brand_values,
      brand_aesthetic:     kit.brand_aesthetic,
      brand_tone_of_voice: kit.brand_tone_of_voice,
      business_overview:   kit.business_overview,
      version:             nextVersion,
    })

    const { data: book, error } = await supabaseAdmin
      .from('brand_books')
      .insert({
        brand_kit_id,
        user_id:       req.userId,
        version:       nextVersion,
        html_snapshot: html,
        is_published:  false,
        public_token:  null,
      })
      .select()
      .single()
    if (error) throw error

    logger.info({ userId: req.userId, brand_kit_id, bookId: book.id, version: nextVersion }, 'Brand book generated')
    res.status(201).json({ data: book })
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'brand/book POST error')
    res.status(500).json({ error: 'Brand book generation failed', code: 'GENERATION_ERROR' })
  }
})

/**
 * GET /api/v1/brand/book?brand_kit_id=:id
 * Renvoie la version la plus récente, ou 404 si jamais générée.
 */
brandBookRouter.get('/brand/book', authMiddleware, async (req, res) => {
  const brand_kit_id = typeof req.query.brand_kit_id === 'string' ? req.query.brand_kit_id : ''
  if (!brand_kit_id) {
    res.status(400).json({ error: 'brand_kit_id query param required', code: 'VALIDATION_ERROR' })
    return
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('brand_books')
      .select('*')
      .eq('brand_kit_id', brand_kit_id)
      .eq('user_id', req.userId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    if (!data) {
      res.status(404).json({ error: 'No brand book yet', code: 'NOT_FOUND' })
      return
    }
    res.json({ data })
  } catch (err) {
    logger.error({ err, brand_kit_id }, 'brand/book GET error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * GET /api/v1/brand/book/:id
 * Version spécifique. Utile pour debug ou pour un futur sélecteur de version.
 */
brandBookRouter.get('/brand/book/:id', authMiddleware, async (req, res) => {
  const id = String(req.params.id ?? '')
  try {
    const { data, error } = await supabaseAdmin
      .from('brand_books')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.userId)
      .maybeSingle()
    if (error) throw error
    if (!data) {
      res.status(404).json({ error: 'Brand book not found', code: 'NOT_FOUND' })
      return
    }
    res.json({ data })
  } catch (err) {
    logger.error({ err, id }, 'brand/book/:id GET error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * GET /api/v1/brand/book/:id/pdf
 * Phase 5 V2 — version server-side PDF via pdfkit. Plus déterministe que
 * le print-to-PDF du navigateur (fonts, marges, sauts de page stables).
 * Régénère le PDF à la demande depuis le Brand Kit courant (et pas depuis
 * le html_snapshot) pour éviter de stocker un binaire qui dérive du
 * snapshot HTML stocké.
 *
 * Si l'utilisateur veut figer le PDF, il peut le télécharger et l'archiver.
 */
brandBookRouter.get('/brand/book/:id/pdf', authMiddleware, async (req, res) => {
  const id = String(req.params.id ?? '')
  try {
    // On charge le BOOK pour vérifier ownership + récupérer brand_kit_id +
    // version, mais on RE-LIT le kit pour avoir le DNA frais. Le snapshot
    // HTML reste authoritative pour l'affichage iframe ; le PDF est une
    // vue alternative.
    const { data: book } = await supabaseAdmin
      .from('brand_books')
      .select('id, brand_kit_id, version')
      .eq('id', id)
      .eq('user_id', req.userId)
      .maybeSingle()
    if (!book) {
      res.status(404).json({ error: 'Brand book not found', code: 'NOT_FOUND' })
      return
    }
    const { data: kit } = await supabaseAdmin
      .from('brand_kits')
      .select('name, url, tagline, primary_color, secondary_color, font_family, logo_url, brand_values, brand_aesthetic, brand_tone_of_voice, business_overview')
      .eq('id', book.brand_kit_id)
      .eq('user_id', req.userId)
      .single()
    if (!kit) {
      res.status(404).json({ error: 'Brand kit not found', code: 'NOT_FOUND' })
      return
    }

    const pdf = await renderBrandBookPdf({
      name:                kit.name,
      url:                 kit.url,
      tagline:             kit.tagline,
      primary_color:       kit.primary_color,
      secondary_color:     kit.secondary_color,
      font_family:         kit.font_family,
      logo_url:            kit.logo_url,
      brand_values:        kit.brand_values,
      brand_aesthetic:     kit.brand_aesthetic,
      brand_tone_of_voice: kit.brand_tone_of_voice,
      business_overview:   kit.business_overview,
      version:             book.version,
    })

    const safeName = kit.name.replace(/[^a-z0-9-]+/gi, '_').slice(0, 40) || 'brand-book'
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}-v${book.version}.pdf"`)
    res.setHeader('Content-Length', String(pdf.byteLength))
    res.setHeader('Cache-Control', 'no-store')
    res.end(pdf)
  } catch (err) {
    logger.error({ err, id }, 'brand/book/:id/pdf error')
    res.status(500).json({ error: 'PDF generation failed', code: 'PDF_ERROR' })
  }
})

/**
 * POST /api/v1/brand/book/:id/publish
 * Active la publication, génère un UUID `public_token` non devinable.
 */
brandBookRouter.post('/brand/book/:id/publish', authMiddleware, async (req, res) => {
  const id = String(req.params.id ?? '')
  try {
    const token = randomUUID()
    const { data, error } = await supabaseAdmin
      .from('brand_books')
      .update({ is_published: true, public_token: token })
      .eq('id', id)
      .eq('user_id', req.userId)
      .select()
      .single()
    if (error) throw error
    if (!data) {
      res.status(404).json({ error: 'Brand book not found', code: 'NOT_FOUND' })
      return
    }
    res.json({ data })
  } catch (err) {
    logger.error({ err, id }, 'brand/book/:id/publish error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * POST /api/v1/brand/book/:id/unpublish
 * Révoque le token et passe is_published à false.
 */
brandBookRouter.post('/brand/book/:id/unpublish', authMiddleware, async (req, res) => {
  const id = String(req.params.id ?? '')
  try {
    const { data, error } = await supabaseAdmin
      .from('brand_books')
      .update({ is_published: false, public_token: null })
      .eq('id', id)
      .eq('user_id', req.userId)
      .select()
      .single()
    if (error) throw error
    if (!data) {
      res.status(404).json({ error: 'Brand book not found', code: 'NOT_FOUND' })
      return
    }
    res.json({ data })
  } catch (err) {
    logger.error({ err, id }, 'brand/book/:id/unpublish error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * DELETE /api/v1/brand/book/:id
 */
brandBookRouter.delete('/brand/book/:id', authMiddleware, async (req, res) => {
  const id = String(req.params.id ?? '')
  try {
    const { error } = await supabaseAdmin
      .from('brand_books')
      .delete()
      .eq('id', id)
      .eq('user_id', req.userId)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    logger.error({ err, id }, 'brand/book/:id DELETE error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * GET /api/v1/brand/book/public/:token
 * Route PUBLIQUE (pas d'auth) — sert le HTML brut quand le book est
 * publié. Le token est un UUID non devinable. On force quelques headers
 * de sécurité pour empêcher l'utilisation comme proxy XSS.
 */
brandBookRouter.get('/brand/book/public/:token', async (req, res) => {
  const token = String(req.params.token ?? '')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    res.status(404).type('text/plain').send('Not found')
    return
  }
  try {
    const { data: book } = await supabaseAdmin
      .from('brand_books')
      .select('html_snapshot, is_published')
      .eq('public_token', token)
      .eq('is_published', true)
      .maybeSingle()
    if (!book) {
      res.status(404).type('text/plain').send('Not found')
      return
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'SAMEORIGIN')
    res.setHeader('Referrer-Policy', 'no-referrer')
    // Pas de cache long — si le user republie après update du DNA, on veut
    // que le visiteur récupère la nouvelle version sans 304.
    res.setHeader('Cache-Control', 'public, max-age=60')
    res.send(book.html_snapshot)
  } catch (err) {
    logger.error({ err, token }, 'brand/book/public/:token error')
    res.status(500).type('text/plain').send('Internal error')
  }
})
