'use client'

import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'

interface AddFromUrlModalProps<TDraft> {
  open: boolean
  onClose: () => void
  onScrape: (url: string) => Promise<TDraft>
  onConfirm: (draft: TDraft) => Promise<void> | void
  /** Render preview of the draft. */
  renderPreview: (draft: TDraft, setDraft: (d: TDraft) => void) => React.ReactNode
  title?: string
  placeholder?: string
}

/**
 * Modale générique « Add from URL » réutilisée par Catalog et Assets.
 * Workflow : URL → scrape → preview éditable → confirm.
 *
 * Gestion des erreurs du scraper : message lisible et possibilité de
 * réessayer ou d'abandonner (l'utilisateur peut quand même créer
 * manuellement via le formulaire from-scratch).
 */
export function AddFromUrlModal<TDraft>({
  open,
  onClose,
  onScrape,
  onConfirm,
  renderPreview,
  title,
  placeholder = 'https://…',
}: AddFromUrlModalProps<TDraft>) {
  const { t } = useLanguage()
  const [url, setUrl] = useState('')
  const [draft, setDraft] = useState<TDraft | null>(null)
  const [phase, setPhase] = useState<'idle' | 'scraping' | 'confirming' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!open) return null

  async function handleScrape() {
    if (!url.trim()) return
    setPhase('scraping')
    setErrorMsg(null)
    try {
      const result = await onScrape(url.trim())
      setDraft(result)
      setPhase('idle')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('bk_url_scrapeFailed'))
      setPhase('error')
    }
  }

  async function handleConfirm() {
    if (!draft) return
    setPhase('confirming')
    try {
      await onConfirm(draft)
      reset()
      onClose()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('bk_saveFailed'))
      setPhase('error')
    }
  }

  function reset() {
    setUrl('')
    setDraft(null)
    setPhase('idle')
    setErrorMsg(null)
  }

  function closeAndReset() {
    reset()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="font-display text-base font-semibold text-foreground">{title ?? t('bk_cat_addFromUrl')}</h3>
          <button type="button" onClick={closeAndReset} aria-label={t('close')} className="text-[--text-muted] hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!draft && (
            <>
              <div className="space-y-2">
                <label className="font-mono text-[10px] uppercase tracking-wider text-[--text-muted]">URL</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={placeholder}
                  disabled={phase === 'scraping'}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void handleScrape()
                    }
                  }}
                  className="w-full rounded-xl border border-border bg-muted px-3 py-2 font-body text-sm text-foreground placeholder-[--text-muted] outline-none focus:border-blue-500/60 transition-colors"
                />
              </div>
              {errorMsg && (
                <p className="font-body text-xs text-error">{errorMsg}</p>
              )}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={closeAndReset} className="font-mono text-xs text-[--text-muted] hover:text-foreground px-3 py-1.5">
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleScrape}
                  disabled={!url.trim() || phase === 'scraping'}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg bg-foreground text-background font-display text-xs font-medium px-3 py-1.5',
                    (!url.trim() || phase === 'scraping') && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  {phase === 'scraping' && <Loader2 size={12} className="animate-spin" />}
                  {t('bk_url_fetch')}
                </button>
              </div>
            </>
          )}

          {draft && (
            <>
              {renderPreview(draft, setDraft)}
              {errorMsg && (
                <p className="font-body text-xs text-error">{errorMsg}</p>
              )}
              <div className="flex justify-between gap-2">
                <button
                  type="button"
                  onClick={() => { setDraft(null); setUrl('') }}
                  className="font-mono text-xs text-[--text-muted] hover:text-foreground px-3 py-1.5"
                >
                  ← {t('bk_url_differentUrl')}
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={closeAndReset} className="font-mono text-xs text-[--text-muted] hover:text-foreground px-3 py-1.5">
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={phase === 'confirming'}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg bg-foreground text-background font-display text-xs font-medium px-3 py-1.5',
                      phase === 'confirming' && 'opacity-50 cursor-not-allowed',
                    )}
                  >
                    {phase === 'confirming' && <Loader2 size={12} className="animate-spin" />}
                    {t('bk_url_addToCatalog')}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
