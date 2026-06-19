'use client'

/**
 * Brand DNA inference panel — Audit 16/06/26 P3.2.
 *
 * Sits at the top of /brand and offers a single-line "Infer from URL"
 * shortcut: the user pastes a website URL, Claude reads it, the panel
 * shows a structured DNA preview (tagline / palette / values / tone /
 * overview). The user reviews + can click « Create brand kit » which
 * POSTs to /api/v1/brand-kits with the inferred values.
 *
 * UX choices
 *   • Collapsed by default — only a thin "Try AI inference" CTA row.
 *     Opening the panel reveals the input. Keeps the page list-first.
 *   • Cost hint « 5 credits » visible before the user submits.
 *   • Returns null fields show as placeholders so the user knows to
 *     edit them after creating the kit.
 *   • « Create brand kit » uses the existing brand-kits POST endpoint —
 *     no new persistence path, just a smarter starting point.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Globe, Sparkles, Loader2, Check, X, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'
import { inferBrandFromUrl, ApiError, type BrandDNAInference } from '@/lib/api'
import { createBrowserClient } from '@/lib/supabase'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

interface InferFromUrlPanelProps {
  /** Fired after a successful kit creation so the parent can refresh
   *  the list (or navigate). The new kit id is forwarded. */
  onKitCreated?: (kitId: string) => void
}

export function InferFromUrlPanel({ onKitCreated }: InferFromUrlPanelProps) {
  const { t } = useLanguage()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BrandDNAInference | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  async function handleInfer() {
    setError(null)
    setResult(null)
    if (!url.trim()) return
    setLoading(true)
    try {
      const dna = await inferBrandFromUrl(url.trim())
      setResult(dna)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'INSUFFICIENT_CREDITS')      setError(t('infer_err_no_credits'))
        else if (err.code === 'SCRAPE_FAILED')        setError(t('infer_err_scrape'))
        else if (err.code === 'VALIDATION_ERROR')     setError(t('infer_err_invalid_url'))
        else                                          setError(t('infer_err_generic'))
      } else {
        setError(t('infer_err_generic'))
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateKit() {
    if (!result) return
    setCreating(true)
    try {
      // POST to /api/v1/brand-kits with the inferred values. The shared
      // wrappers don't expose a creation helper today (the wizard route
      // does its own form-handling), so we fetch directly with the
      // user's Supabase access_token in the Authorization header.
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        setError(t('infer_err_generic'))
        return
      }
      const res = await fetch(`${API_BASE}/api/v1/brand-kits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({
          name:                result.source_title.slice(0, 80) || 'New brand kit',
          url:                 result.source_url,
          tagline:             result.tagline,
          primary_color:       result.primary_color ?? '#c45b3a',
          secondary_color:     result.secondary_color,
          brand_values:        result.brand_values,
          brand_aesthetic:     result.brand_aesthetic,
          brand_tone_of_voice: result.brand_tone_of_voice,
          business_overview:   result.business_overview,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const data = await res.json() as { id?: string; kit?: { id?: string } }
      const kitId = data.id ?? data.kit?.id
      if (kitId) {
        onKitCreated?.(kitId)
        router.push(`/brand/${kitId}/dna`)
      } else {
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('infer_err_generic'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="rounded-2xl border border-dashed border-border bg-card overflow-hidden">
      {/* Header — single row trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <Sparkles size={14} className="text-primary shrink-0" />
          <span className="min-w-0">
            <span className="block font-display text-sm font-semibold text-foreground">
              {t('infer_title')}
            </span>
            <span className="block font-body text-xs text-[--text-muted] truncate">
              {t('infer_subtitle')}
            </span>
          </span>
        </span>
        <span className="font-mono text-[10px] text-[--text-muted] shrink-0">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          {/* Input row */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--text-muted] pointer-events-none" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-brand.com"
                className="w-full rounded-xl border border-border bg-card pl-9 pr-3 py-2 text-sm font-body text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-primary transition-colors"
              />
            </div>
            <button
              type="button"
              disabled={loading || !url.trim()}
              onClick={handleInfer}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-foreground text-background font-display text-sm font-semibold',
                (loading || !url.trim()) && 'opacity-50 cursor-not-allowed',
              )}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {t('infer_cta')}
            </button>
            <span className="font-mono text-[10px] text-[--text-muted] ml-1">
              {t('infer_cost_hint')}
            </span>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-error/30 bg-error/5 px-3 py-2">
              <AlertCircle size={14} className="text-error shrink-0 mt-0.5" />
              <p className="font-body text-xs text-foreground">{error}</p>
            </div>
          )}

          {/* Result card */}
          {result && (
            <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[--text-muted]">
                {t('infer_result_label')} · {result.source_url}
              </p>

              {/* Tagline + business overview */}
              {result.tagline && (
                <p className="font-display text-sm italic text-foreground">
                  &ldquo;{result.tagline}&rdquo;
                </p>
              )}
              {result.business_overview && (
                <p className="font-body text-xs text-[--text-secondary] leading-snug">
                  {result.business_overview}
                </p>
              )}

              {/* Palette */}
              {(result.primary_color || result.secondary_color) && (
                <div className="flex items-center gap-3">
                  {result.primary_color && (
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-5 h-5 rounded-md border border-border" style={{ background: result.primary_color }} />
                      <span className="font-mono text-[10px] text-[--text-muted]">{result.primary_color}</span>
                    </div>
                  )}
                  {result.secondary_color && (
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-5 h-5 rounded-md border border-border" style={{ background: result.secondary_color }} />
                      <span className="font-mono text-[10px] text-[--text-muted]">{result.secondary_color}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Chip rows */}
              {([
                { label: t('infer_values'),    items: result.brand_values },
                { label: t('infer_aesthetic'), items: result.brand_aesthetic },
                { label: t('infer_tone'),      items: result.brand_tone_of_voice },
              ] as const)
                .filter((row) => row.items.length > 0)
                .map((row) => (
                  <div key={row.label}>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-[--text-muted] mb-1">
                      {row.label}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {row.items.map((it) => (
                        <span key={it} className="inline-flex items-center rounded-full bg-card border border-border px-2 py-0.5 font-mono text-[10px] text-foreground/80">
                          {it}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}

              {/* Apply */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={creating}
                  onClick={handleCreateKit}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white font-display text-sm font-semibold',
                    creating && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  {creating ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {t('infer_apply')}
                </button>
                <button
                  type="button"
                  onClick={() => { setResult(null); setUrl('') }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card font-display text-sm text-[--text-muted] hover:text-foreground transition-colors"
                >
                  <X size={13} />
                  {t('infer_discard')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
