'use client'

/**
 * Brand Catalog — Phase 2 du portage Pomelli.
 *
 * Grille des produits attachés à un Brand Kit, avec deux entrées de
 * création : « Add from URL » (scrape e-commerce, draft à confirmer) et
 * « Add from scratch » (formulaire vide). Suppression via menu contextuel
 * sur chaque carte.
 */

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, Plus, Link2, AlertCircle } from 'lucide-react'
import { BrandKitLayout } from '@/components/brand/BrandKitLayout'
import { ProductCard } from '@/components/brand/ProductCard'
import { AddFromUrlModal } from '@/components/brand/AddFromUrlModal'
import { toast } from '@/components/ui/toast'
import { useLanguage } from '@/lib/i18n'
import {
  getBrandKit,
  listBrandCatalog,
  createBrandCatalogItem,
  scrapeBrandCatalogFromUrl,
  deleteBrandCatalogItem,
  type BrandCatalogItem,
  type CatalogScrapeDraft,
} from '@/lib/api'
import type { BrandKit } from '@clyro/shared'
import { cn } from '@/lib/utils'

export default function BrandCatalogPage() {
  const params = useParams<{ kitId: string }>()
  const kitId = params?.kitId ?? ''
  const { t } = useLanguage()

  const [kit, setKit] = useState<BrandKit | null>(null)
  const [items, setItems] = useState<BrandCatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [urlModalOpen, setUrlModalOpen] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)

  useEffect(() => {
    if (!kitId) return
    setLoading(true)
    setError(null)
    Promise.all([getBrandKit(kitId), listBrandCatalog(kitId)])
      .then(([k, c]) => {
        setKit(k.data)
        setItems(c.data)
      })
      .catch(() => setError(t('errorOccurred')))
      .finally(() => setLoading(false))
  }, [kitId])

  async function handleDelete(itemId: string) {
    const previous = items
    setItems(items.filter((i) => i.id !== itemId))
    try {
      await deleteBrandCatalogItem(itemId)
    } catch {
      setItems(previous)
      toast.error(t('bk_deleteFailed'))
    }
  }

  async function handleScrapeAndConfirm(draft: CatalogScrapeDraft) {
    const res = await createBrandCatalogItem({
      brand_kit_id: kitId,
      name:         draft.name,
      image_url:    draft.image_url,
      description:  draft.description,
    })
    setItems([res.data, ...items])
  }

  async function handleManualCreate(input: { name: string; image_url: string; description?: string; category?: string }) {
    const res = await createBrandCatalogItem({
      brand_kit_id: kitId,
      ...input,
    })
    setItems([res.data, ...items])
    setManualOpen(false)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const header = (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => setUrlModalOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 font-display text-xs text-foreground hover:bg-muted transition-colors"
      >
        <Link2 size={14} />
        {t('bk_cat_addFromUrl')}
      </button>
      <button
        type="button"
        onClick={() => setManualOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-foreground text-background px-3 py-1.5 font-display text-xs font-medium"
      >
        <Plus size={14} />
        {t('bk_cat_addManual')}
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
          <p className="font-body text-sm text-[--text-muted]">{error === 'error' ? t('bk_failedLoad') : error}</p>
        </div>
      )}
      {!loading && !error && (
        <>
          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center max-w-xl mx-auto">
              <h3 className="font-display text-lg font-semibold text-foreground">{t('bk_cat_emptyTitle')}</h3>
              <p className="font-body text-sm text-[--text-muted] mt-1">
                {t('bk_cat_emptyDesc')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map((item) => (
                <ProductCard
                  key={item.id}
                  id={item.id}
                  name={item.name}
                  imageUrl={item.image_url}
                  description={item.description}
                  category={item.category}
                  onDelete={() => void handleDelete(item.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* From URL modal */}
      <AddFromUrlModal<CatalogScrapeDraft>
        open={urlModalOpen}
        onClose={() => setUrlModalOpen(false)}
        onScrape={async (url) => {
          const res = await scrapeBrandCatalogFromUrl({ brand_kit_id: kitId, url })
          return res.data
        }}
        onConfirm={handleScrapeAndConfirm}
        title={t('bk_cat_urlModalTitle')}
        placeholder="https://shop.example.com/products/..."
        renderPreview={(draft, setDraft) => (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={draft.image_url} alt={draft.name} className="w-full max-h-56 object-contain rounded-xl border border-border bg-muted" />
            <div className="space-y-2">
              <label className="font-mono text-[10px] uppercase tracking-wider text-[--text-muted]">{t('bk_name')}</label>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                maxLength={120}
                className="w-full rounded-xl border border-border bg-muted px-3 py-2 font-body text-sm text-foreground outline-none focus:border-brand/60"
              />
            </div>
            <div className="space-y-2">
              <label className="font-mono text-[10px] uppercase tracking-wider text-[--text-muted]">{t('bk_description')}</label>
              <textarea
                value={draft.description ?? ''}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={3}
                maxLength={500}
                className="w-full rounded-xl border border-border bg-muted px-3 py-2 font-body text-sm text-foreground outline-none focus:border-brand/60 resize-none"
              />
            </div>
          </div>
        )}
      />

      {/* From scratch modal */}
      {manualOpen && (
        <ManualCreateModal
          onClose={() => setManualOpen(false)}
          onCreate={handleManualCreate}
        />
      )}
    </BrandKitLayout>
  )
}

// ── Inline manual modal ─────────────────────────────────────────────────────

function ManualCreateModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (input: { name: string; image_url: string; description?: string; category?: string }) => Promise<void>
}) {
  const { t } = useLanguage()
  const [name, setName] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const valid = name.trim().length > 0 && /^https?:\/\//.test(imageUrl)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl">
        <div className="border-b border-border px-5 py-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-foreground">{t('bk_cat_manualTitle')}</h3>
          <button type="button" onClick={onClose} className="text-[--text-muted] hover:text-foreground font-mono text-xs">{t('close')}</button>
        </div>
        <div className="p-5 space-y-3">
          <Field label={t('bk_cat_nameRequired')}>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={120}
              className="w-full rounded-xl border border-border bg-muted px-3 py-2 font-body text-sm text-foreground outline-none focus:border-brand/60" />
          </Field>
          <Field label={t('bk_cat_imageUrlRequired')}>
            <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..."
              className="w-full rounded-xl border border-border bg-muted px-3 py-2 font-body text-sm text-foreground outline-none focus:border-brand/60" />
          </Field>
          <Field label={t('bk_description')}>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500}
              className="w-full rounded-xl border border-border bg-muted px-3 py-2 font-body text-sm text-foreground outline-none focus:border-brand/60 resize-none" />
          </Field>
          <Field label={t('bk_cat_category')}>
            <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={80}
              className="w-full rounded-xl border border-border bg-muted px-3 py-2 font-body text-sm text-foreground outline-none focus:border-brand/60" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="font-mono text-xs text-[--text-muted] px-3 py-1.5">{t('cancel')}</button>
            <button
              type="button"
              disabled={!valid || submitting}
              onClick={async () => {
                setSubmitting(true)
                try {
                  await onCreate({
                    name: name.trim(),
                    image_url: imageUrl.trim(),
                    description: description.trim() || undefined,
                    category: category.trim() || undefined,
                  })
                } catch (err) {
                  toast.error(t('bk_cat_addFailed'))
                } finally {
                  setSubmitting(false)
                }
              }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg bg-foreground text-background font-display text-xs font-medium px-3 py-1.5',
                (!valid || submitting) && 'opacity-50 cursor-not-allowed',
              )}
            >
              {submitting && <Loader2 size={12} className="animate-spin" />}
              {t('bk_cat_addProduct')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="font-mono text-[10px] uppercase tracking-wider text-[--text-muted]">{label}</label>
      {children}
    </div>
  )
}
