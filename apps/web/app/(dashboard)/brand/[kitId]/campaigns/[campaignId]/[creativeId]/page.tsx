'use client'

/**
 * Creative Editor — Phase 3.4 V1.
 *
 * Layout 3 colonnes :
 *   - Gauche (preview)  : la créative rendue exactement comme dans la
 *                          galerie, mais grand format + read-only.
 *   - Centre (blocks)   : éditeur par section (Image / Header / Description
 *                         / CTA), avec inputs et toggles de visibilité.
 *   - Droite (panneau)  : Brand DNA quick-ref (logo, couleurs, tagline,
 *                         tone) + Version history (clic = restore).
 *
 * Auto-save debouncé 1.5 s. Le bouton « Save version » crée un snapshot
 * append-only dans brand_creative_versions et bumpe current_version.
 *
 * V2 (à venir) : drag pixel-precise du text overlay, Fix Layout via Claude
 * vision, regeneration d'image, CTA variants, Download canvas.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, AlertCircle, Eye, EyeOff, Check, Save, History, Palette,
} from 'lucide-react'
import { BrandKitLayout } from '@/components/brand/BrandKitLayout'
import { cn } from '@/lib/utils'
import {
  getBrandCreative,
  getBrandKit,
  updateBrandCreative,
  listBrandCreativeVersions,
  saveBrandCreativeVersion,
  restoreBrandCreativeVersion,
  type BrandCreative,
  type BrandCampaign,
  type BrandCreativeVersion,
} from '@/lib/api'
import type { BrandKit, CreativeBlocksVisible, CampaignAspectRatio } from '@clyro/shared'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const DEBOUNCE_MS = 1500
const ASPECT_PREVIEW: Record<CampaignAspectRatio, { width: number; height: number }> = {
  '9:16': { width: 360, height: 640 },
  '1:1':  { width: 480, height: 480 },
  '4:5':  { width: 432, height: 540 },
}

export default function CreativeEditorPage() {
  const params = useParams<{ kitId: string; campaignId: string; creativeId: string }>()
  const kitId = params?.kitId ?? ''
  const campaignId = params?.campaignId ?? ''
  const creativeId = params?.creativeId ?? ''

  const [kit, setKit] = useState<BrandKit | null>(null)
  const [campaign, setCampaign] = useState<BrandCampaign | null>(null)
  const [creative, setCreative] = useState<BrandCreative | null>(null)
  const [versions, setVersions] = useState<BrandCreativeVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [savingVersion, setSavingVersion] = useState(false)
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null)

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
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [creativeId, kitId])

  // ── Patch + debounced save ────────────────────────────────────────────────
  function patchCreative(patch: Partial<BrandCreative>) {
    if (!creative) return
    const next = { ...creative, ...patch }
    setCreative(next)
    scheduleSave(patch)
  }

  function scheduleSave(patch: Partial<BrandCreative>) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSaveState('saving')
    debounceRef.current = setTimeout(async () => {
      try {
        // Filtre vers le shape accepté par PUT /brand/creatives/:id
        const payload: Parameters<typeof updateBrandCreative>[1] = {}
        if ('header_text'      in patch) payload.header_text      = patch.header_text
        if ('description_text' in patch) payload.description_text = patch.description_text
        if ('cta_text'         in patch) payload.cta_text         = patch.cta_text
        if ('blocks_visible'   in patch) payload.blocks_visible   = patch.blocks_visible
        const res = await updateBrandCreative(creativeId, payload)
        setCreative(res.data)
        setSaveState('saved')
      } catch {
        setSaveState('error')
      }
    }, DEBOUNCE_MS)
  }

  function toggleBlock(block: keyof CreativeBlocksVisible) {
    if (!creative) return
    const nextBlocks = { ...creative.blocks_visible, [block]: !creative.blocks_visible[block] }
    patchCreative({ blocks_visible: nextBlocks })
  }

  async function handleSaveVersion() {
    if (savingVersion) return
    setSavingVersion(true)
    try {
      const res = await saveBrandCreativeVersion(creativeId)
      setVersions((cur) => [res.data, ...cur])
      if (creative) setCreative({ ...creative, current_version: res.data.version_num })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save version')
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
      alert(err instanceof Error ? err.message : 'Restore failed')
    } finally {
      setRestoringVersion(null)
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
          <p className="font-body text-sm text-[--text-muted]">{error ?? 'Creative not found'}</p>
          <Link href={`/brand/${kitId}/campaigns/${campaignId}`} className="font-mono text-xs text-foreground underline">
            ← Back to campaign
          </Link>
        </div>
      </BrandKitLayout>
    )
  }

  const saveStatus = (
    <span className="inline-flex items-center gap-1.5">
      {saveState === 'saving' && (<><Loader2 size={11} className="animate-spin" /> Saving…</>)}
      {saveState === 'saved'  && (<><Check    size={11} className="text-emerald-600" /> Saved</>)}
      {saveState === 'error'  && (<><AlertCircle size={11} className="text-error" /> Failed</>)}
    </span>
  )

  return (
    <BrandKitLayout kitId={kitId} kitName={campaign.title} saveStatus={saveStatus}>
      <div className="space-y-4">
        {/* Header bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Link
            href={`/brand/${kitId}/campaigns/${campaignId}`}
            className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[--text-muted] hover:text-foreground"
          >
            <ArrowLeft size={12} /> Back to {campaign.title.slice(0, 40)}
          </Link>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[--text-muted]">
              v{creative.current_version}
            </span>
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
              Save version
            </button>
          </div>
        </div>

        {/* 3-column layout */}
        <div className="grid grid-cols-12 gap-5">
          {/* Preview — col 1-6 */}
          <section className="col-span-12 lg:col-span-6 flex items-start justify-center">
            <CreativePreview creative={creative} aspectRatio={campaign.aspect_ratio} />
          </section>

          {/* Block editor — col 7-9 */}
          <section className="col-span-12 lg:col-span-4 space-y-3">
            <BlockSection title="Image" hint="V2 will allow swap & regenerate.">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted p-2">
                <img src={creative.image_url} alt="" className="w-16 h-16 rounded-lg object-cover border border-border" />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] text-[--text-muted] truncate" title={creative.prompt ?? ''}>
                    {creative.prompt ?? 'No prompt recorded'}
                  </p>
                </div>
              </div>
            </BlockSection>

            <BlockSection
              title="Header"
              hint="Top line, large type."
              toggle={{ on: creative.blocks_visible.header, onClick: () => toggleBlock('header') }}
            >
              <input
                type="text"
                value={creative.header_text ?? ''}
                onChange={(e) => patchCreative({ header_text: e.target.value })}
                placeholder="Bold opening line"
                maxLength={200}
                className="w-full rounded-xl border border-border bg-muted px-3 py-2 font-body text-sm text-foreground outline-none focus:border-blue-500/60"
              />
            </BlockSection>

            <BlockSection
              title="Description"
              hint="Middle copy, narrative."
              toggle={{ on: creative.blocks_visible.description, onClick: () => toggleBlock('description') }}
            >
              <textarea
                value={creative.description_text ?? ''}
                onChange={(e) => patchCreative({ description_text: e.target.value })}
                rows={3}
                maxLength={500}
                placeholder="What the campaign is about"
                className="w-full rounded-xl border border-border bg-muted px-3 py-2 font-body text-sm text-foreground outline-none focus:border-blue-500/60 resize-none"
              />
            </BlockSection>

            <BlockSection
              title="Call to action"
              hint="Bottom button copy."
              toggle={{ on: creative.blocks_visible.cta, onClick: () => toggleBlock('cta') }}
            >
              <input
                type="text"
                value={creative.cta_text ?? ''}
                onChange={(e) => patchCreative({ cta_text: e.target.value })}
                placeholder="SHOP NOW"
                maxLength={60}
                className="w-full rounded-xl border border-border bg-muted px-3 py-2 font-body text-sm text-foreground outline-none focus:border-blue-500/60"
              />
            </BlockSection>
          </section>

          {/* Right panel — col 10-12 */}
          <aside className="col-span-12 lg:col-span-2 space-y-4">
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
    </BrandKitLayout>
  )
}

// ── Live preview ────────────────────────────────────────────────────────────

function CreativePreview({ creative, aspectRatio }: { creative: BrandCreative; aspectRatio: CampaignAspectRatio }) {
  const dim = ASPECT_PREVIEW[aspectRatio]
  const blocks = creative.blocks_visible
  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-border bg-muted shadow-sm"
      style={{ width: dim.width, height: dim.height, maxWidth: '100%' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={creative.image_url} alt="" className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-foreground/30 via-transparent to-foreground/40 pointer-events-none" />
      {blocks.header && creative.header_text && (
        <div className="absolute top-4 left-4 right-4 font-display text-white text-xl font-semibold leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">
          {creative.header_text}
        </div>
      )}
      {blocks.description && creative.description_text && (
        <div className="absolute top-1/2 left-4 right-4 -translate-y-1/2 font-display text-white text-sm leading-snug drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">
          {creative.description_text}
        </div>
      )}
      {blocks.cta && creative.cta_text && (
        <div className="absolute bottom-4 left-4 right-4 font-display text-white text-sm font-medium uppercase tracking-widest text-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">
          {creative.cta_text}
        </div>
      )}
    </div>
  )
}

// ── Block section helper ────────────────────────────────────────────────────

function BlockSection({
  title, hint, toggle, children,
}: {
  title: string
  hint?: string
  toggle?: { on: boolean; onClick: () => void }
  children: React.ReactNode
}) {
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
            aria-label={toggle.on ? 'Hide block' : 'Show block'}
            className={cn('p-1 rounded-md hover:bg-muted', toggle.on ? 'text-foreground' : 'text-[--text-muted]')}
          >
            {toggle.on ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

// ── DNA quick-ref ───────────────────────────────────────────────────────────

function DnaQuickRef({ kit }: { kit: BrandKit }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 space-y-3">
      <div className="flex items-center gap-1.5 text-[--text-muted]">
        <Palette size={12} />
        <span className="font-mono text-[10px] uppercase tracking-wider">Brand DNA</span>
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
          {kit.brand_tone_of_voice.slice(0, 4).map((t) => (
            <span key={t} className="font-mono text-[9px] rounded bg-muted border border-border px-1 py-px text-foreground">{t}</span>
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
  versions: BrandCreativeVersion[]
  current:  number
  onRestore: (versionNum: number) => void
  restoring: number | null
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-[--text-muted]">
        <History size={12} />
        <span className="font-mono text-[10px] uppercase tracking-wider">History</span>
      </div>
      {versions.length === 0 ? (
        <p className="font-mono text-[10px] text-[--text-muted]">No saved versions yet.</p>
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
                  <span>v{v.version_num}{isCurrent && ' · current'}</span>
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
