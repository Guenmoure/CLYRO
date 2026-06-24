'use client'

/**
 * Brand entry — same editorial pattern as /faceless and /motion (Vague 3).
 *
 * The hover preview panel from the previous design is preserved (real UX
 * value for comparing kits without opening each one).
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Palette, Star, AlertCircle, Loader2 } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { useLanguage } from '@/lib/i18n'
import { InferFromUrlPanel } from '@/components/brand/InferFromUrlPanel'

type BrandKit = {
  id: string
  name: string | null
  primary_color: string | null
  secondary_color: string | null
  is_default: boolean | null
  logo_url: string | null
  created_at: string
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

  function Header() {
    return (
      <header className="mb-10">
        <div className="divider-with-num">
          <span className="eyebrow">{t('nav_sec_create')}</span>
          <hr />
          <span className="folio">№ 04 / 12</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="h-display">{t('bl_heading')}</h1>
          <Link
            href="/brand/hub"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground text-background border border-foreground font-mono text-[10px] uppercase tracking-[0.14em] hover:bg-primary hover:border-primary transition-colors"
          >
            <Plus size={12} />
            {t('bl_newProject')}
          </Link>
        </div>
        <p className="lead mt-5">{t('bl_subtitle')}</p>
        <hr className="rule-thin mt-8" />
      </header>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="px-4 sm:px-6 lg:px-12 py-12 max-w-6xl mx-auto">
          <Header />
          <div className="flex items-center justify-center py-24">
            <Loader2 size={20} className="animate-spin text-[--text-muted]" />
          </div>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="px-4 sm:px-6 lg:px-12 py-12 max-w-6xl mx-auto">
          <Header />
          <div className="py-24 text-center">
            <AlertCircle size={24} className="mx-auto text-[--text-muted] mb-3" />
            <p className="h-card">{t('loadError')}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-primary hover:underline"
            >
              {t('retry')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="px-4 sm:px-6 lg:px-12 py-12 max-w-6xl mx-auto">
        <Header />

        {/* « Infer brand DNA from URL » shortcut. Kept functional, just sits
            in the editorial flow below the header. */}
        <div className="mb-8">
          <InferFromUrlPanel onKitCreated={() => { void window.location.reload() }} />
        </div>

        {kits.length === 0 ? (
          <div className="border border-border rounded-md bg-card p-12 text-center">
            <div className="folio mb-4">BR.00</div>
            <h2 className="h-card mb-3">{t('bl_emptyTitle')}</h2>
            <p className="lead mx-auto mb-8">{t('bl_emptyDesc')}</p>
            <Link
              href="/brand/hub"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background border border-foreground font-mono text-[11px] uppercase tracking-[0.14em] hover:bg-primary hover:border-primary transition-colors"
            >
              <Palette size={13} />
              {t('bl_createFirst')}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <NewKitTile
              label={t('bl_cardNewProject')}
              hint={t('bl_cardColorsLogoVoice')}
              badge={t('bl_cardBadge')}
            />
            {kits.map((k) => (
              <BrandKitTile
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

function NewKitTile({ label, hint, badge }: { label: string; hint: string; badge: string }) {
  return (
    <Link
      href="/brand/hub"
      className="tile block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 group"
      aria-label={label}
    >
      <div className="ph relative flex items-center justify-center" style={{ aspectRatio: '4 / 3' }}>
        <div className="ph-folio">BR.NEW</div>
        <div className="flex flex-col items-center gap-3">
          <span className="w-12 h-12 rounded-full bg-foreground text-background flex items-center justify-center group-hover:bg-primary transition-colors">
            <Plus size={20} />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground">{badge}</span>
        </div>
      </div>
      <div className="tile-body">
        <h3 className="h-card">{label}</h3>
        <p className="font-body text-sm text-[--text-secondary] mt-1">{hint}</p>
      </div>
    </Link>
  )
}

function BrandKitTile({
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
  const primary = kit.primary_color ?? '#6D4AFF'
  const secondary = kit.secondary_color ?? '#8B5CF6'
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
        className="tile block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <div
          className="relative flex items-center justify-center"
          style={{ aspectRatio: '16 / 9', background: `linear-gradient(135deg, ${primary}22, ${secondary}22)` }}
        >
          {kit.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={kit.logo_url} alt={kit.name ?? untitledKitLabel} className="max-w-[60%] max-h-[60%] object-contain relative" />
          ) : (
            <Palette size={28} className="text-foreground/40 relative" />
          )}
          {/* Palette swatches */}
          <div className="absolute bottom-2 left-2 flex items-center gap-1">
            <span className="w-4 h-4 rounded-full border border-white/40 shadow-sm" style={{ background: primary }} />
            <span className="w-4 h-4 rounded-full border border-white/40 shadow-sm" style={{ background: secondary }} />
          </div>
          {/* Folio top-left */}
          <span className="absolute top-2 left-2 font-mono text-[9px] uppercase tracking-[0.1em] text-foreground/60 bg-card/80 border border-border px-1.5 py-0.5 rounded">
            BR.{kit.id.slice(0, 6).toUpperCase()}
          </span>
          {/* Default badge top-right */}
          {kit.is_default && (
            <span className="absolute top-2 right-2 inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.1em] text-background bg-foreground px-2 py-0.5 rounded-full">
              <Star size={9} className="fill-current" />
              {defaultLabel}
            </span>
          )}
        </div>

        <div className="tile-body">
          <h3 className="h-card truncate">{kit.name ?? untitledKitLabel}</h3>
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[--text-muted] mt-2">
            {brandLabel} · {formatRelative(kit.created_at)}
          </p>
        </div>
      </Link>

      {/* Hover preview — kept from the previous design (real UX value). */}
      {previewOpen && hasPreviewContent && (
        <div
          className="absolute left-0 right-0 top-full mt-2 z-30 rounded-md border border-border bg-card shadow-xl p-4 space-y-3 pointer-events-none animate-fade-in"
          role="tooltip"
          aria-hidden={!previewOpen}
        >
          {kit.tagline && (
            <p className="font-display text-sm italic text-foreground leading-snug">
              &ldquo;{kit.tagline}&rdquo;
            </p>
          )}

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded border border-border" style={{ background: primary }} />
              <span className="font-mono text-[10px] text-[--text-muted]">{primary}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded border border-border" style={{ background: secondary }} />
              <span className="font-mono text-[10px] text-[--text-muted]">{secondary}</span>
            </div>
          </div>

          {kit.font_family && (
            <div>
              <p className="eyebrow">Typography</p>
              <p
                className="text-base font-semibold text-foreground mt-1"
                style={{ fontFamily: kit.font_family }}
              >
                {kit.font_family} — Aa
              </p>
            </div>
          )}

          {[
            { label: 'Values',    items: kit.brand_values },
            { label: 'Aesthetic', items: kit.brand_aesthetic },
            { label: 'Voice',     items: kit.brand_tone_of_voice },
          ]
            .filter((row) => row.items && row.items.length > 0)
            .map((row) => (
              <div key={row.label}>
                <p className="eyebrow mb-1">{row.label}</p>
                <div className="flex flex-wrap gap-1">
                  {row.items!.slice(0, 4).map((item) => (
                    <span
                      key={item}
                      className="ed-tag"
                    >
                      {item}
                    </span>
                  ))}
                  {row.items!.length > 4 && (
                    <span className="font-mono text-[10px] text-[--text-muted] self-center">
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
