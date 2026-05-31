'use client'

/**
 * Brand Assets — Phase 2 du portage Pomelli, onglet « Assets ».
 *
 * Médiathèque : grille d'images réutilisables. Deux méthodes d'ajout :
 *   - Drag-drop ou click pour upload direct vers Storage (le front parle
 *     directement au bucket avec la session anon — les policies user_id
 *     en place protègent les chemins).
 *   - « Add from URL » : passe par l'API qui fetch côté serveur (limite
 *     SSRF, MIME whitelist, plafond 10 MB).
 *
 * Lightbox simple au clic sur une vignette.
 */

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, Link2, AlertCircle, X } from 'lucide-react'
import { BrandKitLayout } from '@/components/brand/BrandKitLayout'
import { AssetCard } from '@/components/brand/AssetCard'
import { DragDropUploader } from '@/components/brand/DragDropUploader'
import { AddFromUrlModal } from '@/components/brand/AddFromUrlModal'
import { createBrowserClient } from '@/lib/supabase'
import {
  getBrandKit,
  listBrandMedia,
  registerBrandMedia,
  importBrandMediaFromUrl,
  deleteBrandMedia,
  type BrandMediaItem,
} from '@/lib/api'
import type { BrandKit } from '@clyro/shared'

/** Mesure largeur × hauteur d'un fichier image en chargeant un Object URL. */
function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url) }
    img.onerror = () => { resolve(null); URL.revokeObjectURL(url) }
    img.src = url
  })
}

/** MIME type narrowing pour le type strict côté shared. */
const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
type AcceptedMime = (typeof ACCEPTED_MIME)[number]
function asAcceptedMime(mime: string): AcceptedMime | null {
  return (ACCEPTED_MIME as readonly string[]).includes(mime) ? (mime as AcceptedMime) : null
}

interface FromUrlDraft {
  url: string
}

export default function BrandAssetsPage() {
  const params = useParams<{ kitId: string }>()
  const kitId = params?.kitId ?? ''

  const [kit, setKit] = useState<BrandKit | null>(null)
  const [items, setItems] = useState<BrandMediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string>('')
  const [urlModalOpen, setUrlModalOpen] = useState(false)
  const [lightbox, setLightbox] = useState<BrandMediaItem | null>(null)

  useEffect(() => {
    if (!kitId) return
    setLoading(true)
    setError(null)
    const supabase = createBrowserClient()
    Promise.all([getBrandKit(kitId), listBrandMedia(kitId), supabase.auth.getUser()])
      .then(([k, m, u]) => {
        setKit(k.data)
        setItems(m.data)
        setUserId(u.data.user?.id ?? '')
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [kitId])

  async function uploadFile(file: File) {
    if (!userId) throw new Error('No user session')
    const mime = asAcceptedMime(file.type)
    if (!mime) throw new Error(`Unsupported MIME ${file.type}`)
    const supabase = createBrowserClient()
    const ext = file.name.includes('.') ? file.name.split('.').pop() : mime.split('/')[1]
    const safeExt = (ext ?? 'jpg').toLowerCase()
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`
    const storagePath = `${userId}/library/${kitId}/${filename}`

    // Direct upload vers Storage. Les policies brand-assets sur le bucket
    // contraignent (storage.foldername(name))[1] = auth.uid()::text — donc
    // un user ne peut écrire que sous son préfixe.
    const { error: upErr } = await supabase.storage
      .from('brand-assets')
      .upload(storagePath, file, { contentType: file.type, upsert: false })
    if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`)

    // Best-effort dimension probe
    const dims = await readImageDimensions(file)

    const res = await registerBrandMedia({
      brand_kit_id: kitId,
      storage_path: storagePath,
      filename:     file.name,
      mime_type:    mime,
      size_bytes:   file.size,
      width:        dims?.width,
      height:       dims?.height,
    })
    setItems((cur) => [res.data, ...cur])
  }

  async function handleDelete(id: string) {
    const previous = items
    setItems(items.filter((m) => m.id !== id))
    try {
      await deleteBrandMedia(id)
    } catch {
      setItems(previous)
    }
  }

  async function handleFromUrl(draft: FromUrlDraft) {
    const res = await importBrandMediaFromUrl({ brand_kit_id: kitId, url: draft.url })
    setItems((cur) => [res.data, ...cur])
  }

  const header = (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => setUrlModalOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 font-display text-xs text-foreground hover:bg-muted transition-colors"
      >
        <Link2 size={14} />
        Add from URL
      </button>
    </div>
  )

  return (
    <BrandKitLayout kitId={kitId} kitName={kit?.name} saveStatus={header}>
      {loading && (
        <div className="flex items-center justify-center py-20 text-[--text-muted]">
          <Loader2 size={20} className="animate-spin" />
        </div>
      )}
      {error && !loading && (
        <div className="flex flex-col items-center gap-2 py-20">
          <AlertCircle size={24} className="text-error" />
          <p className="font-body text-sm text-[--text-muted]">{error}</p>
        </div>
      )}
      {!loading && !error && (
        <div className="space-y-5">
          <DragDropUploader onUpload={uploadFile} />
          {items.length === 0 ? (
            <p className="text-center font-body text-sm text-[--text-muted] py-6">
              Endless creatives, ready in minutes — upload your first images.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {items.map((m) => (
                <AssetCard
                  key={m.id}
                  url={m.url}
                  filename={m.filename}
                  tags={m.tags}
                  onClick={() => setLightbox(m)}
                  onDelete={() => void handleDelete(m.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/85 p-6"
          onClick={() => setLightbox(null)}
          role="presentation"
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Close lightbox"
            className="absolute top-4 right-4 text-background/80 hover:text-background"
          >
            <X size={24} />
          </button>
          {lightbox.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lightbox.url}
              alt={lightbox.filename}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[85vh] max-w-[85vw] object-contain rounded-xl shadow-2xl"
            />
          )}
        </div>
      )}

      <AddFromUrlModal<FromUrlDraft>
        open={urlModalOpen}
        onClose={() => setUrlModalOpen(false)}
        onScrape={async (url) => ({ url })}
        onConfirm={handleFromUrl}
        title="Import image from URL"
        placeholder="https://example.com/image.jpg"
        renderPreview={(draft) => (
          <div className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-[--text-muted]">URL</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={draft.url} alt="" className="w-full max-h-56 object-contain rounded-xl border border-border bg-muted" />
            <p className="font-body text-xs text-[--text-muted] truncate">{draft.url}</p>
            <p className="font-body text-[11px] text-[--text-muted]">
              The image will be downloaded server-side and stored in your library.
            </p>
          </div>
        )}
      />
    </BrandKitLayout>
  )
}
