'use client'

/**
 * Photoshoot detail — Phase 4 V2.
 *
 * Page d'une session de photoshoot : entête avec statut, contexte
 * (mode / template / aspect / prompt), galerie 4 variations avec actions
 * Download / Save to Assets / Animate. Polling toutes les 3 s tant que
 * le statut est generating.
 *
 * Animate envoie la variation au pipeline motion_auto comme bridge —
 * même pattern que l'Animate sur Creative.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, AlertCircle, Download, Sparkles, Trash2, CheckCircle2,
} from 'lucide-react'
import { BrandKitLayout } from '@/components/brand/BrandKitLayout'
import { cn } from '@/lib/utils'
import { createBrowserClient } from '@/lib/supabase'
import {
  getBrandKit,
  getBrandPhotoshoot,
  deleteBrandPhotoshoot,
  animateBrandPhotoshoot,
  registerBrandMedia,
  type BrandPhotoshoot,
} from '@/lib/api'
import type { BrandKit } from '@clyro/shared'

const POLL_INTERVAL_MS = 3000

export default function BrandPhotoshootDetailPage() {
  const params = useParams<{ kitId: string; shootId: string }>()
  const router = useRouter()
  const kitId = params?.kitId ?? ''
  const shootId = params?.shootId ?? ''

  const [kit, setKit] = useState<BrandKit | null>(null)
  const [shoot, setShoot] = useState<BrandPhotoshoot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState('')
  const [animatingIndex, setAnimatingIndex] = useState<number | null>(null)
  const [savingIndex, setSavingIndex] = useState<number | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!shootId || !kitId) return
    setLoading(true)
    setError(null)
    const supabase = createBrowserClient()
    Promise.all([
      getBrandKit(kitId),
      getBrandPhotoshoot(shootId),
      supabase.auth.getUser(),
    ])
      .then(([k, s, u]) => {
        setKit(k.data)
        setShoot(s.data)
        setUserId(u.data.user?.id ?? '')
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [shootId, kitId])

  // ── Polling ───────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    try {
      const r = await getBrandPhotoshoot(shootId)
      setShoot(r.data)
    } catch { /* ignore */ }
  }, [shootId])

  useEffect(() => {
    if (!shoot || (shoot.status !== 'generating' && shoot.status !== 'pending')) {
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = null
      return
    }
    if (pollRef.current) return
    pollRef.current = setInterval(() => { void refresh() }, POLL_INTERVAL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [shoot, refresh])

  // ── Actions ───────────────────────────────────────────────────────────────
  async function handleSaveToAssets(url: string, index: number) {
    if (!userId || savingIndex !== null) return
    setSavingIndex(index)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Fetch ${res.status}`)
      const buf = await res.arrayBuffer()
      const blob = new Blob([buf], { type: 'image/jpeg' })
      const filename = `photoshoot-${shootId.slice(0, 8)}-v${index}.jpg`
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
    } finally {
      setSavingIndex(null)
    }
  }

  async function handleAnimate(index: number) {
    if (animatingIndex !== null) return
    setAnimatingIndex(index)
    try {
      const res = await animateBrandPhotoshoot(shootId, index)
      router.push(`/motion?launched=${res.data.video_id}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Animation failed')
      setAnimatingIndex(null)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this photoshoot session?')) return
    try {
      await deleteBrandPhotoshoot(shootId)
      router.push(`/brand/${kitId}/photoshoot`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <BrandKitLayout kitId={kitId}>
        <div className="flex items-center justify-center py-20 text-[--text-muted]">
          <Loader2 size={20} className="animate-spin" />
        </div>
      </BrandKitLayout>
    )
  }
  if (error || !shoot || !kit) {
    return (
      <BrandKitLayout kitId={kitId}>
        <div className="flex flex-col items-center gap-3 py-20">
          <AlertCircle size={24} className="text-error" />
          <p className="font-body text-sm text-[--text-muted]">{error ?? 'Photoshoot not found'}</p>
          <Link href={`/brand/${kitId}/photoshoot`} className="font-mono text-xs text-foreground underline">
            ← Back to Photoshoot
          </Link>
        </div>
      </BrandKitLayout>
    )
  }

  const statusMeta = {
    pending:    { label: 'Pending',    cls: 'text-[--text-muted] bg-muted',     Icon: Loader2     },
    generating: { label: 'Generating', cls: 'text-blue-700 bg-blue-100',         Icon: Loader2     },
    done:       { label: 'Ready',      cls: 'text-emerald-700 bg-emerald-100',   Icon: CheckCircle2 },
    error:      { label: 'Error',      cls: 'text-error bg-error/10',            Icon: AlertCircle  },
  }[shoot.status]
  const StatusIcon = statusMeta.Icon

  return (
    <BrandKitLayout kitId={kitId} kitName={kit.name}>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Link
            href={`/brand/${kitId}/photoshoot`}
            className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[--text-muted] hover:text-foreground"
          >
            <ArrowLeft size={12} /> All photoshoots
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-[11px] text-[--text-muted] hover:text-error"
          >
            <Trash2 size={12} /> Delete session
          </button>
        </div>

        {/* Context block */}
        <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider', statusMeta.cls)}>
              <StatusIcon size={10} className={shoot.status === 'generating' || shoot.status === 'pending' ? 'animate-spin' : undefined} />
              {statusMeta.label}
            </span>
            <span className="font-mono text-[10px] text-[--text-muted]">{shoot.aspect_ratio}</span>
            {shoot.template_id && (
              <span className="font-mono text-[10px] text-[--text-muted]">· template <code className="text-foreground">{shoot.template_id}</code></span>
            )}
            <span className="font-mono text-[10px] text-[--text-muted]">· {shoot.mode === 'product_template' ? 'product template' : 'generate/edit'}</span>
            <span className="font-mono text-[10px] text-[--text-muted]">· {new Date(shoot.created_at).toLocaleString()}</span>
          </div>
          {shoot.prompt && (
            <p className="font-body text-xs text-[--text-muted] italic leading-relaxed">
              “{shoot.prompt}”
            </p>
          )}
          {shoot.input_image_url && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-[--text-muted]">Source product:</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shoot.input_image_url} alt="" className="w-10 h-10 rounded-md object-cover border border-border" />
            </div>
          )}
          {shoot.status === 'error' && (
            <p className="font-mono text-[11px] text-error">
              {String((shoot.metadata as { error_message?: string })?.error_message ?? 'Pipeline failed')}
            </p>
          )}
        </section>

        {/* Variations gallery */}
        <section className="space-y-3">
          <h3 className="font-display text-sm font-semibold text-foreground">
            Variations <span className="font-mono text-[10px] text-[--text-muted] ml-1">({shoot.output_urls.length}/4)</span>
          </h3>
          {shoot.output_urls.length === 0 && shoot.status !== 'error' ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-xl border border-border bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {shoot.output_urls.map((url, i) => (
                <VariationCard
                  key={`${url}-${i}`}
                  url={url}
                  index={i}
                  animating={animatingIndex === i}
                  saving={savingIndex === i}
                  onSaveToAssets={() => void handleSaveToAssets(url, i)}
                  onAnimate={() => void handleAnimate(i)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </BrandKitLayout>
  )
}

function VariationCard({
  url, index, animating, saving, onSaveToAssets, onAnimate,
}: {
  url:           string
  index:         number
  animating:     boolean
  saving:        boolean
  onSaveToAssets: () => void
  onAnimate:     () => void
}) {
  return (
    <div className="group rounded-2xl border border-border bg-card overflow-hidden">
      <div className="relative aspect-square bg-muted overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={`Variation ${index + 1}`} className="w-full h-full object-cover" />
        <span className="absolute top-2 left-2 rounded-full bg-background/85 backdrop-blur px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-foreground">
          V{index + 1}
        </span>
      </div>
      <div className="p-3 flex items-center gap-2 flex-wrap">
        <a
          href={url}
          download={`variation-${index + 1}.jpg`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-[11px] text-foreground hover:bg-muted"
        >
          <Download size={12} /> Download
        </a>
        <button
          type="button"
          onClick={onSaveToAssets}
          disabled={saving}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-[11px] text-foreground hover:bg-muted',
            saving && 'opacity-50 cursor-not-allowed',
          )}
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : null}
          Save to Assets
        </button>
        <button
          type="button"
          onClick={onAnimate}
          disabled={animating}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg bg-foreground text-background px-3 py-1.5 font-display text-[11px] font-medium',
            animating && 'opacity-50 cursor-not-allowed',
          )}
        >
          {animating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          Animate
        </button>
      </div>
    </div>
  )
}
