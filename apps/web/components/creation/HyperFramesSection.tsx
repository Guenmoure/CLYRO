'use client'

import React from 'react'
import { cn } from '@/lib/utils'

/**
 * HyperFrames enrichment picker — checkbox + 5-template grid with inline
 * SVG previews + brand color picker. Used by the Studio wizard.
 *
 * Pure presentational : no API calls, all state lifted to the parent.
 * The previews are inline SVG so the bundle stays small (no GIFs / images).
 */

export type HFTemplate =
  | 'avatar-lower-third'
  | 'avatar-intro-card'
  | 'avatar-pip'
  | 'avatar-tiktok'
  | 'avatar-instagram'
  | 'avatar-logo-outro'

const TEMPLATES: readonly HFTemplate[] = [
  'avatar-lower-third',
  'avatar-intro-card',
  'avatar-pip',
  'avatar-tiktok',
  'avatar-instagram',
  'avatar-logo-outro',
]

// i18n key map for template name + description
const TEMPLATE_KEYS: Record<HFTemplate, { name: string; desc: string }> = {
  'avatar-lower-third': { name: 'sn_hf_tpl_lower_third_name', desc: 'sn_hf_tpl_lower_third_desc' },
  'avatar-intro-card':  { name: 'sn_hf_tpl_intro_card_name',  desc: 'sn_hf_tpl_intro_card_desc'  },
  'avatar-pip':         { name: 'sn_hf_tpl_pip_name',         desc: 'sn_hf_tpl_pip_desc'         },
  'avatar-tiktok':      { name: 'sn_hf_tpl_tiktok_name',      desc: 'sn_hf_tpl_tiktok_desc'      },
  'avatar-instagram':   { name: 'sn_hf_tpl_instagram_name',   desc: 'sn_hf_tpl_instagram_desc'   },
  'avatar-logo-outro':  { name: 'sn_hf_tpl_logo_outro_name',  desc: 'sn_hf_tpl_logo_outro_desc'  },
}

interface Props {
  enabled:           boolean
  onToggle:          (v: boolean) => void
  template:          HFTemplate
  onTemplateChange:  (t: HFTemplate) => void
  brandColor:        string
  onBrandColorChange: (c: string) => void
  /** Translation function from useLanguage(). Untyped on purpose so callers
   *  pass `t as any` if their type system doesn't enumerate sn_hf_* keys. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: any) => string
}

export function HyperFramesSection({
  enabled, onToggle,
  template, onTemplateChange,
  brandColor, onBrandColorChange,
  t,
}: Props) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-border accent-blue-500 cursor-pointer"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-display text-sm font-semibold text-foreground">
              {t('sn_hf_section_title')}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-blue-500/10 text-blue-500 border border-blue-500/20">
              {t('sn_hf_section_badge')}
            </span>
          </div>
          <p className="mt-1 text-xs text-[--text-muted] leading-relaxed">
            {t('sn_hf_section_desc')}
          </p>
        </div>
      </label>

      {enabled && (
        <div className="space-y-3 pt-2 pl-7 border-l-2 border-blue-500/20">
          {/* Template picker — 5 cards in a 2-col grid (3 on lg). Each card
              shows an inline SVG preview that hints at the visual style. */}
          <div>
            <label className="block font-mono text-xs uppercase tracking-wider text-[--text-muted] mb-2">
              {t('sn_hf_template_label')}
            </label>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {TEMPLATES.map((tpl) => {
                const keys = TEMPLATE_KEYS[tpl]
                const selected = template === tpl
                return (
                  <button
                    key={tpl}
                    type="button"
                    onClick={() => onTemplateChange(tpl)}
                    className={cn(
                      'rounded-xl border p-3 text-left transition-all flex flex-col gap-2',
                      selected
                        ? 'border-blue-500 bg-blue-500/5 ring-1 ring-blue-500/20'
                        : 'border-border bg-background hover:border-border/80',
                    )}
                  >
                    <TemplatePreview template={tpl} brandColor={brandColor} />
                    <div>
                      <div className="font-display text-sm font-semibold text-foreground">
                        {t(keys.name)}
                      </div>
                      <div className="mt-1 text-[11px] text-[--text-muted] leading-snug">
                        {t(keys.desc)}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Brand color picker */}
          <div>
            <label className="block font-mono text-xs uppercase tracking-wider text-[--text-muted] mb-2">
              {t('sn_hf_brand_color_label')}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={brandColor}
                onChange={(e) => onBrandColorChange(e.target.value)}
                className="h-10 w-14 rounded-lg border border-border bg-transparent cursor-pointer"
                title="Brand color"
              />
              <input
                type="text"
                value={brandColor}
                onChange={(e) => {
                  const v = e.target.value
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) onBrandColorChange(v)
                }}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-blue-500/60"
                placeholder="#3B8EF0"
                maxLength={7}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Inline SVG preview for each template — schematic representation that
 *  uses the live brandColor so the user sees their color choice applied. */
function TemplatePreview({ template, brandColor }: { template: HFTemplate; brandColor: string }) {
  const c = brandColor
  const dark = darkenHex(c, 0.7)

  switch (template) {
    case 'avatar-lower-third':
      return (
        <svg viewBox="0 0 160 90" className="w-full h-auto rounded-lg bg-neutral-900" aria-hidden>
          {/* avatar full bleed */}
          <rect width="160" height="90" fill="#1a1a22" />
          <circle cx="80" cy="42" r="20" fill="#3a3a4a" />
          <rect x="65" y="60" width="30" height="14" rx="2" fill="#2a2a35" />
          {/* lower-third bar */}
          <rect x="10" y="68" width="3" height="14" rx="1" fill={c} />
          <rect x="17" y="69" width="48" height="3" rx="1" fill="white" opacity="0.92" />
          <rect x="17" y="75" width="32" height="2" rx="1" fill="white" opacity="0.6" />
          {/* caption ribbon top */}
          <rect x="50" y="6" width="60" height="10" rx="5" fill="black" opacity="0.55" stroke="white" strokeOpacity="0.1" />
          <circle cx="58" cy="11" r="1.5" fill={c} />
        </svg>
      )

    case 'avatar-intro-card':
      return (
        <svg viewBox="0 0 160 90" className="w-full h-auto rounded-lg" style={{ background: `linear-gradient(135deg, ${c}30 0%, ${dark}50 100%)` }} aria-hidden>
          <rect width="160" height="90" fill="url(#bgGrad)" opacity="0.8" />
          <defs>
            <radialGradient id="bgGrad">
              <stop offset="0%" stopColor={c} stopOpacity="0.4" />
              <stop offset="100%" stopColor="#1a1a22" stopOpacity="0.95" />
            </radialGradient>
          </defs>
          {/* card */}
          <rect x="36" y="22" width="88" height="50" rx="6" fill="#1a1a22" stroke="white" strokeOpacity="0.08" />
          <circle cx="80" cy="44" r="12" fill="#3a3a4a" />
          <rect x="68" y="58" width="24" height="8" rx="1" fill="#2a2a35" />
          {/* top label */}
          <rect x="60" y="6" width="40" height="3" rx="1" fill="white" opacity="0.92" />
          <rect x="68" y="11" width="24" height="4" rx="2" fill={c} />
          {/* bottom quote */}
          <rect x="40" y="78" width="80" height="8" rx="3" fill="white" opacity="0.06" stroke="white" strokeOpacity="0.1" />
          <text x="44" y="85" fontSize="6" fontWeight="900" fill={c}>"</text>
        </svg>
      )

    case 'avatar-pip':
      return (
        <svg viewBox="0 0 160 90" className="w-full h-auto rounded-lg" aria-hidden>
          <defs>
            <radialGradient id="pipBg">
              <stop offset="0%" stopColor={c} stopOpacity="0.25" />
              <stop offset="100%" stopColor="#0a0a14" stopOpacity="1" />
            </radialGradient>
          </defs>
          <rect width="160" height="90" fill="url(#pipBg)" />
          {/* grid pattern hint */}
          <line x1="0" y1="22" x2="160" y2="22" stroke={c} strokeOpacity="0.08" />
          <line x1="0" y1="45" x2="160" y2="45" stroke={c} strokeOpacity="0.08" />
          <line x1="0" y1="68" x2="160" y2="68" stroke={c} strokeOpacity="0.08" />
          <line x1="40" y1="0" x2="40" y2="90" stroke={c} strokeOpacity="0.08" />
          <line x1="80" y1="0" x2="80" y2="90" stroke={c} strokeOpacity="0.08" />
          <line x1="120" y1="0" x2="120" y2="90" stroke={c} strokeOpacity="0.08" />
          {/* big text on the left */}
          <rect x="10" y="32" width="22" height="3" rx="1" fill={c} />
          <rect x="10" y="40" width="68" height="6" rx="1" fill="white" opacity="0.95" />
          <rect x="10" y="50" width="56" height="6" rx="1" fill="white" opacity="0.95" />
          <rect x="10" y="62" width="48" height="2" rx="1" fill="white" opacity="0.6" />
          <rect x="10" y="67" width="40" height="2" rx="1" fill="white" opacity="0.6" />
          {/* PIP card top-right */}
          <rect x="115" y="10" width="35" height="35" rx="4" fill="#3a3a4a" stroke={c} strokeWidth="1.5" />
          <circle cx="132" cy="25" r="6" fill="#5a5a6a" />
          <rect x="124" y="34" width="16" height="6" rx="1" fill="#5a5a6a" />
        </svg>
      )

    case 'avatar-tiktok':
      return (
        <svg viewBox="0 0 90 90" className="w-full h-auto rounded-lg bg-neutral-900" aria-hidden>
          {/* avatar full bleed (vertical-ish hint) */}
          <rect width="90" height="90" fill="#1a1a22" />
          <circle cx="45" cy="38" r="14" fill="#3a3a4a" />
          <rect x="36" y="50" width="18" height="10" rx="2" fill="#2a2a35" />
          {/* side brand bar */}
          <rect x="3" y="32" width="2" height="26" rx="1" fill={c} />
          {/* top live pill */}
          <rect x="22" y="6" width="46" height="8" rx="4" fill="black" opacity="0.65" stroke="white" strokeOpacity="0.1" />
          <circle cx="29" cy="10" r="1.4" fill={c} />
          {/* karaoke captions */}
          <rect x="16" y="68" width="14" height="6" rx="2" fill="white" opacity="0.95" />
          <rect x="32" y="68" width="20" height="6" rx="2" fill={c} />
          <rect x="54" y="68" width="14" height="6" rx="2" fill="white" opacity="0.95" />
          <rect x="20" y="78" width="16" height="5" rx="2" fill="white" opacity="0.7" />
          <rect x="38" y="78" width="22" height="5" rx="2" fill="white" opacity="0.7" />
          <rect x="62" y="78" width="10" height="5" rx="2" fill="white" opacity="0.7" />
        </svg>
      )

    case 'avatar-instagram':
      return (
        <svg viewBox="0 0 160 90" className="w-full h-auto rounded-lg" style={{ background: 'radial-gradient(ellipse at center, #232529 0%, #0e0f12 100%)' }} aria-hidden>
          {/* fake instagram post card */}
          <rect x="40" y="6" width="80" height="78" rx="6" fill="white" />
          {/* header */}
          <circle cx="48" cy="13" r="3.5" fill={c} />
          <rect x="54" y="11" width="28" height="2" rx="1" fill="#222" />
          <circle cx="84" cy="12.5" r="1.5" fill="#1d9bf0" />
          <rect x="54" y="15" width="20" height="1.5" rx="0.7" fill="#888" />
          {/* media area = avatar */}
          <rect x="40" y="20" width="80" height="50" fill="#222" />
          <circle cx="80" cy="42" r="11" fill="#3a3a4a" />
          <rect x="71" y="54" width="18" height="8" rx="2" fill="#2a2a35" />
          {/* footer actions */}
          <text x="46" y="78" fontSize="6" fill="#222">{'♡'}</text>
          <text x="55" y="78" fontSize="5" fill="#222">{'\u{1F4AC}'}</text>
          <text x="65" y="78" fontSize="5" fill="#222">{'➜'}</text>
          <rect x="46" y="80" width="34" height="1.6" rx="0.5" fill="#222" />
          <rect x="46" y="82.5" width="58" height="1.2" rx="0.5" fill={c} opacity="0.7" />
        </svg>
      )

    case 'avatar-logo-outro':
      return (
        <svg viewBox="0 0 160 90" className="w-full h-auto rounded-lg" aria-hidden>
          <defs>
            <radialGradient id="outroBg">
              <stop offset="0%" stopColor={c} stopOpacity="0.35" />
              <stop offset="100%" stopColor="#050507" stopOpacity="1" />
            </radialGradient>
            <linearGradient id="outroMark" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={c} />
              <stop offset="100%" stopColor={dark} />
            </linearGradient>
          </defs>
          {/* radial brand bg */}
          <rect width="160" height="90" fill="url(#outroBg)" />
          {/* faint grain hint */}
          <rect width="160" height="90" fill={c} opacity="0.04" />
          {/* logo medallion (centered, slightly above midline) */}
          <circle cx="80" cy="32" r="11" fill="url(#outroMark)" />
          <rect x="76" y="27" width="8" height="10" rx="1" fill="white" opacity="0.95" />
          {/* big project name */}
          <rect x="40" y="49" width="80" height="6" rx="1" fill="white" opacity="0.95" />
          {/* tagline */}
          <rect x="52" y="60" width="56" height="2.5" rx="1" fill="white" opacity="0.6" />
          {/* CTA pill at bottom */}
          <rect x="58" y="72" width="44" height="9" rx="4.5" fill="white" opacity="0.06" stroke="white" strokeOpacity="0.18" />
          <circle cx="65" cy="76.5" r="1.4" fill={c} />
          <rect x="70" y="75" width="26" height="3" rx="1" fill="white" opacity="0.85" />
        </svg>
      )
  }
}

function darkenHex(hex: string, factor = 0.7): string {
  const m = hex.match(/^#([0-9A-Fa-f]{6})$/)
  if (!m) return hex
  const v = parseInt(m[1]!, 16)
  const r = Math.max(0, Math.min(255, Math.round(((v >> 16) & 0xff) * factor)))
  const g = Math.max(0, Math.min(255, Math.round(((v >> 8) & 0xff) * factor)))
  const b = Math.max(0, Math.min(255, Math.round((v & 0xff) * factor)))
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`
}
