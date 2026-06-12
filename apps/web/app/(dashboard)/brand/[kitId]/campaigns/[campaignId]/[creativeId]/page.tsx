'use client'

/**
 * Creative Editor — Phase 3.4 V2.
 *
 * Évolutions vs V1 :
 *   - Drag pixel-precise du text overlay (DraggableBlock).
 *   - Sliders de taille de police par bloc (block_sizes).
 *   - Génération de variantes de CTA via Claude (popover sous le CTA).
 *   - Swap d'image depuis la médiathèque (popover sous le bloc Image).
 *
 * Reste pour V2.5 : régénération d'image via prompt edit, Fix Layout via
 * Claude vision, Download canvas haute résolution.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, AlertCircle, Eye, EyeOff, Check, Save, History, Palette,
  Sparkles, ImageIcon as ImageIconLucide, X, Download, Wand2, Pencil,
} from 'lucide-react'
import { BrandKitLayout } from '@/components/brand/BrandKitLayout'
import { DraggableBlock } from '@/components/brand/DraggableBlock'
import { cn } from '@/lib/utils'
import { toast } from '@/components/ui/toast'
import { useLanguage } from '@/lib/i18n'
import {
  getBrandCreative,
  getBrandKit,
  updateBrandCreative,
  listBrandCreativeVersions,
  saveBrandCreativeVersion,
  restoreBrandCreativeVersion,
  generateCtaVariants,
  regenerateBrandCreativeImage,
  fixBrandCreativeLayout,
  listBrandMedia,
  type BrandCreative,
  type BrandCampaign,
  type BrandCreativeVersion,
  type BrandMediaItem,
} from '@/lib/api'
import type {
  BrandKit, CreativeBlocksVisible, CampaignAspectRatio,
  CreativeBlockPositions, CreativeBlockSizes, BlockPosition,
} from '@clyro/shared'
import { downloadCreativeAsPng } from '@/lib/canvas-creative'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const DEBOUNCE_MS = 1500

const ASPECT_PREVIEW: Record<CampaignAspectRatio, { width: number; height: number }> = {
  '9:16': { width: 360, height: 640 },
  '1:1':  { width: 480, height: 480 },
  '4:5':  { width: 432, height: 540 },
}

const DEFAULT_POSITIONS: CreativeBlockPositions = {
  header:      { x: 50, y: 12 },
  description: { x: 50, y: 50 },
  cta:         { x: 50, y: 90 },
}

const DEFAULT_SIZES: CreativeBlockSizes = { header: 1, description: 1, cta: 1 }

/** Tailles de base en px par bloc, multipliées ensuite par block_sizes. */
const BASE_FONT_PX = { header: 22, description: 14, cta: 14 }

/** Style inline pour un bloc texte overlay. La couleur peut être surchargée
 *  par Fix Layout V3 ('white' | 'black') ; sans surcharge on garde le blanc
 *  historique. Le shadow s'inverse aussi pour rester lisible. */
function textOverlayStyle(color: 'white' | 'black' | undefined, fontPx: number): React.CSSProperties {
  const c = color === 'black' ? '#000' : '#fff'
  const shadow = color === 'black'
    ? '0 1px 3px rgba(255, 255, 255, 0.6)'
    : '0 2px 4px rgba(0, 0, 0, 0.7)'
  return {
    color:      c,
    fontSize:   `${fontPx}px`,
    textShadow: shadow,
  }
}

export default function CreativeEditorPage() {
  const params = useParams<{ kitId: string; campaignId: string; creativeId: string }>()
  const kitId       = params?.kitId       ?? ''
  const campaignId  = params?.campaignId  ?? ''
  const creativeId  = params?.creativeId  ?? ''
  const { t } = useLanguage()

  const [kit, setKit] = useState<BrandKit | null>(null)
  const [campaign, setCampaign] = useState<BrandCampaign | null>(null)
  const [creative, setCreative] = useState<BrandCreative | null>(null)
  const [versions, setVersions] = useState<BrandCreativeVersion[]>([])
  const [media, setMedia] = useState<BrandMediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [savingVersion, setSavingVersion] = useState(false)
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null)
  const [ctaPopoverOpen, setCtaPopoverOpen] = useState(false)
  const [ctaVariants, setCtaVariants] = useState<string[]>([])
  const [ctaLoading, setCtaLoading] = useState(false)
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false)
  const [editPromptOpen, setEditPromptOpen] = useState(false)
  const [regenLoading, setRegenLoading] = useState(false)
  const [fixLayoutLoading, setFixLayoutLoading] = useState(false)
  const [downloadLoading, setDownloadLoading] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!creativeId || !kitId) return
    setLoading(true)
    setError(null)
    Promise.all([
      getBrandCreative(creativeId),
      getBrandKit(kitId),
      listBrandCreativeVersions(creativeId),
    ])
      .then(([cr, k, v]) => {
        setCreative(cr.data.creative)
        setCampaign(cr.data.campaign)
        setKit(k.data)
        setVersions(v.data)
        // Lazy-load media list pour le swap (séparé pour ne pas retarder le load principal)
        listBrandMedia(kitId).then((m) => setMedia(m.data)).catch(() => null)
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'error'))
      .finally(() => setLoading(false))
  }, [creativeId, kitId])

  // ── Patch + debounced save ────────────────────────────────────────────────
  const patchCreative = useCallback((patch: Partial<BrandCreative>) => {
    if (!creative) return
    const next = { ...creative, ...patch }
    setCreative(next)
    scheduleSave(patch)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creative])

  function scheduleSave(patch: Partial<BrandCreative>) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSaveState('saving')
    debounceRef.current = setTimeout(async () => {
      try {
        const payload: Parameters<typeof updateBrandCreative>[1] = {}
        if ('header_text'      in patch) payload.header_text      = patch.header_text
        if ('description_text' in patch) payload.description_text = patch.description_text
        if ('cta_text'         in patch) payload.cta_text         = patch.cta_text
        if ('blocks_visible'   in patch) payload.blocks_visible   = patch.blocks_visible
        if ('block_positions'  in patch) payload.block_positions  = patch.block_positions
        if ('block_sizes'      in patch) payload.block_sizes      = patch.block_sizes
        if ('image_url'        in patch) payload.image_url        = patch.image_url
        const res = await updateBrandCreative(creativeId, payload)
        setCreative(res.data)
        setSaveState('saved')
      } catch {
        setSaveState('error')
      }
    }, DEBOUNCE_MS)
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  function toggleBlock(block: keyof CreativeBlocksVisible) {
    if (!creative) return
    const nextBlocks = { ...creative.blocks_visible, [block]: !creative.blocks_visible[block] }
    patchCreative({ blocks_visible: nextBlocks })
  }

  function moveBlock(block: keyof CreativeBlocksVisible, next: BlockPosition) {
    if (!creative) return
    const current = creative.block_positions ?? DEFAULT_POSITIONS
    const positions: CreativeBlockPositions = { ...current, [block]: next }
    // Mise à jour visuelle immédiate sans schedule pendant le drag
    setCreative({ ...creative, block_positions: positions })
  }

  function commitBlockMove() {
    if (!creative) return
    const positions = creative.block_positions ?? DEFAULT_POSITIONS
    scheduleSave({ block_positions: positions })
  }

  function setBlockSize(block: keyof CreativeBlockSizes, value: number) {
    if (!creative) return
    const current = creative.block_sizes ?? DEFAULT_SIZES
    const sizes: CreativeBlockSizes = { ...current, [block]: value }
    patchCreative({ block_sizes: sizes })
  }

  async function handleSaveVersion() {
    if (savingVersion) return
    setSavingVersion(true)
    try {
      const res = await saveBrandCreativeVersion(creativeId)
      setVersions((cur) => [res.data, ...cur])
      if (creative) setCreative({ ...creative, current_version: res.data.version_num })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('bk_ce_saveVersionFailed'))
    } finally {
      setSavingVersion(false)
    }
  }

  async function handleRestore(versionNum: number) {
    if (restoringVersion !== null) return
    setRestoringVersion(versionNum)
    try {
      const res = await restoreBrandCreativeVersion(creativeId, versionNum)
      setCreative(res.data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('bk_ce_restoreFailed'))
    } finally {
      setRestoringVersion(null)
    }
  }

  async function handleGenerateCta() {
    if (ctaLoading) return
    setCtaLoading(true)
    setCtaVariants([])
    setCtaPopoverOpen(true)
    try {
      const res = await generateCtaVariants(creativeId)
      setCtaVariants(res.data)
    } catch {
      setCtaVariants([])
    } finally {
      setCtaLoading(false)
    }
  }

  function pickCtaVariant(text: string) {
    patchCreative({ cta_text: text })
    setCtaPopoverOpen(false)
  }

  function pickMedia(url: string) {
    patchCreative({ image_url: url })
    setMediaPickerOpen(false)
  }

  async function handleRegenerateImage(prompt: string) {
    if (regenLoading) return
    setRegenLoading(true)
    try {
      const res = await regenerateBrandCreativeImage(creativeId, prompt)
      setCreative(res.data)
      setEditPromptOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('bk_ce_regenFailed'))
    } finally {
      setRegenLoading(false)
    }
  }

  async function handleFixLayout() {
    if (fixLayoutLoading) return
    setFixLayoutLoading(true)
    try {
      const res = await fixBrandCreativeLayout(creativeId)
      setCreative(res.data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('bk_ce_fixLayoutFailed'))
    } finally {
      setFixLayoutLoading(false)
    }
  }

  async function handleDownload() {
    if (downloadLoading || !creative || !campaign) return
    setDownloadLoading(true)
    try {
      const previewWidth = ASPECT_PREVIEW[campaign.aspect_ratio].width
      const safeTitle = campaign.title.replace(/[^a-z0-9-]+/gi, '_').slice(0, 40) || 'creative'
      await downloadCreativeAsPng({
        creative,
        aspectRatio: campaign.aspect_ratio,
        positions:   positions,
        sizes:       sizes,
        baseFontPx:  BASE_FONT_PX,
        previewWidth,
        filename:    `${safeTitle}-v${creative.current_version}.png`,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('bk_ce_downloadFailed'))
    } finally {
      setDownloadLoading(false)
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
  if (error || !creative || !campaign) {
    return (
      <BrandKitLayout kitId={kitId}>
        <div className="flex flex-col items-center gap-3 py-20">
          <AlertCircle size={24} className="text-error" />
          <p className="font-body text-sm text-[--text-muted]">
            {error && error !== 'error' ? error : t('bk_ce_notFound')}
          </p>
          <Link href={`/brand/${kitId}/campaigns/${campaignId}`} className="font-mono text-xs text-foreground underline">
            ← {t('bk_ce_back')}
          </Link>
        </div>
      </BrandKitLayout>
    )
  }

  const saveStatus = (
    <span className="inline-flex items-center gap-1.5">
      {saveState === 'saving' && (<><Loader2 size={11} className="animate-spin" /> {t('saving')}</>)}
      {saveState === 'saved'  && (<><Check    size={11} className="text-emerald-600" /> {t('bk_ce_saved')}</>)}
      {saveState === 'error'  && (<><AlertCircle size={11} className="text-error" /> {t('bk_ce_saveFailedShort')}</>)}
    </span>
  )

  const sizes     = creative.block_sizes     ?? DEFAULT_SIZES
  const positions = creative.block_positions ?? DEFAULT_POSITIONS

  return (
    <BrandKitLayout kitId={kitId} kitName={campaign.title} saveStatus={saveStatus}>
      <div className="space-y-4">
        {/* Header bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Link
            href={`/brand/${kitId}/campaigns/${campaignId}`}
            className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[--text-muted] hover:text-foreground"
          >
            <ArrowLeft size={12} /> {t('bk_ce_backTo').replace('{name}', campaign.title.slice(0, 40))}
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[--text-muted]">
              v{creative.current_version}
            </span>
            <button
              type="button"
              onClick={handleFixLayout}
              disabled={fixLayoutLoading}
              title={t('bk_ce_fixLayoutTitle')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 font-display text-xs text-foreground hover:bg-muted',
                fixLayoutLoading && 'opacity-50 cursor-not-allowed',
              )}
            >
              {fixLayoutLoading ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
              {t('bk_ce_fixLayout')}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloadLoading}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 font-display text-xs text-foreground hover:bg-muted',
                downloadLoading && 'opacity-50 cursor-not-allowed',
              )}
            >
              {downloadLoading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              {t('bk_download')}
            </button>
            <button
              type="button"
              onClick={handleSaveVersion}
              disabled={savingVersion}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 font-display text-xs text-foreground hover:bg-muted',
                savingVersion && 'opacity-50 cursor-not-allowed',
              )}
            >
              {savingVersion ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {t('bk_ce_saveVersion')}
            </button>
          </div>
        </div>

        {/* 3-column layout */}
        <div className="grid grid-cols-12 gap-5">
          {/* Preview — col 1-6 */}
          <section className="col-span-12 lg:col-span-6 flex items-start justify-center">
            <InteractivePreview
              creative={creative}
              aspectRatio={campaign.aspect_ratio}
              positions={positions}
              sizes={sizes}
              onMove={moveBlock}
              onCommit={commitBlockMove}
            />
          </section>

          {/* Block editor — col 7-9 */}
          <section className="col-span-12 md:col-span-7 lg:col-span-4 space-y-3">
            <BlockSection title={t('bk_ce_imageTitle')} hint={t('bk_ce_imageHint')}>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted p-2 relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={creative.image_url} alt="" className="w-16 h-16 rounded-lg object-cover border border-border" />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] text-[--text-muted] truncate" title={creative.prompt ?? ''}>
                    {creative.prompt ?? t('bk_ce_noPrompt')}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setMediaPickerOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[10px] text-foreground hover:bg-muted"
                    >
                      <ImageIconLucide size={11} /> {t('bk_ce_swap')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditPromptOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[10px] text-foreground hover:bg-muted"
                    >
                      <Pencil size={11} /> {t('bk_ce_editPrompt')}
                    </button>
                  </div>
                </div>
              </div>
            </BlockSection>

            <BlockSection
              title={t('bk_ce_headerTitle')}
              hint={t('bk_ce_headerHint')}
              toggle={{ on: creative.blocks_visible.header, onClick: () => toggleBlock('header') }}
              size={sizes.header}
              onSizeChange={(v) => setBlockSize('header', v)}
            >
              <input
                type="text"
                value={creative.header_text ?? ''}
                onChange={(e) => patchCreative({ header_text: e.target.value })}
                placeholder={t('bk_ce_headerPlaceholder')}
                maxLength={200}
                className="w-full rounded-xl border border-border bg-muted px-3 py-2 font-body text-sm text-foreground outline-none focus:border-blue-500/60"
              />
            </BlockSection>

            <BlockSection
              title={t('bk_ce_descTitle')}
              hint={t('bk_ce_descHint')}
              toggle={{ on: creative.blocks_visible.description, onClick: () => toggleBlock('description') }}
              size={sizes.description}
              onSizeChange={(v) => setBlockSize('description', v)}
            >
              <textarea
                value={creative.description_text ?? ''}
                onChange={(e) => patchCreative({ description_text: e.target.value })}
                rows={3}
                maxLength={500}
                placeholder={t('bk_ce_descPlaceholder')}
                className="w-full rounded-xl border border-border bg-muted px-3 py-2 font-body text-sm text-foreground outline-none focus:border-blue-500/60 resize-none"
              />
            </BlockSection>

            <BlockSection
              title={t('bk_ce_ctaTitle')}
              hint={t('bk_ce_ctaHint')}
              toggle={{ on: creative.blocks_visible.cta, onClick: () => toggleBlock('cta') }}
              size={sizes.cta}
              onSizeChange={(v) => setBlockSize('cta', v)}
            >
              <div className="relative">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={creative.cta_text ?? ''}
                    onChange={(e) => patchCreative({ cta_text: e.target.value })}
                    placeholder={t('bk_ce_ctaPlaceholder')}
                    maxLength={60}
                    className="flex-1 rounded-xl border border-border bg-muted px-3 py-2 font-body text-sm text-foreground outline-none focus:border-blue-500/60"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateCta}
                    disabled={ctaLoading}
                    className={cn(
                      'shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-foreground text-background px-3 font-display text-xs font-medium',
                      ctaLoading && 'opacity-50 cursor-not-allowed',
                    )}
                  >
                    {ctaLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    {t('bk_generate')}
                  </button>
                </div>
                {ctaPopoverOpen && (
                  <CtaVariantsPopover
                    loading={ctaLoading}
                    variants={ctaVariants}
                    onPick={pickCtaVariant}
                    onClose={() => setCtaPopoverOpen(false)}
                  />
                )}
              </div>
            </BlockSection>
          </section>

          {/* Right panel — col 10-12 */}
          <aside className="col-span-12 md:col-span-5 lg:col-span-2 space-y-4">
            {kit && <DnaQuickRef kit={kit} />}
            <VersionHistory
              versions={versions}
              current={creative.current_version}
              onRestore={(v) => void handleRestore(v)}
              restoring={restoringVersion}
            />
          </aside>
        </div>
      </div>

      {/* Media picker modal */}
      {mediaPickerOpen && (
        <MediaPickerModal
          media={media}
          onPick={pickMedia}
          onClose={() => setMediaPickerOpen(false)}
        />
      )}

      {/* Edit prompt modal */}
      {editPromptOpen && (
        <EditPromptModal
          initial={creative.prompt ?? ''}
          loading={regenLoading}
          onRegenerate={handleRegenerateImage}
          onClose={() => setEditPromptOpen(false)}
        />
      )}
    </BrandKitLayout>
  )
}

// ── Edit prompt modal ──────────────────────────────────────────────────────

function EditPromptModal({
  initial, loading, onRegenerate, onClose,
}: {
  initial:      string
  loading:      boolean
  onRegenerate: (prompt: string) => void | Promise<void>
  onClose:      () => void
}) {
  const { t } = useLanguage()
  const [prompt, setPrompt] = useState(initial)
  const valid = prompt.trim().length >= 10
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="font-display text-base font-semibold text-foreground">{t('bk_ce_editPromptTitle')}</h3>
          <button type="button" onClick={onClose} aria-label={t('close')} disabled={loading} className="text-[--text-muted] hover:text-foreground disabled:opacity-50">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <p className="font-body text-xs text-[--text-muted]">
            {t('bk_ce_editPromptDesc')}
          </p>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value.slice(0, 1500))}
            rows={6}
            disabled={loading}
            placeholder={t('bk_ce_editPromptPlaceholder')}
            className="w-full rounded-xl border border-border bg-muted px-3 py-2 font-body text-sm text-foreground outline-none focus:border-blue-500/60 resize-none"
          />
          <p className="font-mono text-[10px] text-[--text-muted] text-right">
            {t('bk_charCount').replace('{count}', String(prompt.trim().length))}
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={loading} className="font-mono text-xs text-[--text-muted] hover:text-foreground px-3 py-1.5 disabled:opacity-50">
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={() => void onRegenerate(prompt.trim())}
              disabled={!valid || loading}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg bg-foreground text-background font-display text-xs font-medium px-3 py-1.5',
                (!valid || loading) && 'opacity-50 cursor-not-allowed',
              )}
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {t('bk_ce_regenerate')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Interactive preview with draggable blocks ───────────────────────────────

function InteractivePreview({
  creative, aspectRatio, positions, sizes, onMove, onCommit,
}: {
  creative:    BrandCreative
  aspectRatio: CampaignAspectRatio
  positions:   CreativeBlockPositions
  sizes:       CreativeBlockSizes
  onMove:      (block: keyof CreativeBlocksVisible, pos: BlockPosition) => void
  onCommit:    () => void
}) {
  const dim = ASPECT_PREVIEW[aspectRatio]
  const blocks = creative.blocks_visible
  const containerRef = useRef<HTMLDivElement | null>(null)

  return (
    <div
      ref={containerRef}
      className="relative rounded-2xl overflow-hidden border border-border bg-muted shadow-sm"
      style={{ width: dim.width, height: dim.height, maxWidth: '100%' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={creative.image_url} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-foreground/30 via-transparent to-foreground/40 pointer-events-none" />

      {blocks.header && creative.header_text && (
        <DraggableBlock
          position={positions.header}
          containerRef={containerRef}
          onMove={(p) => onMove('header', p)}
          onCommit={onCommit}
        >
          <div
            className="font-display font-semibold leading-tight text-center px-1"
            style={textOverlayStyle(positions.header.color, BASE_FONT_PX.header * sizes.header)}
          >
            {creative.header_text}
          </div>
        </DraggableBlock>
      )}

      {blocks.description && creative.description_text && (
        <DraggableBlock
          position={positions.description}
          containerRef={containerRef}
          onMove={(p) => onMove('description', p)}
          onCommit={onCommit}
        >
          <div
            className="font-display leading-snug text-center px-1"
            style={textOverlayStyle(positions.description.color, BASE_FONT_PX.description * sizes.description)}
          >
            {creative.description_text}
          </div>
        </DraggableBlock>
      )}

      {blocks.cta && creative.cta_text && (
        <DraggableBlock
          position={positions.cta}
          containerRef={containerRef}
          onMove={(p) => onMove('cta', p)}
          onCommit={onCommit}
        >
          <div
            className="font-display font-medium uppercase tracking-widest text-center px-1"
            style={textOverlayStyle(positions.cta.color, BASE_FONT_PX.cta * sizes.cta)}
          >
            {creative.cta_text}
          </div>
        </DraggableBlock>
      )}
    </div>
  )
}

// ── BlockSection avec slider de taille ──────────────────────────────────────

function BlockSection({
  title, hint, toggle, size, onSizeChange, children,
}: {
  title:         string
  hint?:         string
  toggle?:       { on: boolean; onClick: () => void }
  size?:         number
  onSizeChange?: (next: number) => void
  children:      React.ReactNode
}) {
  const { t } = useLanguage()
  return (
    <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-display text-xs font-semibold text-foreground">{title}</h4>
          {hint && <p className="font-mono text-[10px] text-[--text-muted]">{hint}</p>}
        </div>
        {toggle && (
          <button
            type="button"
            onClick={toggle.onClick}
            aria-label={toggle.on ? t('bk_ce_hideBlock') : t('bk_ce_showBlock')}
            className={cn('p-1 rounded-md hover:bg-muted', toggle.on ? 'text-foreground' : 'text-[--text-muted]')}
          >
            {toggle.on ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
        )}
      </div>
      {children}
      {typeof size === 'number' && onSizeChange && (
        <label className="flex items-center gap-2 pt-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[--text-muted] shrink-0">{t('bk_ce_sizeLabel')}</span>
          <input
            type="range"
            min={0.6}
            max={2}
            step={0.05}
            value={size}
            onChange={(e) => onSizeChange(Number(e.target.value))}
            className="flex-1 accent-[#c45b3a]"
          />
          <span className="font-mono text-[10px] text-foreground w-8 text-right">{size.toFixed(2)}×</span>
        </label>
      )}
    </div>
  )
}

// ── CTA variants popover ────────────────────────────────────────────────────

function CtaVariantsPopover({
  loading, variants, onPick, onClose,
}: {
  loading:  boolean
  variants: string[]
  onPick:   (text: string) => void
  onClose:  () => void
}) {
  const { t } = useLanguage()
  return (
    <div className="absolute right-0 top-full mt-2 z-30 w-80 max-w-[calc(100vw-3rem)] rounded-2xl border border-border bg-card shadow-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[--text-muted]">{t('bk_ce_ctaVariants')}</span>
        <button type="button" onClick={onClose} aria-label={t('close')} className="text-[--text-muted] hover:text-foreground">
          <X size={12} />
        </button>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 py-3 text-[--text-muted]">
          <Loader2 size={12} className="animate-spin" />
          <span className="font-body text-xs">{t('bk_generating')}</span>
        </div>
      ) : variants.length === 0 ? (
        <p className="font-body text-xs text-[--text-muted] py-2">
          {t('bk_ce_ctaNoVariants')}
        </p>
      ) : (
        <ul className="space-y-1">
          {variants.map((v, i) => (
            <li key={`${v}-${i}`}>
              <button
                type="button"
                onClick={() => onPick(v)}
                className="w-full text-left rounded-lg border border-border bg-background hover:bg-muted px-2 py-1.5 font-body text-xs text-foreground transition-colors"
              >
                {v}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Media picker modal ──────────────────────────────────────────────────────

function MediaPickerModal({
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
          <h3 className="font-display text-base font-semibold text-foreground">{t('bk_ce_swapModalTitle')}</h3>
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
                  <div className="absolute inset-0 flex items-end justify-start opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-foreground/70 to-transparent p-2">
                    <span className="font-mono text-[9px] text-background truncate">{m.filename}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── DNA quick-ref ───────────────────────────────────────────────────────────

function DnaQuickRef({ kit }: { kit: BrandKit }) {
  const { t } = useLanguage()
  return (
    <div className="rounded-2xl border border-border bg-card p-3 space-y-3">
      <div className="flex items-center gap-1.5 text-[--text-muted]">
        <Palette size={12} />
        <span className="font-mono text-[10px] uppercase tracking-wider">{t('bk_ce_brandDna')}</span>
      </div>
      <div className="space-y-2">
        <p className="font-display text-sm font-semibold text-foreground truncate" title={kit.name}>{kit.name}</p>
        {kit.tagline && (
          <p className="font-body text-[11px] text-[--text-muted] italic leading-snug line-clamp-2">
            “{kit.tagline}”
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-4 h-4 rounded-md border border-border" style={{ background: kit.primary_color }} />
        {kit.secondary_color && (
          <span className="inline-block w-4 h-4 rounded-md border border-border" style={{ background: kit.secondary_color }} />
        )}
        <span className="font-mono text-[10px] text-[--text-muted]">{kit.font_family ?? 'Default'}</span>
      </div>
      {kit.brand_tone_of_voice.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {kit.brand_tone_of_voice.slice(0, 4).map((tone) => (
            <span key={tone} className="font-mono text-[9px] rounded bg-muted border border-border px-1 py-px text-foreground">{tone}</span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Version history ─────────────────────────────────────────────────────────

function VersionHistory({
  versions, current, onRestore, restoring,
}: {
  versions:  BrandCreativeVersion[]
  current:   number
  onRestore: (versionNum: number) => void
  restoring: number | null
}) {
  const { t } = useLanguage()
  return (
    <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-[--text-muted]">
        <History size={12} />
        <span className="font-mono text-[10px] uppercase tracking-wider">{t('bk_ce_history')}</span>
      </div>
      {versions.length === 0 ? (
        <p className="font-mono text-[10px] text-[--text-muted]">{t('bk_ce_noVersions')}</p>
      ) : (
        <ul className="space-y-1 max-h-64 overflow-y-auto -mx-1 px-1">
          {versions.map((v) => {
            const isCurrent = v.version_num === current
            const isRestoring = restoring === v.version_num
            return (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => onRestore(v.version_num)}
                  disabled={isCurrent || restoring !== null}
                  className={cn(
                    'w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 font-mono text-[11px] transition-colors',
                    isCurrent ? 'bg-muted text-foreground' : 'text-[--text-muted] hover:bg-muted hover:text-foreground',
                    restoring !== null && !isCurrent && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  <span>v{v.version_num}{isCurrent && ` · ${t('bk_ce_current')}`}</span>
                  <span className="text-[9px] opacity-70">
                    {isRestoring ? <Loader2 size={10} className="animate-spin inline" /> : new Date(v.created_at).toLocaleDateString()}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
