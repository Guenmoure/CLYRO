'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Palette, Sparkles, Clapperboard, Star, AlertCircle } from 'lucide-react'
import { Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createBrowserClient } from '@/lib/supabase'
import { useLanguage } from '@/lib/i18n'

type BrandKit = {
  id: string
  name: string | null
  primary_color: string | null
  secondary_color: string | null
  is_default: boolean | null
  logo_url: string | null
  created_at: string
  // Audit 16/06/26 — extended fields surfaced in the hover preview so the
  // user can compare kits at a glance without opening each one.
  tagline:             string | null
  font_family:         string | null
  brand_values:        string[] | null
  brand_aesthetic:     string[] | null
  brand_tone_of_voice: string[] | null
}

export default function BrandIndexPage() {
  const { t } = useLanguage()
  const [kits, setKits] = useState<BrandKit[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const supabase = createBrowserClient()
        const { data: { user } } = await supabase.auth.getUser()
        const { data, error } = await supabase
          .from('brand_kits')
          .select('id, name, primary_color, secondary_color, is_default, logo_url, created_at, tagline, font_family, brand_values, brand_aesthetic, brand_tone_of_voice')
          .eq('user_id', user?.id ?? '')
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: false })
        if (error) throw error
        setKits((data ?? []) as BrandKit[])
      } catch {
        setLoadError(true)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto bg-background px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[--text-muted]" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex-1 overflow-y-auto bg-background px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertCircle size={28} className="mx-auto text-error" />
          <p className="font-display text-sm font-semibold text-foreground">{t('loadError')}</p>
          <button type="button" onClick={() => window.location.reload()} className="font-body text-xs text-primary hover:underline">
            {t('retry')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Palette size={14} className="text-teal-500" />
              <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-secondary] font-semibold">{t('bl_moduleLabel')}</p>
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground">{t('bl_heading')}</h1>
            <p className="font-body text-sm text-[--text-secondary] mt-1 max-w-xl">
              {t('bl_subtitle')}
            </p>
          </div>

          <Link href="/brand/hub" className="group relative">
            <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-grad-cta text-white font-body text-sm font-semibold shadow-lg">
              <Plus size={16} className="group-hover:rotate-90 transition-transform duration-200" />
              {t('bl_newProject')}
            </div>
          </Link>
        </div>

        {/* Kits grid */}
        {kits.length === 0 ? (
          <Card variant="elevated" padding="xl" className="flex flex-col items-center text-center gap-5 py-20">
            <div className="relative">
              <div className="absolute inset-0 rounded-3xl bg-primary/10 blur-2xl" />
              <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-teal-500/15 to-teal-500/10 border border-border flex items-center justify-center">
                <Palette size={32} className="text-teal-500" />
              </div>
            </div>
            <div className="space-y-1">
              <h2 className="font-display text-xl font-bold text-foreground">{t('bl_emptyTitle')}</h2>
              <p className="font-body text-sm text-[--text-secondary] max-w-md">
                {t('bl_emptyDesc')}
              </p>
            </div>
            <Link href="/brand/hub" className="group relative mt-2">
              <div className="flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-grad-cta text-white font-body text-base font-semibold shadow-xl">
                <Clapperboard size={18} />
                {t('bl_createFirst')}
                <Sparkles size={14} className="opacity-80" />
              </div>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <NewKitCard
              newProjectLabel={t('bl_cardNewProject')}
              colorsLogoVoiceLabel={t('bl_cardColorsLogoVoice')}
              badgeLabel={t('bl_cardBadge')}
            />
            {kits.map((k) => (
              <BrandKitCard
                key={k.id}
                kit={k}
                untitledKitLabel={t('bl_untitledKit')}
                brandLabel={t('bl_brandLabel')}
                defaultLabel={t('bl_default')}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function NewKitCard({
  newProjectLabel,
  colorsLogoVoiceLabel,
  badgeLabel,
}: {
  newProjectLabel: string
  colorsLogoVoiceLabel: string
  badgeLabel: string
}) {
  return (
    <Link href="/brand/hub" className="group relative block rounded-2xl overflow-hidden aspect-[4/3]">
      <div className="absolute inset-0 bg-primary opacity-80 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="absolute inset-[1.5px] rounded-2xl bg-card group-hover:bg-card/90 transition-colors duration-300" />
      <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary blur-lg opacity-50 group-hover:opacity-80 transition-opacity duration-300" />
          <div className="relative w-14 h-14 rounded-full bg-grad-cta flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
            <Plus size={24} className="text-white group-hover:rotate-90 transition-transform duration-300" />
          </div>
        </div>
        <div className="text-center">
          <p className="font-display text-base font-bold text-foreground group-hover:text-white transition-colors duration-200">
            {newProjectLabel}
          </p>
          <p className="font-body text-xs text-[--text-muted] mt-0.5 group-hover:text-white/60 transition-colors duration-200">
            {colorsLogoVoiceLabel}
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/15 border border-teal-500/30 group-hover:bg-teal-500/25 transition-all duration-200">
          <Sparkles size={10} className="text-teal-500" />
          <span className="font-mono text-[10px] text-teal-500 tracking-wider uppercase">{badgeLabel}</span>
        </div>
      </div>
    </Link>
  )
}

function BrandKitCard({
  kit,
  untitledKitLabel,
  brandLabel,
  defaultLabel,
}: {
  kit: BrandKit
  untitledKitLabel: string
  brandLabel: string
  defaultLabel: string
}) {
  const primary = kit.primary_color ?? '#0891b2'
  const secondary = kit.secondary_color ?? '#0d9488'
  // Audit 16/06/26 — hover preview state. Pure CSS-only would work via
  // group-hover, but we want the preview to be a real, focusable panel
  // so keyboard users can also see it.
  const [previewOpen, setPreviewOpen] = useState(false)

  const hasPreviewContent = !!(
    kit.tagline ||
    kit.font_family ||
    (kit.brand_values        && kit.brand_values.length        > 0) ||
    (kit.brand_aesthetic     && kit.brand_aesthetic.length     > 0) ||
    (kit.brand_tone_of_voice && kit.brand_tone_of_voice.length > 0)
  )

  return (
    <div
      className="relative"
      onMouseEnter={() => setPreviewOpen(true)}
      onMouseLeave={() => setPreviewOpen(false)}
      onFocus={() => setPreviewOpen(true)}
      onBlur={() => setPreviewOpen(false)}
    >
      <Link
        href="/brand/hub"
        className="card-interactive rounded-2xl border border-border bg-card overflow-hidden block"
      >
        <div
          className="aspect-video relative flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${primary}33, ${secondary}33)` }}
        >
          <div className="absolute inset-0 grid-bg opacity-[0.04]" />
          {kit.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={kit.logo_url} alt={kit.name ?? untitledKitLabel} className="max-w-[60%] max-h-[60%] object-contain relative" />
          ) : (
            <Palette size={32} className="text-white/60 relative" />
          )}
          <div className="absolute bottom-2 left-2 flex items-center gap-1">
            <span className="w-4 h-4 rounded-full border border-white/30" style={{ background: primary }} />
            <span className="w-4 h-4 rounded-full border border-white/30" style={{ background: secondary }} />
          </div>
          {kit.is_default && (
            <Badge className="absolute top-2 right-2 bg-amber-500/90 text-white border-0" variant="neutral">
              <Star size={10} className="mr-1 fill-current" />
              {defaultLabel}
            </Badge>
          )}
        </div>

        <div className="p-4 space-y-1">
          <p className="font-display font-semibold text-foreground truncate">
            {kit.name ?? untitledKitLabel}
          </p>
          <div className="flex items-center gap-2 text-xs font-mono text-[--text-muted]">
            <span>{brandLabel}</span>
            <span>·</span>
            <span>{formatRelative(kit.created_at)}</span>
          </div>
        </div>
      </Link>

      {/* Hover preview — surfaced over the card. Audit 16/06/26 — shows
          tagline, palette swatches, typography sample, and value chips
          so the user can compare kits without opening each one. */}
      {previewOpen && hasPreviewContent && (
        <div
          className="absolute left-0 right-0 top-full mt-2 z-30 rounded-2xl border border-border bg-card shadow-xl p-4 space-y-3 pointer-events-none animate-fade-in"
          role="tooltip"
          aria-hidden={!previewOpen}
        >
          {kit.tagline && (
            <p className="font-display text-sm italic text-foreground leading-snug">
              &ldquo;{kit.tagline}&rdquo;
            </p>
          )}

          {/* Palette swatches with hex labels */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-md border border-border" style={{ background: primary }} />
              <span className="font-mono text-[10px] text-[--text-muted]">{primary}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-md border border-border" style={{ background: secondary }} />
              <span className="font-mono text-[10px] text-[--text-muted]">{secondary}</span>
            </div>
          </div>

          {/* Typography sample */}
          {kit.font_family && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-[--text-muted] mb-0.5">
                Typography
              </p>
              <p
                className="text-base font-semibold text-foreground"
                style={{ fontFamily: kit.font_family }}
              >
                {kit.font_family} — Aa
              </p>
            </div>
          )}

          {/* Values / aesthetic / tone chips — 3 rows max, 4 items each, ellipsised */}
          {[
            { label: 'Values',    items: kit.brand_values },
            { label: 'Aesthetic', items: kit.brand_aesthetic },
            { label: 'Voice',     items: kit.brand_tone_of_voice },
          ]
            .filter((row) => row.items && row.items.length > 0)
            .map((row) => (
              <div key={row.label}>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[--text-muted] mb-1">
                  {row.label}
                </p>
                <div className="flex flex-wrap gap-1">
                  {row.items!.slice(0, 4).map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-foreground/80"
                    >
                      {item}
                    </span>
                  ))}
                  {row.items!.length > 4 && (
                    <span className="font-mono text-[10px] text-[--text-muted]">
                      +{row.items!.length - 4}
                    </span>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return '<1m'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
