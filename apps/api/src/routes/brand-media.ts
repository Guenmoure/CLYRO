/**
 * Brand Media Library — Phase 2 du portage Pomelli (onglet « Assets »).
 *
 * Médiathèque générique d'images réutilisables. Distinct de :
 *  - `brand_assets` (assets IA-générés typés logo/social_post/banner/thumbnail)
 *  - le bucket Storage `brand-assets/<userId>/...` (la donnée brute)
 *
 * Pattern d'upload retenu : le front uploade DIRECTEMENT le fichier au
 * bucket Storage Supabase (avec l'anon key + les policies user_id déjà
 * en place), puis poste sur /brand/media/register pour indexer le fichier.
 * Évite de faire transiter des Mo par Express et simplifie le code.
 *
 * Le from-url passe par l'API qui fetch côté serveur (pour gérer le CORS
 * et appliquer les mêmes plafonds anti-SSRF).
 */

import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { supabaseAdmin } from '../lib/supabase'
import { logger } from '../lib/logger'

export const brandMediaRouter = Router()

const MIME_WHITELIST = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const FETCH_TIMEOUT_MS = 15_000

const registerSchema = z.object({
  brand_kit_id: z.string().uuid(),
  storage_path: z.string().min(1).max(500),
  filename:     z.string().min(1).max(255),
  mime_type:    z.enum(MIME_WHITELIST),
  size_bytes:   z.number().int().positive().max(MAX_BYTES),
  tags:         z.array(z.string().min(1).max(40)).max(20).optional(),
  width:        z.number().int().positive().optional(),
  height:       z.number().int().positive().optional(),
})

const fromUrlSchema = z.object({
  brand_kit_id: z.string().uuid(),
  url:          z.string().url().max(2000),
  tags:         z.array(z.string().min(1).max(40)).max(20).optional(),
})

const updateSchema = z.object({
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
}).strict()

/**
 * Helper : crée (ou rafraîchit) une URL signée 1 an pour un media item.
 * Retourne null en cas d'erreur (non bloquant — le caller peut renvoyer
 * le row sans URL signée et le front retentera).
 */
async function getOrCreateSignedUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from('brand-assets')
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365) // 1 an
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

// ── POST /api/v1/brand/media/register ─────────────────────────────────────────
// Enregistre un média uploadé directement vers Storage par le front.
brandMediaRouter.post('/brand/media/register', authMiddleware, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }
  const { brand_kit_id, storage_path, filename, mime_type, size_bytes, tags, width, height } = parsed.data

  try {
    // Vérifier ownership du kit
    const { data: kit } = await supabaseAdmin
      .from('brand_kits').select('id')
      .eq('id', brand_kit_id).eq('user_id', req.userId).single()
    if (!kit) {
      res.status(404).json({ error: 'Brand kit not found', code: 'NOT_FOUND' })
      return
    }

    // Vérifier que le storage_path commence par <userId>/ — empêche un client
    // malveillant d'enregistrer un chemin appartenant à un autre user.
    if (!storage_path.startsWith(`${req.userId}/`)) {
      res.status(403).json({ error: 'Forbidden storage path', code: 'FORBIDDEN' })
      return
    }

    // Vérifier que le fichier existe vraiment dans Storage (anti-fake)
    const { data: head } = await supabaseAdmin.storage
      .from('brand-assets').list(storage_path.split('/').slice(0, -1).join('/'), {
        search: storage_path.split('/').pop(),
      })
    const found = head?.find((f) => f.name === storage_path.split('/').pop())
    if (!found) {
      res.status(404).json({ error: 'Storage file not found', code: 'STORAGE_NOT_FOUND' })
      return
    }

    const signedUrl = await getOrCreateSignedUrl(storage_path)

    const { data, error } = await supabaseAdmin
      .from('brand_media_library')
      .insert({
        brand_kit_id,
        user_id: req.userId,
        storage_path,
        url: signedUrl,
        filename,
        mime_type,
        size_bytes,
        tags: tags ?? [],
        width:  width  ?? null,
        height: height ?? null,
      })
      .select()
      .single()

    if (error) throw error
    logger.info({ userId: req.userId, mediaId: data.id }, 'Media registered')
    res.status(201).json({ data })
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'brand/media/register error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

// ── POST /api/v1/brand/media/from-url ─────────────────────────────────────────
// Télécharge une image depuis une URL externe, valide, upload vers Storage,
// inscrit dans la médiathèque. Pratique pour importer un visuel depuis le web
// sans devoir le sauvegarder localement.
brandMediaRouter.post('/brand/media/from-url', authMiddleware, async (req, res) => {
  const parsed = fromUrlSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }
  const { brand_kit_id, url, tags } = parsed.data

  try {
    const { data: kit } = await supabaseAdmin
      .from('brand_kits').select('id')
      .eq('id', brand_kit_id).eq('user_id', req.userId).single()
    if (!kit) {
      res.status(404).json({ error: 'Brand kit not found', code: 'NOT_FOUND' })
      return
    }

    // Anti-SSRF : refuse les hosts privés / locaux
    const parsedUrl = new URL(url)
    const host = parsedUrl.hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' ||
        host.endsWith('.local') || host.endsWith('.internal')) {
      res.status(403).json({ error: 'Private host blocked', code: 'BLOCKED_HOST' })
      return
    }

    // Fetch côté serveur avec timeout + plafond taille
    const controller = new AbortController()
    const timeoutHandle = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    let buf: ArrayBuffer
    let detectedMime: string
    try {
      const fetched = await fetch(url, { signal: controller.signal, redirect: 'follow' })
      if (!fetched.ok) {
        res.status(422).json({ error: `Source HTTP ${fetched.status}`, code: 'FETCH_FAILED' })
        return
      }
      detectedMime = (fetched.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
      if (!MIME_WHITELIST.includes(detectedMime as typeof MIME_WHITELIST[number])) {
        res.status(415).json({ error: `Unsupported MIME ${detectedMime}`, code: 'UNSUPPORTED_MEDIA_TYPE' })
        return
      }
      buf = await fetched.arrayBuffer()
      if (buf.byteLength > MAX_BYTES) {
        res.status(413).json({ error: 'File too large (max 10 MB)', code: 'PAYLOAD_TOO_LARGE' })
        return
      }
    } finally {
      clearTimeout(timeoutHandle)
    }

    // Build storage path
    const ext = detectedMime.split('/')[1] === 'jpeg' ? 'jpg' : detectedMime.split('/')[1]
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const storage_path = `${req.userId}/library/${brand_kit_id}/${filename}`

    const { error: uploadErr } = await supabaseAdmin.storage
      .from('brand-assets')
      .upload(storage_path, Buffer.from(buf), { contentType: detectedMime, upsert: false })
    if (uploadErr) {
      logger.error({ err: uploadErr, userId: req.userId }, 'Media from-url storage upload failed')
      res.status(500).json({ error: 'Storage upload failed', code: 'STORAGE_ERROR' })
      return
    }

    const signedUrl = await getOrCreateSignedUrl(storage_path)

    const { data, error } = await supabaseAdmin
      .from('brand_media_library')
      .insert({
        brand_kit_id,
        user_id: req.userId,
        storage_path,
        url: signedUrl,
        filename,
        mime_type: detectedMime,
        size_bytes: buf.byteLength,
        tags: tags ?? [],
        source_url: url,
      })
      .select()
      .single()

    if (error) throw error
    logger.info({ userId: req.userId, mediaId: data.id, sourceUrl: url }, 'Media imported from URL')
    res.status(201).json({ data })
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'brand/media/from-url error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

// ── GET /api/v1/brand/:brand_kit_id/media ─────────────────────────────────────
brandMediaRouter.get('/brand/:brand_kit_id/media', authMiddleware, async (req, res) => {
  const { brand_kit_id } = req.params
  try {
    const { data, error } = await supabaseAdmin
      .from('brand_media_library')
      .select('*')
      .eq('brand_kit_id', brand_kit_id)
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json({ data: data ?? [] })
  } catch (err) {
    logger.error({ err, brand_kit_id }, 'brand/media GET error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

// ── PUT /api/v1/brand/media/:id ────────────────────────────────────────────────
// Met à jour les tags du media item (les autres champs ne sont pas éditables).
brandMediaRouter.put('/brand/media/:id', authMiddleware, async (req, res) => {
  const { id } = req.params
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('brand_media_library')
      .update(parsed.data)
      .eq('id', id)
      .eq('user_id', req.userId)
      .select()
      .single()
    if (error) throw error
    if (!data) {
      res.status(404).json({ error: 'Media not found', code: 'NOT_FOUND' })
      return
    }
    res.json({ data })
  } catch (err) {
    logger.error({ err, id }, 'brand/media PUT error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

// ── DELETE /api/v1/brand/media/:id ─────────────────────────────────────────────
brandMediaRouter.delete('/brand/media/:id', authMiddleware, async (req, res) => {
  const { id } = req.params
  try {
    // Récupère le storage_path pour pouvoir supprimer du bucket
    const { data: existing } = await supabaseAdmin
      .from('brand_media_library')
      .select('storage_path')
      .eq('id', id)
      .eq('user_id', req.userId)
      .single()
    if (!existing) {
      res.status(404).json({ error: 'Media not found', code: 'NOT_FOUND' })
      return
    }

    const { error: storageErr } = await supabaseAdmin.storage
      .from('brand-assets')
      .remove([existing.storage_path])
    if (storageErr) {
      // Non bloquant : on supprime la ligne même si Storage échoue (le
      // fichier sera nettoyé manuellement plus tard).
      logger.warn({ err: storageErr, id }, 'Media storage delete failed (continuing)')
    }

    const { error } = await supabaseAdmin
      .from('brand_media_library')
      .delete()
      .eq('id', id)
      .eq('user_id', req.userId)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    logger.error({ err, id }, 'brand/media DELETE error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})
