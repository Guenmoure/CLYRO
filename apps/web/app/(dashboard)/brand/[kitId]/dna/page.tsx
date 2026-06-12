'use client'

/**
 * Business DNA editor — Phase 1 du portage Pomelli.
 *
 * Deux onglets dans une seule page :
 *   1. Brand Overview  — name, url, logo, colors, fonts, tagline, values,
 *                        aesthetic, tone, business overview
 *   2. Business Details — location, phone, hours, keywords, social, CTAs,
 *                         testimonials
 *
 * Sauvegarde auto en debounce (1.5 s) sur chaque modification.
 *
 * Cf. docs/POMELLI_BRAND_KIT_PLAN.md §4 « Phase 1 » + supabase migration
 * 20260601000000_brand_dna_extension.sql pour le schéma sous-jacent.
 */

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, AlertCircle, Check } from 'lucide-react'
import { BrandKitLayout } from '@/components/brand/BrandKitLayout'
import { TagInput } from '@/components/brand/TagInput'
import { SocialLinksEditor } from '@/components/brand/SocialLinksEditor'
import { CtaLinkList } from '@/components/brand/CtaLinkList'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'
import { getBrandKit, updateBrandKit } from '@/lib/api'
import type { BrandKit, SocialLinks, CtaLink } from '@clyro/shared'

type Tab = 'overview' | 'business'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const DEBOUNCE_MS = 1500

export default function BrandDnaPage() {
  const params = useParams<{ kitId: string }>()
  const router = useRouter()
  const { t } = useLanguage()
  const kitId = params?.kitId ?? ''

  const [tab, setTab] = useState<Tab>('overview')
  const [kit, setKit] = useState<BrandKit | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!kitId) return
    setLoading(true)
    setLoadError(null)
    getBrandKit(kitId)
      .then((r) => setKit(r.data))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : t('bk_failedLoad')
        setLoadError(msg)
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kitId])

  // ── Patch + debounced save ────────────────────────────────────────────────
  // Chaque updateField met à jour le state local immédiatement (UI fluide) et
  // déclenche un PUT après 1.5 s d'inactivité. Si l'utilisateur tape vite, on
  // n'envoie qu'un seul appel à la fin.
  function updateField<K extends keyof BrandKit>(key: K, value: BrandKit[K]) {
    if (!kit) return
    const next = { ...kit, [key]: value }
    setKit(next)
    scheduleSave({ [key]: value })
  }

  function scheduleSave(patch: Partial<BrandKit>) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSaveState('saving')
    debounceRef.current = setTimeout(async () => {
      try {
        // BrandKit a des champs nullable (DB NULL → string | null) alors que
        // l'API attend `string | undefined`. On convertit null → undefined
        // avant l'envoi, sinon Zod rejette `null` sur les `.optional()`.
        const cleaned: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(patch)) {
          cleaned[key] = value === null ? undefined : value
        }
        // Le PUT renvoie le row complet → on remet à jour le state pour
        // refléter les éventuelles transformations côté DB (trim, défauts).
        const res = await updateBrandKit({ id: kitId, ...cleaned })
        setKit(res.data)
        setSaveState('saved')
      } catch (err) {
        setSaveState('error')
        // eslint-disable-next-line no-console
        console.error('[brand-dna] save failed:', err)
      }
    }, DEBOUNCE_MS)
  }

  // ── Rendering ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <BrandKitLayout kitId={kitId}>
        <div className="flex items-center justify-center py-20 text-[--text-muted]">
          <Loader2 size={20} className="animate-spin" />
        </div>
      </BrandKitLayout>
    )
  }
  if (loadError || !kit) {
    return (
      <BrandKitLayout kitId={kitId}>
        <div className="flex flex-col items-center gap-3 py-20">
          <AlertCircle size={28} className="text-error" />
          <p className="font-body text-sm text-[--text-muted]">{loadError ?? t('bk_kitNotFound')}</p>
          <button
            type="button"
            onClick={() => router.push('/brand')}
            className="font-mono text-xs text-foreground underline"
          >
            ← {t('bk_dna_backToKits')}
          </button>
        </div>
      </BrandKitLayout>
    )
  }

  const saveIndicator = (
    <span className="inline-flex items-center gap-1.5">
      {saveState === 'saving' && (
        <>
          <Loader2 size={11} className="animate-spin" />
          {t('bh_saving')}
        </>
      )}
      {saveState === 'saved' && (
        <>
          <Check size={11} className="text-emerald-600" />
          {t('bk_ce_saved')}
        </>
      )}
      {saveState === 'error' && (
        <>
          <AlertCircle size={11} className="text-error" />
          {t('bk_ce_saveFailedShort')}
        </>
      )}
    </span>
  )

  return (
    <BrandKitLayout
      kitId={kitId}
      kitName={kit.name}
      saveStatus={saveIndicator}
      tabs={<TabsBar tab={tab} onChange={setTab} />}
    >
      <div className="max-w-3xl mx-auto space-y-8">
        {tab === 'overview' ? (
          <OverviewTab kit={kit} updateField={updateField} />
        ) : (
          <BusinessTab kit={kit} updateField={updateField} />
        )}
      </div>
    </BrandKitLayout>
  )
}

// ── Tabs bar ────────────────────────────────────────────────────────────────

function TabsBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const { t } = useLanguage()
  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: t('bk_dna_tabOverview') },
    { id: 'business', label: t('bk_dna_tabBusiness') },
  ]
  return (
    <div className="flex gap-6 border-b border-border -mb-px">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            'pb-2 font-display text-sm font-medium transition-colors border-b-2',
            tab === t.id
              ? 'text-foreground border-[#c45b3a]'
              : 'text-[--text-muted] border-transparent hover:text-foreground',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── Section helper ──────────────────────────────────────────────────────────

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>
        {hint && <p className="font-body text-xs text-[--text-muted]">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

const inputCls =
  'w-full rounded-xl border border-border bg-muted px-3 py-2 font-body text-sm text-foreground placeholder-[--text-muted] outline-none focus:border-blue-500/60 transition-colors'

// ── Onglet 1 — Brand Overview ───────────────────────────────────────────────

function OverviewTab({
  kit,
  updateField,
}: {
  kit: BrandKit
  updateField: <K extends keyof BrandKit>(key: K, value: BrandKit[K]) => void
}) {
  const { t } = useLanguage()
  return (
    <>
      <Section title={t('bk_dna_nameTitle')} hint={t('bk_dna_nameHint')}>
        <input
          type="text"
          value={kit.name ?? ''}
          onChange={(e) => updateField('name', e.target.value)}
          maxLength={80}
          className={inputCls}
        />
      </Section>

      <Section title={t('bk_dna_urlTitle')} hint={t('bk_dna_urlHint')}>
        <input
          type="url"
          value={kit.url ?? ''}
          onChange={(e) => updateField('url', e.target.value)}
          placeholder={t('bk_dna_urlPh')}
          maxLength={500}
          className={inputCls}
        />
      </Section>

      <Section title={t('bk_dna_logoTitle')} hint={t('bk_dna_logoHint')}>
        {kit.logo_url ? (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-muted p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={kit.logo_url} alt={t('bk_dna_logoAlt')} className="w-12 h-12 object-contain rounded-md bg-card border border-border" />
            <input
              type="url"
              value={kit.logo_url ?? ''}
              onChange={(e) => updateField('logo_url', e.target.value)}
              placeholder={t('bk_dna_logoUrlPh')}
              maxLength={500}
              className="flex-1 bg-transparent outline-none font-mono text-xs text-foreground"
            />
          </div>
        ) : (
          <input
            type="url"
            value={kit.logo_url ?? ''}
            onChange={(e) => updateField('logo_url', e.target.value)}
            placeholder={t('bk_dna_logoPastePh')}
            className={inputCls}
          />
        )}
      </Section>

      <Section title={t('bk_dna_colorsTitle')} hint={t('bk_dna_colorsHint')}>
        <div className="grid grid-cols-2 gap-3">
          <ColorField
            label={t('bk_dna_colorPrimary')}
            value={kit.primary_color}
            onChange={(v) => updateField('primary_color', v)}
          />
          <ColorField
            label={t('bk_dna_colorSecondary')}
            value={kit.secondary_color ?? ''}
            onChange={(v) => updateField('secondary_color', v as BrandKit['secondary_color'])}
            allowEmpty
          />
        </div>
      </Section>

      <Section title={t('bk_dna_fontTitle')} hint={t('bk_dna_fontHint')}>
        <input
          type="text"
          value={kit.font_family ?? ''}
          onChange={(e) => updateField('font_family', e.target.value)}
          placeholder="Inter, Plus Jakarta Sans, Playfair Display…"
          maxLength={100}
          className={inputCls}
        />
      </Section>

      <Section title={t('bk_dna_taglineTitle')} hint={t('bk_dna_taglineHint')}>
        <input
          type="text"
          value={kit.tagline ?? ''}
          onChange={(e) => updateField('tagline', e.target.value)}
          placeholder={t('bk_dna_taglinePh')}
          maxLength={200}
          className={inputCls}
        />
      </Section>

      <Section title={t('bk_dna_valuesTitle')} hint={t('bk_dna_valuesHint')}>
        <TagInput
          value={kit.brand_values}
          onChange={(next) => updateField('brand_values', next)}
          placeholder={t('bk_dna_valuesPh')}
        />
      </Section>

      <Section title={t('bk_dna_aestheticTitle')} hint={t('bk_dna_aestheticHint')}>
        <TagInput
          value={kit.brand_aesthetic}
          onChange={(next) => updateField('brand_aesthetic', next)}
          placeholder={t('bk_dna_aestheticPh')}
        />
      </Section>

      <Section title={t('bk_dna_toneTitle')} hint={t('bk_dna_toneHint')}>
        <TagInput
          value={kit.brand_tone_of_voice}
          onChange={(next) => updateField('brand_tone_of_voice', next)}
          placeholder={t('bk_dna_tonePh')}
        />
      </Section>

      <Section title={t('bk_dna_overviewTitle')} hint={t('bk_dna_overviewHint')}>
        <textarea
          value={kit.business_overview ?? ''}
          onChange={(e) => updateField('business_overview', e.target.value)}
          rows={5}
          maxLength={2000}
          className={cn(inputCls, 'resize-y leading-relaxed')}
          placeholder={t('bk_dna_overviewPh')}
        />
      </Section>
    </>
  )
}

function ColorField({
  label,
  value,
  onChange,
  allowEmpty,
}: {
  label: string
  value: string
  onChange: (next: string) => void
  allowEmpty?: boolean
}) {
  const { t } = useLanguage()
  const display = value || '#6366f1'
  return (
    <div className="space-y-1">
      <label className="font-mono text-[10px] uppercase tracking-wider text-[--text-muted]">{label}</label>
      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted px-3 py-2 focus-within:border-blue-500/60 transition-colors">
        <input
          type="color"
          value={display}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="w-9 h-9 rounded-md border-0 bg-transparent cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={allowEmpty ? t('bk_dna_optionalPh') : '#RRGGBB'}
          maxLength={7}
          className="flex-1 bg-transparent outline-none font-mono text-xs text-foreground placeholder-[--text-muted]"
        />
      </div>
    </div>
  )
}

// ── Onglet 2 — Business Details ─────────────────────────────────────────────

function BusinessTab({
  kit,
  updateField,
}: {
  kit: BrandKit
  updateField: <K extends keyof BrandKit>(key: K, value: BrandKit[K]) => void
}) {
  const { t } = useLanguage()
  return (
    <>
      <Section title={t('bk_dna_locationTitle')} hint={t('bk_dna_locationHint')}>
        <input
          type="text"
          value={kit.location ?? ''}
          onChange={(e) => updateField('location', e.target.value)}
          placeholder="Paris, France"
          maxLength={200}
          className={inputCls}
        />
      </Section>

      <Section title={t('bk_dna_phoneTitle')}>
        <input
          type="tel"
          value={kit.phone ?? ''}
          onChange={(e) => updateField('phone', e.target.value)}
          placeholder="+33 1 23 45 67 89"
          maxLength={40}
          className={inputCls}
        />
      </Section>

      <Section title={t('bk_dna_hoursTitle')}>
        <input
          type="text"
          value={kit.business_hours ?? ''}
          onChange={(e) => updateField('business_hours', e.target.value)}
          placeholder={t('bk_dna_hoursPh')}
          maxLength={500}
          className={inputCls}
        />
      </Section>

      <Section title={t('bk_dna_keywordsTitle')} hint={t('bk_dna_keywordsHint')}>
        <TagInput
          value={kit.keywords}
          onChange={(next) => updateField('keywords', next)}
          max={30}
          placeholder={t('bk_dna_keywordsPh')}
        />
      </Section>

      <Section title={t('bk_dna_socialTitle')} hint={t('bk_dna_socialHint')}>
        <SocialLinksEditor
          value={kit.social_links}
          onChange={(next: SocialLinks) => updateField('social_links', next)}
        />
      </Section>

      <Section title={t('bk_dna_ctaTitle')} hint={t('bk_dna_ctaHint')}>
        <CtaLinkList
          value={kit.cta_links}
          onChange={(next: CtaLink[]) => updateField('cta_links', next)}
        />
      </Section>

      <Section title={t('bk_dna_testimonialsTitle')} hint={t('bk_dna_testimonialsHint')}>
        <textarea
          value={kit.testimonials ?? ''}
          onChange={(e) => updateField('testimonials', e.target.value)}
          rows={6}
          maxLength={4000}
          className={cn(inputCls, 'resize-y leading-relaxed')}
          placeholder={t('bk_dna_testimonialsPh')}
        />
      </Section>
    </>
  )
}
