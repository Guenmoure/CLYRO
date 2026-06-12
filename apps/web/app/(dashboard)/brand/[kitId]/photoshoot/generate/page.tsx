'use client'

/**
 * Generate or Edit Image — Phase 4 V2.
 *
 * Mode `generate_edit` du pipeline photoshoot : prompt libre + image de
 * référence optionnelle. La palette de marque est ajoutée automatiquement
 * côté backend (cf. routes/brand-photoshoot.ts). Retourne 4 variations.
 *
 * Cette page navigue vers /photoshoot/[shootId] dès qu'on récupère
 * l'ID de la session — le polling et les actions vivent dans la page detail.
 */

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, AlertCircle, Sparkles, ImagePlus, X,
} from 'lucide-react'
import { BrandKitLayout } from '@/components/brand/BrandKitLayout'
import { cn } from '@/lib/utils'
import { createBrowserClient } from '@/lib/supabase'
import { toast } from '@/components/ui/toast'
import { useLanguage } from '@/lib/i18n'
import {
  getBrandKit,
  listBrandMedia,
  createBrandPhotoshoot,
  type PhotoshootAspectRatio,
  type BrandMediaItem,
} from '@/lib/api'
import type { BrandKit } from '@clyro/shared'

const ASPECTS: { value: PhotoshootAspectRatio; label: string }[] = [
  { value: '9:16', label: 'Story (9:16)' },
  { value: '1:1',  label: 'Square (1:1)' },
  { value: '4:5',  label: 'Feed (4:5)'   },
  { value: '16:9', label: 'Wide (16:9)'  },
]

export default function PhotoshootGeneratePage() {
  const params = useParams<{ kitId: string }>()
  const router = useRouter()
  const kitId = params?.kitId ?? ''
  const { t } = useLanguage()

  const [kit, setKit] = useState<BrandKit | null>(null)
  const [media, setMedia] = useState<BrandMediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState('')

  const [prompt, setPrompt] = useState('')
  const [referenceUrl, setReferenceUrl] = useState<string | null>(null)
  const [referenceUploading, setReferenceUploading] = useState(false)
  const [aspectRatio, setAspectRatio] = useState<PhotoshootAspectRatio>('1:1')
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!kitId) return
    setLoading(true)
    setError(null)
    const supabase = createBrowserClient()
    Promise.all([
      getBrandKit(kitId),
      listBrandMedia(kitId),
      supabase.auth.getUser(),
    ])
      .then(([k, m, u]) => {
        setKit(k.data)
        setMedia(m.data)
        setUserId(u.data.user?.id ?? '')
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : null))
      .finally(() => setLoading(false))
  }, [kitId])

  const uploadReference = useCallback(async (file: File) => {
    if (!userId) return
    setReferenceUploading(true)
    try {
      const supabase = createBrowserClient()
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const storagePath = `${userId}/photoshoot-refs/${kitId}/${filename}`
      const { error: upErr } = await supabase.storage
        .from('brand-assets')
        .upload(storagePath, file, { contentType: file.type, upsert: false })
      if (upErr) throw new Error(upErr.message)
      const { data: signed } = await supabase.storage
        .from('brand-assets')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365)
      if (!signed?.signedUrl) throw new Error('Could not sign URL')
      setReferenceUrl(signed.signedUrl)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('bk_uploadFailed'))
    } finally {
      setReferenceUploading(false)
    }
  }, [userId, kitId, t])

  async function handleGenerate() {
    if (submitting) return
    const trimmed = prompt.trim()
    if (trimmed.length < 10) {
      toast.error(t('bk_gen_promptTooShort'))
      return
    }
    setSubmitting(true)
    try {
      const res = await createBrandPhotoshoot({
        brand_kit_id:   kitId,
        mode:           'generate_edit',
        reference_urls: referenceUrl ? [referenceUrl] : [],
        prompt:         trimmed,
        aspect_ratio:   aspectRatio,
      })
      // Navigation immédiate vers le detail — le polling y prendra le relais.
      router.push(`/brand/${kitId}/photoshoot/${res.data.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('bk_generationFailed'))
      setSubmitting(false)
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
  if (error || !kit) {
    return (
      <BrandKitLayout kitId={kitId}>
        <div className="flex flex-col items-center gap-2 py-20">
          <AlertCircle size={24} className="text-error" />
          <p className="font-body text-sm text-[--text-muted]">{error ?? t('bk_kitNotFound')}</p>
        </div>
      </BrandKitLayout>
    )
  }

  return (
    <BrandKitLayout kitId={kitId} kitName={kit.name}>
      <div className="max-w-3xl mx-auto space-y-6">
        <Link
          href={`/brand/${kitId}/photoshoot`}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[--text-muted] hover:text-foreground"
        >
          <ArrowLeft size={12} /> {t('bk_backToPhotoshoot')}
        </Link>

        <header>
          <p className="font-mono text-[10px] uppercase tracking-wider text-[--text-muted]">{t('bk_gen_kicker')}</p>
          <h2 className="font-display text-xl font-semibold text-foreground mt-1">{t('bk_gen_title')}</h2>
          <p className="font-body text-sm text-[--text-muted] mt-1">
            {t('bk_gen_sub')}
          </p>
        </header>

        {/* Prompt */}
        <section className="space-y-2">
          <label className="font-mono text-[10px] uppercase tracking-wider text-[--text-muted]">{t('bk_prompt')}</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value.slice(0, 1500))}
            rows={6}
            placeholder={t('bk_gen_promptPlaceholder')}
            className="w-full rounded-xl border border-border bg-muted px-3 py-2 font-body text-sm text-foreground outline-none focus:border-blue-500/60 resize-none"
          />
          <p className="font-mono text-[10px] text-[--text-muted] text-right">
            {t('bk_charCount').replace('{count}', String(prompt.trim().length))}
          </p>
        </section>

        {/* Reference image */}
        <section className="space-y-2">
          <label className="font-mono text-[10px] uppercase tracking-wider text-[--text-muted]">{t('bk_gen_refLabel')}</label>
          {referenceUrl ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={referenceUrl} alt={t('bk_gen_refAlt')} className="w-20 h-20 rounded-lg object-cover border border-border" />
              <div className="flex-1 min-w-0">
                <p className="font-mono text-[10px] text-[--text-muted]">{t('bk_gen_refHint')}</p>
                <div className="mt-1 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMediaPickerOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[10px] text-foreground hover:bg-muted"
                  >
                    {t('bk_gen_change')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReferenceUrl(null)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[10px] text-[--text-muted] hover:text-error"
                  >
                    {t('bk_gen_remove')}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className={cn(
                'rounded-xl border-2 border-dashed border-border bg-background p-4 flex flex-col items-center gap-2 text-[--text-muted] cursor-pointer hover:border-foreground/40 transition-colors',
                referenceUploading && 'opacity-50 pointer-events-none',
              )}>
                {referenceUploading ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />}
                <span className="font-body text-xs text-foreground">{referenceUploading ? t('bk_gen_uploading') : t('bk_gen_upload')}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadReference(f) }}
                />
              </label>
              <button
                type="button"
                onClick={() => setMediaPickerOpen(true)}
                className="rounded-xl border-2 border-dashed border-border bg-background p-4 flex flex-col items-center gap-2 text-[--text-muted] cursor-pointer hover:border-foreground/40 transition-colors"
              >
                <Sparkles size={20} />
                <span className="font-body text-xs text-foreground">{t('bk_gen_pickFromLibrary')}</span>
              </button>
            </div>
          )}
        </section>

        {/* Aspect */}
        <section className="space-y-2">
          <label className="font-mono text-[10px] uppercase tracking-wider text-[--text-muted]">{t('bk_gen_aspectLabel')}</label>
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
        </section>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 border-t border-border pt-4">
          <span className="font-mono text-[10px] text-[--text-muted]">{t('bk_gen_costNote')}</span>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={submitting || prompt.trim().length < 10}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-lg bg-foreground text-background px-4 py-2 font-display text-sm font-medium',
              (submitting || prompt.trim().length < 10) && 'opacity-50 cursor-not-allowed',
            )}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {t('bk_generate')}
          </button>
        </div>
      </div>

      {/* Media picker modal */}
      {mediaPickerOpen && (
        <MediaPickerInline
          media={media}
          onPick={(url) => { setReferenceUrl(url); setMediaPickerOpen(false) }}
          onClose={() => setMediaPickerOpen(false)}
        />
      )}
    </BrandKitLayout>
  )
}

function MediaPickerInline({
  media, onPick, onClose,
}: {
  media:   BrandMediaItem[]
  onPick:  (url: string) => void
  onClose: () => void
}) {
  const { t } = useLanguage()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="font-display text-base font-semibold text-foreground">{t('bk_gen_pickReference')}</h3>
          <button type="button" onClick={onClose} aria-label={t('close')} className="text-[--text-muted] hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 max-h-[70vh] overflow-y-auto">
          {media.length === 0 ? (
            <p className="text-center font-body text-sm text-[--text-muted] py-8">
              {t('bk_libraryEmpty')}
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {media.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => m.url && onPick(m.url)}
                  disabled={!m.url}
                  className="group relative aspect-square rounded-lg overflow-hidden border border-border bg-muted hover:border-foreground/40 transition-colors disabled:opacity-50"
                >
                  {m.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt={m.filename} className="w-full h-full object-cover" loading="lazy" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
