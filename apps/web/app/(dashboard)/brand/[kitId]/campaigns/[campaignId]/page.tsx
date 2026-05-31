'use client'

/**
 * Campaign detail — Phase 3.3 du portage Pomelli.
 *
 * Layout deux colonnes :
 *   - Sidebar gauche  : contexte de la campagne (titre, description,
 *                       produit attaché, assets sources)
 *   - Zone principale : scroll horizontal des créatives + bouton
 *                       « + Add Creative »
 *
 * Chaque créative est rendue par CreativeGalleryCard avec quatre actions
 * (more / share / Animate / toggle text overlay) et trois toggles de
 * visibilité par bloc.
 *
 * Le bouton **Animate** pose le pont avec Motion : la créative devient le
 * brief d'une vidéo cover de 6 s lancée via le pipeline motion_auto.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, AlertCircle, Plus, Package } from 'lucide-react'
import { BrandKitLayout } from '@/components/brand/BrandKitLayout'
import { CreativeGalleryCard } from '@/components/brand/CreativeGalleryCard'
import {
  getBrandCampaign,
  updateBrandCreative,
  deleteBrandCreative,
  addCreativeToBrandCampaign,
  animateBrandCreative,
  type BrandCampaign,
  type BrandCreative,
} from '@/lib/api'
import { cn } from '@/lib/utils'
import type { CreativeBlocksVisible } from '@clyro/shared'

const POLL_INTERVAL_MS = 3000

export default function BrandCampaignDetailPage() {
  const params = useParams<{ kitId: string; campaignId: string }>()
  const router = useRouter()
  const kitId = params?.kitId ?? ''
  const campaignId = params?.campaignId ?? ''

  const [campaign, setCampaign] = useState<BrandCampaign | null>(null)
  const [creatives, setCreatives] = useState<BrandCreative[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addingCreative, setAddingCreative] = useState(false)
  const [animatingId, setAnimatingId] = useState<string | null>(null)
  const [copiedUrl, setCopiedUrl] = useState(false)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await getBrandCampaign(campaignId)
      setCampaign(res.data.campaign)
      setCreatives(res.data.creatives)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    }
  }, [campaignId])

  // Initial load
  useEffect(() => {
    if (!campaignId) return
    setLoading(true)
    setError(null)
    refresh().finally(() => setLoading(false))
  }, [campaignId, refresh])

  // Polling pendant generating
  useEffect(() => {
    if (!campaign || campaign.status !== 'generating') {
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
  }, [campaign, refresh])

  // ── Actions ───────────────────────────────────────────────────────────────
  async function handleToggleBlock(creative: BrandCreative, block: keyof CreativeBlocksVisible, visible: boolean) {
    const previous = creatives
    const nextBlocks = { ...creative.blocks_visible, [block]: visible }
    setCreatives(creatives.map((c) =>
      c.id === creative.id ? { ...c, blocks_visible: nextBlocks } : c,
    ))
    try {
      await updateBrandCreative(creative.id, { blocks_visible: { [block]: visible } })
    } catch {
      setCreatives(previous)
    }
  }

  async function handleDelete(creativeId: string) {
    const previous = creatives
    setCreatives(creatives.filter((c) => c.id !== creativeId))
    try {
      await deleteBrandCreative(creativeId)
    } catch {
      setCreatives(previous)
    }
  }

  async function handleAddCreative() {
    if (addingCreative) return
    setAddingCreative(true)
    try {
      const res = await addCreativeToBrandCampaign(campaignId)
      setCreatives((cur) => [...cur, res.data.creative])
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add creative')
    } finally {
      setAddingCreative(false)
    }
  }

  async function handleAnimate(creativeId: string) {
    if (animatingId) return
    setAnimatingId(creativeId)
    try {
      const res = await animateBrandCreative(creativeId)
      // Navigate vers la liste motion où la nouvelle vidéo apparaîtra avec
      // son statut. (Le détail player live n'existe pas comme route MVP.)
      router.push(`/motion?launched=${res.data.video_id}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to launch animation')
      setAnimatingId(null)
    }
  }

  async function handleShare(creativeId: string) {
    const url = `${window.location.origin}/brand/${kitId}/campaigns/${campaignId}#creative-${creativeId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    } catch {
      // Fallback discret — sélectionner un input invisible, etc. Pour MVP on
      // accepte l'échec silencieux sur navigateurs sans clipboard API.
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
  if (error || !campaign) {
    return (
      <BrandKitLayout kitId={kitId}>
        <div className="flex flex-col items-center gap-3 py-20">
          <AlertCircle size={24} className="text-error" />
          <p className="font-body text-sm text-[--text-muted]">{error ?? 'Campaign not found'}</p>
          <Link href={`/brand/${kitId}/campaigns`} className="font-mono text-xs text-foreground underline">
            ← Back to campaigns
          </Link>
        </div>
      </BrandKitLayout>
    )
  }

  return (
    <BrandKitLayout
      kitId={kitId}
      kitName={campaign.title}
      saveStatus={copiedUrl ? <span className="text-emerald-600">Link copied</span> : null}
    >
      <div className="flex gap-6 -mx-2">
        {/* Sidebar gauche : contexte */}
        <aside className="shrink-0 w-[280px] space-y-5">
          <Link
            href={`/brand/${kitId}/campaigns`}
            className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[--text-muted] hover:text-foreground"
          >
            <ArrowLeft size={12} /> All campaigns
          </Link>

          <div className="space-y-1">
            <StatusBadge status={campaign.status} />
            <h2 className="font-display text-base font-semibold text-foreground">
              {campaign.title}
            </h2>
            {campaign.description && (
              <p className="font-body text-xs text-[--text-muted] leading-relaxed">
                {campaign.description}
              </p>
            )}
          </div>

          <SectionLabel>Prompt</SectionLabel>
          <p className="font-mono text-[11px] text-[--text-muted] italic leading-relaxed whitespace-pre-wrap">
            {campaign.prompt}
          </p>

          {campaign.product_id && (
            <>
              <SectionLabel>Product</SectionLabel>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2">
                <Package size={14} className="text-[--text-muted]" />
                <span className="font-body text-xs text-foreground truncate">
                  Linked product
                </span>
              </div>
            </>
          )}

          {campaign.asset_ids.length > 0 && (
            <>
              <SectionLabel>Source assets</SectionLabel>
              <p className="font-mono text-[10px] text-[--text-muted]">
                {campaign.asset_ids.length} attached
              </p>
            </>
          )}

          <SectionLabel>Format</SectionLabel>
          <span className="inline-block rounded-md bg-muted border border-border px-2 py-0.5 font-mono text-[11px] text-foreground">
            {campaign.aspect_ratio}
          </span>
        </aside>

        {/* Zone principale : galerie horizontale */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-display text-sm font-semibold text-foreground">
              Creatives <span className="font-mono text-[11px] text-[--text-muted] ml-1">({creatives.length})</span>
            </h3>
            {campaign.status === 'generating' && (
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-blue-600">
                <Loader2 size={11} className="animate-spin" />
                Generating…
              </span>
            )}
          </div>

          {creatives.length === 0 && campaign.status !== 'generating' ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center max-w-xl">
              <p className="font-body text-sm text-[--text-muted]">
                No creatives yet. {campaign.status === 'error' && 'The pipeline failed — try recreating the campaign.'}
              </p>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
              {creatives.map((c) => (
                <CreativeGalleryCard
                  key={c.id}
                  creative={c}
                  aspectRatio={campaign.aspect_ratio}
                  editHref={`/brand/${kitId}/campaigns/${campaignId}/${c.id}`}
                  onToggleBlock={(block, visible) => void handleToggleBlock(c, block, visible)}
                  onAnimate={() => void handleAnimate(c.id)}
                  onShare={() => void handleShare(c.id)}
                  onDelete={() => void handleDelete(c.id)}
                  animating={animatingId === c.id}
                />
              ))}

              {/* Add Creative button — toujours en bout de galerie */}
              <button
                type="button"
                onClick={handleAddCreative}
                disabled={addingCreative || campaign.status === 'generating'}
                className={cn(
                  'shrink-0 w-[270px] h-[480px] rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-[--text-muted] hover:text-foreground hover:border-foreground/40 transition-colors',
                  (addingCreative || campaign.status === 'generating') && 'opacity-50 cursor-not-allowed',
                )}
              >
                {addingCreative ? (
                  <>
                    <Loader2 size={24} className="animate-spin" />
                    <span className="font-mono text-[11px]">Generating…</span>
                  </>
                ) : (
                  <>
                    <Plus size={24} />
                    <span className="font-mono text-[11px]">Add creative</span>
                    <span className="font-mono text-[9px] text-[--text-muted]">~15 s · 1 credit</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </BrandKitLayout>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[10px] uppercase tracking-wider text-[--text-muted]">{children}</p>
}

function StatusBadge({ status }: { status: BrandCampaign['status'] }) {
  const map: Record<BrandCampaign['status'], { label: string; cls: string }> = {
    draft:      { label: 'Draft',      cls: 'text-[--text-muted] bg-muted'    },
    generating: { label: 'Generating', cls: 'text-blue-700 bg-blue-100'        },
    done:       { label: 'Ready',      cls: 'text-emerald-700 bg-emerald-100'  },
    error:      { label: 'Error',      cls: 'text-error bg-error/10'           },
  }
  const m = map[status]
  return (
    <span className={cn('inline-block rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider', m.cls)}>
      {m.label}
    </span>
  )
}
