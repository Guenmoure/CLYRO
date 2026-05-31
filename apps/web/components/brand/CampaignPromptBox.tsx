'use client'

import { useState } from 'react'
import { Sparkles, Loader2, Package, ImageIcon, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CampaignAspectRatio, BrandCatalogItem, BrandMediaItem } from '@/lib/api'

interface CampaignPromptBoxProps {
  /** Catalog disponible (pour le bouton Product). */
  products: BrandCatalogItem[]
  /** Médiathèque disponible (pour le bouton Images). */
  assets: BrandMediaItem[]
  /** Prompt courant — pilotable depuis le parent pour permettre le prefill
   *  depuis une suggestion. */
  prompt: string
  onPromptChange: (next: string) => void
  /** Lance la génération. Reçoit le payload prêt à envoyer à l'API. */
  onGenerate: (payload: {
    prompt:       string
    product_id?:  string
    asset_ids:    string[]
    aspect_ratio: CampaignAspectRatio
  }) => Promise<void> | void
  submitting?: boolean
}

const ASPECT_RATIOS: { value: CampaignAspectRatio; label: string }[] = [
  { value: '9:16', label: 'Story (9:16)'  },
  { value: '1:1',  label: 'Square (1:1)'  },
  { value: '4:5',  label: 'Feed (4:5)'    },
]

const MIN_PROMPT_LEN = 10
const MAX_PROMPT_LEN = 3000
const MAX_ASSETS_PER_CAMPAIGN = 6

export function CampaignPromptBox({ products, assets, prompt, onPromptChange, onGenerate, submitting }: CampaignPromptBoxProps) {
  const [productId, setProductId] = useState<string | undefined>(undefined)
  const [assetIds, setAssetIds] = useState<string[]>([])
  const [aspectRatio, setAspectRatio] = useState<CampaignAspectRatio>('9:16')
  const [productMenuOpen, setProductMenuOpen] = useState(false)
  const [assetMenuOpen, setAssetMenuOpen] = useState(false)

  const trimmed = prompt.trim()
  const valid = trimmed.length >= MIN_PROMPT_LEN && trimmed.length <= MAX_PROMPT_LEN

  function toggleAsset(id: string) {
    setAssetIds((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id)
      if (cur.length >= MAX_ASSETS_PER_CAMPAIGN) return cur
      return [...cur, id]
    })
  }

  async function handleSubmit() {
    if (!valid || submitting) return
    await onGenerate({
      prompt: trimmed,
      product_id: productId,
      asset_ids: assetIds,
      aspect_ratio: aspectRatio,
    })
  }

  const product = productId ? products.find((p) => p.id === productId) ?? null : null

  return (
    <div className="relative rounded-2xl border border-border bg-card shadow-sm overflow-visible">
      <textarea
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value.slice(0, MAX_PROMPT_LEN))}
        placeholder="Describe the campaign you want to create…"
        rows={4}
        disabled={submitting}
        className="w-full px-5 py-4 bg-transparent outline-none resize-none font-body text-sm text-foreground placeholder-[--text-muted] leading-relaxed"
      />

      <div className="flex flex-wrap items-center gap-2 px-5 pb-3 border-t border-border/60 pt-3">
        {/* Product */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setProductMenuOpen((o) => !o); setAssetMenuOpen(false) }}
            disabled={submitting || products.length === 0}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition-colors',
              product ? 'border-foreground/40 bg-muted text-foreground' : 'border-border bg-background text-[--text-muted] hover:text-foreground',
              (submitting || products.length === 0) && 'opacity-50 cursor-not-allowed',
            )}
          >
            <Package size={12} />
            {product ? product.name.slice(0, 24) : products.length === 0 ? 'No products' : 'Product'}
            <ChevronDown size={10} />
          </button>
          {productMenuOpen && products.length > 0 && (
            <div className="absolute left-0 top-full mt-1 z-20 w-64 rounded-xl border border-border bg-card shadow-lg max-h-72 overflow-y-auto">
              <button type="button" onClick={() => { setProductId(undefined); setProductMenuOpen(false) }}
                className="block w-full text-left px-3 py-2 font-mono text-[11px] text-[--text-muted] hover:bg-muted">
                — None —
              </button>
              {products.map((p) => (
                <button key={p.id} type="button"
                  onClick={() => { setProductId(p.id); setProductMenuOpen(false) }}
                  className={cn(
                    'flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-muted',
                    p.id === productId && 'bg-muted',
                  )}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image_url} alt="" className="w-8 h-8 rounded-md object-cover border border-border" />
                  <span className="font-body text-xs text-foreground truncate">{p.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Images */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setAssetMenuOpen((o) => !o); setProductMenuOpen(false) }}
            disabled={submitting || assets.length === 0}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition-colors',
              assetIds.length > 0 ? 'border-foreground/40 bg-muted text-foreground' : 'border-border bg-background text-[--text-muted] hover:text-foreground',
              (submitting || assets.length === 0) && 'opacity-50 cursor-not-allowed',
            )}
          >
            <ImageIcon size={12} />
            {assetIds.length > 0 ? `Images (${assetIds.length}/${MAX_ASSETS_PER_CAMPAIGN})` : assets.length === 0 ? 'No assets' : 'Images'}
            <ChevronDown size={10} />
          </button>
          {assetMenuOpen && assets.length > 0 && (
            <div className="absolute left-0 top-full mt-1 z-20 w-72 rounded-xl border border-border bg-card shadow-lg max-h-72 overflow-y-auto p-2 grid grid-cols-3 gap-2">
              {assets.map((a) => {
                const selected = assetIds.includes(a.id)
                return (
                  <button key={a.id} type="button" onClick={() => toggleAsset(a.id)}
                    className={cn(
                      'relative aspect-square rounded-md overflow-hidden border-2 transition-colors',
                      selected ? 'border-[#c45b3a]' : 'border-transparent hover:border-border',
                    )}>
                    {a.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.url} alt="" className="w-full h-full object-cover" />
                    )}
                    {selected && (
                      <span className="absolute top-1 right-1 rounded-full bg-[#c45b3a] text-background text-[9px] w-4 h-4 flex items-center justify-center">
                        {assetIds.indexOf(a.id) + 1}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Aspect ratio */}
        <select
          value={aspectRatio}
          onChange={(e) => setAspectRatio(e.target.value as CampaignAspectRatio)}
          disabled={submitting}
          aria-label="Aspect ratio"
          className="rounded-lg border border-border bg-background px-2 py-1.5 font-mono text-[11px] text-foreground outline-none disabled:opacity-50"
        >
          {ASPECT_RATIOS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>

        <span className="flex-1" aria-hidden="true" />

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!valid || submitting}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg bg-foreground text-background px-3 py-1.5 font-display text-xs font-medium',
            (!valid || submitting) && 'opacity-50 cursor-not-allowed',
          )}
        >
          {submitting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          Generate
        </button>
      </div>
    </div>
  )
}
