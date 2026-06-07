'use client'

/**
 * Product photoshoot with templates — Phase 4 du portage Pomelli.
 *
 * Layout 2 colonnes :
 *   - Gauche  : zone d'upload pour la photo produit + selector aspect ratio
 *   - Droite  : grille de templates système (9 entrées), un sélectionné
 *
 * CTA `Generate Photoshoot` enclenche POST /brand/photoshoots, puis poll
 * toutes les 3 s jusqu'au statut `done` (ou `error`). Les 4 variations
 * sont affichées en bas de page avec actions Download / Save to Assets.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, AlertCircle, Sparkles, Download, ImagePlus, CheckCircle2,
} from 'lucide-react'
import { BrandKitLayout } from '@/components/brand/BrandKitLayout'
import { cn } from '@/lib/utils'
import { createBrowserClient } from '@/lib/supabase'
import {
  getBrandKit,
  listBrandPhotoshootTemplates,
  createBrandPhotoshoot,
  getBrandPhotoshoot,
  registerBrandMedia,
  type BrandPhotoshootTemplateInfo,
  type BrandPhotoshoot,
  type PhotoshootAspectRatio,
} from '@/lib/api'

const ASPECTS: { value: PhotoshootAspectRatio; label: string }[] = [
  { value: '9:16', label: 'Story (9:16)' },
  { value: '1:1',  label: 'Square (1:1)' },
  { value: '4:5',  label: 'Feed (4:5)'   },
  { value: '16:9', label: 'Wide (16:9)'  },
]

const POLL_INTERVAL_MS = 3000

export default function BrandPhotoshootTemplateInfosPage() {
  const params = useParams<{ kitId: string }>()
  const kitId = params?.kitId ?? ''

  const [templates, setTemplates] = useState<BrandPhotoshootTemplateInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState('')

  const [inputImageUrl, setInputImageUrl] = useState<string | null>(null)
  const [inputUploading, setInputUploading] = useState(false)
  const [aspectRatio, setAspectRatio] = useState<PhotoshootAspectRatio>('9:16')
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [shoot, setShoot] = useState<BrandPhotoshoot | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!kitId) return
    setLoading(true)
    setError(null)
    const supabase = createBrowserClient()
    Promise.all([
      getBrandKit(kitId),
      listBrandPhotoshootTemplates(),
      supabase.auth.getUser(),
    ])
      .then(([_k, t, u]) => {
        setTemplates(t.data)
        setUserId(u.data.user?.id ?? '')
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [kitId])

  // Poll while generating
  useEffect(() => {
    if (!shoot || (shoot.status !== 'generating' && shoot.status !== 'pending')) {
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = null
      return
    }
    if (pollRef.current) return
    pollRef.current = setInterval(async () => {
      try {
        const r = await getBrandPhotoshoot(shoot.id)
        setShoot(r.data)
      } catch { /* ignore */ }
    }, POLL_INTERVAL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [shoot])

  const uploadProductImage = useCallback(async (file: File) => {
    if (!userId) return
    setInputUploading(true)
    try {
      const supabase = createBrowserClient()
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const storagePath = `${userId}/photoshoot-inputs/${kitId}/${filename}`
      const { error: upErr } = await supabase.storage
        .from('brand-assets')
        .upload(storagePath, file, { contentType: file.type, upsert: false })
      if (upErr) throw new Error(upErr.message)
      const { data: signed } = await supabase.storage
        .from('brand-assets')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365)
      if (!signed?.signedUrl) throw new Error('Could not sign URL')
      setInputImageUrl(signed.signedUrl)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setInputUploading(false)
    }
  }, [userId, kitId])

  async function handleGenerate() {
    if (!inputImageUrl || !selectedTemplate || submitting) return
    setSubmitting(true)
    try {
      const res = await createBrandPhotoshoot({
        brand_kit_id:    kitId,
        mode:            'product_template',
        input_image_url: inputImageUrl,
        template_id:     selectedTemplate,
        aspect_ratio:    aspectRatio,
      })
      setShoot(res.data)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function saveToAssets(imageUrl: string) {
    if (!userId) return
    try {
      const res = await fetch(imageUrl)
      if (!res.ok) throw new Error(`Fetch ${res.status}`)
      const buf = await res.arrayBuffer()
      const blob = new Blob([buf], { type: 'image/jpeg' })
      const filename = `photoshoot-${Date.now()}.jpg`
      const supabase = createBrowserClient()
      const storagePath = `${userId}/library/${kitId}/${filename}`
      const { error: upErr } = await supabase.storage
        .from('brand-assets')
        .upload(storagePath, blob, { contentType: 'image/jpeg', upsert: false })
      if (upErr) throw new Error(upErr.message)
      await registerBrandMedia({
        brand_kit_id: kitId,
        storage_path: storagePath,
        filename,
        mime_type:    'image/jpeg',
        size_bytes:   blob.size,
        tags:         ['photoshoot'],
      })
      alert('Saved to Assets library')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed')
    }
  }

  if (loading) {
    return (
      <BrandKitLayout kitId={kitId}>
        <div className="flex items-center justify-center py-20 text-[--text-muted]">
          <Loader2 size={20} className="animate-spin" />
        </div>
      </BrandKitLayout>
    )
  }
  if (error) {
    return (
      <BrandKitLayout kitId={kitId}>
        <div className="flex flex-col items-center gap-2 py-20">
          <AlertCircle size={24} className="text-error" />
          <p className="font-body text-sm text-[--text-muted]">{error}</p>
        </div>
      </BrandKitLayout>
    )
  }

  const canGenerate = !!inputImageUrl && !!selectedTemplate && !submitting && (!shoot || shoot.status === 'done' || shoot.status === 'error')

  return (
    <BrandKitLayout kitId={kitId}>
      <div className="max-w-5xl mx-auto space-y-6">
        <Link
          href={`/brand/${kitId}/photoshoot`}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[--text-muted] hover:text-foreground"
        >
          <ArrowLeft size={12} /> Back to Photoshoot
        </Link>

        <header>
          <p className="font-mono text-[10px] uppercase tracking-wider text-[--text-muted]">Product photoshoot</p>
          <h2 className="font-display text-xl font-semibold text-foreground mt-1">Upload + template = 4 hero shots</h2>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left — product image + aspect */}
          <section className="space-y-4">
            <h3 className="font-display text-sm font-semibold text-foreground">1 · Product image</h3>
            {inputImageUrl ? (
              <div className="rounded-2xl border border-border bg-card p-3 space-y-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={inputImageUrl} alt="Product" className="w-full max-h-[320px] object-contain rounded-xl bg-muted" />
                <button
                  type="button"
                  onClick={() => setInputImageUrl(null)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 font-mono text-[10px] text-[--text-muted] hover:text-foreground"
                >
                  Replace
                </button>
              </div>
            ) : (
              <label className={cn(
                'rounded-2xl border-2 border-dashed border-border bg-background p-8 flex flex-col items-center gap-2 text-[--text-muted] cursor-pointer hover:border-foreground/40 transition-colors',
                inputUploading && 'opacity-50 pointer-events-none',
              )}>
                {inputUploading ? <Loader2 size={24} className="animate-spin" /> : <ImagePlus size={24} />}
                <span className="font-body text-sm text-foreground">
                  {inputUploading ? 'Uploading…' : 'Click to upload product image'}
                </span>
                <span className="font-mono text-[10px]">JPG, PNG, WebP up to 10 MB</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadProductImage(f) }}
                />
              </label>
            )}

            <div>
              <h3 className="font-display text-sm font-semibold text-foreground mb-2">2 · Aspect ratio</h3>
              <div className="flex flex-wrap gap-2">
                {ASPECTS.map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => setAspectRatio(a.value)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 font-mono text-[11px] transition-colors',
                      aspectRatio === a.value
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border bg-background text-[--text-muted] hover:text-foreground',
                    )}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Right — templates grid */}
          <section className="space-y-3">
            <h3 className="font-display text-sm font-semibold text-foreground">3 · Template</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[480px] overflow-y-auto -mx-1 px-1">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTemplate(t.id)}
                  className={cn(
                    'text-left rounded-xl border-2 transition-colors p-3 space-y-1',
                    selectedTemplate === t.id
                      ? 'border-[#c45b3a] bg-muted'
                      : 'border-border bg-card hover:border-foreground/30',
                  )}
                >
                  <span className="font-mono text-[9px] uppercase tracking-wider text-[--text-muted]">{t.category}</span>
                  <p className="font-display text-xs font-semibold text-foreground">{t.name}</p>
                  <p className="font-body text-[10px] text-[--text-muted] line-clamp-2">{t.description}</p>
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* CTA */}
        <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
          {!canGenerate && !shoot && (
            <span className="font-mono text-[10px] text-[--text-muted]">
              Upload an image and pick a template to continue · 4 credits
            </span>
          )}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canGenerate}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg bg-foreground text-background px-4 py-2 font-display text-sm font-medium',
              !canGenerate && 'opacity-50 cursor-not-allowed',
            )}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Generate photoshoot
          </button>
        </div>

        {/* Results */}
        {shoot && (
          <PhotoshootResults shoot={shoot} onSaveToAssets={(url) => void saveToAssets(url)} />
        )}
      </div>
    </BrandKitLayout>
  )
}

function PhotoshootResults({
  shoot, onSaveToAssets,
}: {
  shoot: BrandPhotoshoot
  onSaveToAssets: (url: string) => void
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-foreground">
          Variations <span className="font-mono text-[10px] text-[--text-muted] ml-1">({shoot.output_urls.length}/4)</span>
        </h3>
        {shoot.status === 'generating' && (
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-blue-600">
            <Loader2 size={11} className="animate-spin" /> Generating…
          </span>
        )}
        {shoot.status === 'done' && (
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-emerald-600">
            <CheckCircle2 size={11} /> Done
          </span>
        )}
        {shoot.status === 'error' && (
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-error">
            <AlertCircle size={11} /> Error
          </span>
        )}
      </div>

      {shoot.status === 'error' && (
        <div className="rounded-xl border border-error/30 bg-error/5 p-3 font-mono text-[11px] text-error">
          {String((shoot.metadata as { error_message?: string })?.error_message ?? 'Pipeline failed')}
        </div>
      )}

      {shoot.output_urls.length === 0 && shoot.status !== 'error' ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl border border-border bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {shoot.output_urls.map((url, i) => (
            <div key={url + i} className="group relative aspect-square rounded-xl overflow-hidden border border-border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Variation ${i + 1}`} className="w-full h-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 p-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-foreground/80 to-transparent">
                <a
                  href={url}
                  download
                  className="inline-flex items-center gap-1 rounded-md bg-background/90 backdrop-blur px-1.5 py-0.5 font-mono text-[10px] text-foreground hover:bg-background"
                >
                  <Download size={10} /> PNG
                </a>
                <button
                  type="button"
                  onClick={() => onSaveToAssets(url)}
                  className="inline-flex items-center gap-1 rounded-md bg-background/90 backdrop-blur px-1.5 py-0.5 font-mono text-[10px] text-foreground hover:bg-background"
                >
                  Save to Assets
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
