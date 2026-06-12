'use client'

/**
 * Brand Campaigns — Phase 3.2 du portage Pomelli.
 *
 * Page liste avec :
 *   - Prompt box centrale (CampaignPromptBox) — textarea + product + assets
 *     + aspect ratio + Generate.
 *   - 3 suggestions auto-générées depuis le Business DNA. Cachées en
 *     sessionStorage par kitId pour ne pas re-facturer Claude à chaque
 *     visite (le DNA bouge peu en pratique).
 *   - Liste des campagnes existantes en grille, statut visible, polling
 *     toutes les 3 s tant qu'au moins une est en `generating`.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, AlertCircle } from 'lucide-react'
import { BrandKitLayout } from '@/components/brand/BrandKitLayout'
import { CampaignPromptBox } from '@/components/brand/CampaignPromptBox'
import { SuggestionCard } from '@/components/brand/SuggestionCard'
import { CampaignCard } from '@/components/brand/CampaignCard'
import { toast } from '@/components/ui/toast'
import { useLanguage } from '@/lib/i18n'
import {
  getBrandKit,
  listBrandCampaigns,
  createBrandCampaign,
  deleteBrandCampaign,
  suggestBrandCampaigns,
  listBrandCatalog,
  listBrandMedia,
  type BrandCampaign,
  type BrandCatalogItem,
  type BrandMediaItem,
  type CampaignSuggestion,
  type CampaignAspectRatio,
} from '@/lib/api'
import type { BrandKit } from '@clyro/shared'

const SUGGESTIONS_CACHE_KEY = (kitId: string) => `clyro:brand-suggestions:${kitId}`
const POLL_INTERVAL_MS = 3000

export default function BrandCampaignsPage() {
  const params = useParams<{ kitId: string }>()
  const kitId = params?.kitId ?? ''
  const { t } = useLanguage()

  const [kit, setKit] = useState<BrandKit | null>(null)
  const [campaigns, setCampaigns] = useState<BrandCampaign[]>([])
  const [products, setProducts] = useState<BrandCatalogItem[]>([])
  const [assets, setAssets] = useState<BrandMediaItem[]>([])
  const [suggestions, setSuggestions] = useState<CampaignSuggestion[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!kitId) return
    setLoading(true)
    setError(null)
    Promise.all([
      getBrandKit(kitId),
      listBrandCampaigns(kitId),
      listBrandCatalog(kitId),
      listBrandMedia(kitId),
    ])
      .then(([k, c, p, a]) => {
        setKit(k.data)
        setCampaigns(c.data)
        setProducts(p.data)
        setAssets(a.data)
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'error'))
      .finally(() => setLoading(false))
  }, [kitId])

  // ── Suggestions (cached) ──────────────────────────────────────────────────
  useEffect(() => {
    if (!kitId || !kit) return
    // Cache: la suggestion est dérivée du DNA — si l'utilisateur n'a pas
    // touché à son DNA, on évite de re-demander à Claude (~$0.02 / appel).
    try {
      const cached = sessionStorage.getItem(SUGGESTIONS_CACHE_KEY(kitId))
      if (cached) {
        setSuggestions(JSON.parse(cached) as CampaignSuggestion[])
        return
      }
    } catch { /* corrupted cache, ignore */ }

    setSuggestionsLoading(true)
    suggestBrandCampaigns(kitId, 3)
      .then((r) => {
        setSuggestions(r.data)
        try { sessionStorage.setItem(SUGGESTIONS_CACHE_KEY(kitId), JSON.stringify(r.data)) } catch { /* quota */ }
      })
      .catch(() => setSuggestions([]))
      .finally(() => setSuggestionsLoading(false))
  }, [kitId, kit])

  // ── Polling tant qu'au moins une campagne est en generating ────────────────
  const refreshCampaigns = useCallback(async () => {
    try {
      const res = await listBrandCampaigns(kitId)
      setCampaigns(res.data)
    } catch { /* silent */ }
  }, [kitId])

  useEffect(() => {
    const stillGenerating = campaigns.some((c) => c.status === 'generating')
    if (!stillGenerating) {
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = null
      return
    }
    if (pollRef.current) return
    pollRef.current = setInterval(() => { void refreshCampaigns() }, POLL_INTERVAL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [campaigns, refreshCampaigns])

  // ── Actions ───────────────────────────────────────────────────────────────
  async function handleGenerate(payload: {
    prompt: string
    product_id?: string
    asset_ids: string[]
    aspect_ratio: CampaignAspectRatio
  }) {
    setSubmitting(true)
    try {
      const res = await createBrandCampaign({
        brand_kit_id: kitId,
        prompt: payload.prompt,
        product_id: payload.product_id,
        asset_ids: payload.asset_ids,
        aspect_ratio: payload.aspect_ratio,
      })
      // Insert tout en haut, polling prendra le relais pour le statut
      setCampaigns((cur) => [res.data.campaign, ...cur])
      setPrompt('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('bk_cmp_createFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(campaignId: string) {
    const previous = campaigns
    setCampaigns(campaigns.filter((c) => c.id !== campaignId))
    try {
      await deleteBrandCampaign(campaignId)
    } catch {
      setCampaigns(previous)
      toast.error(t('bk_deleteFailed'))
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

  if (error) {
    return (
      <BrandKitLayout kitId={kitId}>
        <div className="flex flex-col items-center gap-2 py-20">
          <AlertCircle size={24} className="text-error" />
          <p className="font-body text-sm text-[--text-muted]">{error === 'error' ? t('bk_failedLoad') : error}</p>
        </div>
      </BrandKitLayout>
    )
  }

  return (
    <BrandKitLayout kitId={kitId} kitName={kit?.name}>
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Prompt box centrale */}
        <section>
          <h2 className="font-display text-lg font-semibold text-foreground mb-1">{t('bk_cmp_title')}</h2>
          <p className="font-body text-sm text-[--text-muted] mb-4">
            {t('bk_cmp_sub')}
          </p>
          <CampaignPromptBox
            products={products}
            assets={assets}
            prompt={prompt}
            onPromptChange={setPrompt}
            onGenerate={handleGenerate}
            submitting={submitting}
          />
          <p className="mt-2 font-mono text-[10px] text-[--text-muted]">
            {t('bk_cmp_disclaimer')}
          </p>
        </section>

        {/* Suggestions DNA */}
        <section>
          <h3 className="font-display text-sm font-semibold text-foreground mb-3">
            {t('bk_cmp_suggestionsTitle')}
          </h3>
          {suggestionsLoading ? (
            <div className="flex items-center gap-2 py-4 text-[--text-muted]">
              <Loader2 size={14} className="animate-spin" />
              <span className="font-body text-xs">{t('bk_cmp_suggestionsLoading')}</span>
            </div>
          ) : suggestions.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {suggestions.map((s, i) => (
                <SuggestionCard
                  key={`${s.title}-${i}`}
                  title={s.title}
                  description={s.description}
                  onUse={() => setPrompt(s.prompt)}
                />
              ))}
            </div>
          ) : (
            <p className="font-body text-xs text-[--text-muted]">
              {t('bk_cmp_suggestionsEmpty')}
            </p>
          )}
        </section>

        {/* Liste des campagnes */}
        <section>
          <h3 className="font-display text-sm font-semibold text-foreground mb-3">
            {t('bk_cmp_yours')}
          </h3>
          {campaigns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center max-w-xl mx-auto">
              <p className="font-body text-sm text-[--text-muted]">{t('bk_cmp_empty')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {campaigns.map((c) => (
                <CampaignCard
                  key={c.id}
                  campaign={c}
                  kitId={kitId}
                  onDelete={() => void handleDelete(c.id)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </BrandKitLayout>
  )
}
