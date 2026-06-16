'use client'

import { useEffect, useState } from 'react'
import {
  Loader2, Link as LinkIcon, ExternalLink, Copy, RefreshCw, ShieldOff, Globe,
} from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'

interface ShareLinkModalProps {
  isOpen: boolean
  onClose: () => void
  videoId: string
}

// ── Helper: build absolute URL on the client (window.origin) ─────────
function buildShareUrl(token: string): string {
  if (typeof window === 'undefined') return `/share/${token}`
  return `${window.location.origin}/share/${token}`
}

export function ShareLinkModal({ isOpen, onClose, videoId }: ShareLinkModalProps) {
  const { t } = useLanguage()

  const [token,    setToken]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [working,  setWorking]  = useState(false)        // mint / rotate / revoke in flight
  const [loadErr,  setLoadErr]  = useState(false)

  // Load current share state when the modal opens.
  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    setLoadErr(false)
    setToken(null)

    let cancelled = false
    fetch(`/api/videos/${videoId}/share`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error('load')
        const json = await res.json() as { share_token: string | null }
        if (!cancelled) setToken(json.share_token ?? null)
      })
      .catch(() => { if (!cancelled) setLoadErr(true) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [isOpen, videoId])

  async function handleActivate() {
    if (working) return
    setWorking(true)
    try {
      const res = await fetch(`/api/videos/${videoId}/share`, {
        method:      'POST',
        credentials: 'include',
      })
      if (!res.ok) throw new Error()
      const { share_token } = await res.json() as { share_token: string }
      setToken(share_token)
    } catch {
      toast.error(t('share_activateError'))
    } finally {
      setWorking(false)
    }
  }

  async function handleRotate() {
    if (working) return
    setWorking(true)
    try {
      const res = await fetch(`/api/videos/${videoId}/share?rotate=1`, {
        method:      'POST',
        credentials: 'include',
      })
      if (!res.ok) throw new Error()
      const { share_token } = await res.json() as { share_token: string }
      setToken(share_token)
      toast.success(t('share_rotated'))
    } catch {
      toast.error(t('share_activateError'))
    } finally {
      setWorking(false)
    }
  }

  async function handleRevoke() {
    if (working) return
    setWorking(true)
    try {
      const res = await fetch(`/api/videos/${videoId}/share`, {
        method:      'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error()
      setToken(null)
      toast.success(t('share_revoked'))
    } catch {
      toast.error(t('share_revokeError'))
    } finally {
      setWorking(false)
    }
  }

  async function handleCopy() {
    if (!token) return
    try {
      await navigator.clipboard.writeText(buildShareUrl(token))
      toast.success(t('share_copied'))
    } catch {
      // Older browsers / insecure context: fall back silently.
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('share_title')} size="md">
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-[--text-muted]">
          <Loader2 size={14} className="animate-spin" />
          <span>{t('move_loading') /* reuse loading copy */}</span>
        </div>
      ) : loadErr ? (
        <p className="font-body text-sm text-error py-6 text-center">
          {t('share_loadError')}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="font-body text-sm text-[--text-secondary]">
            {t('share_intro')}
          </p>

          {/* State row */}
          <div className={cn(
            'flex items-center gap-3 rounded-xl border p-3',
            token
              ? 'border-success/30 bg-success/5'
              : 'border-border bg-muted/30',
          )}>
            <div className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
              token ? 'bg-success/15 text-success' : 'bg-muted text-[--text-muted]',
            )}>
              {token ? <Globe size={16} /> : <ShieldOff size={16} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display text-sm font-semibold text-foreground">
                {token ? t('share_on') : t('share_off')}
              </p>
              {!token && (
                <p className="font-body text-xs text-[--text-muted]">
                  {t('share_offHelp')}
                </p>
              )}
            </div>
            {token && <Badge variant="success">{t('share_live')}</Badge>}
          </div>

          {/* Link row + copy / open */}
          {token && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
                <LinkIcon size={14} className="text-[--text-muted] shrink-0" />
                <input
                  type="text"
                  readOnly
                  value={buildShareUrl(token)}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 min-w-0 bg-transparent border-0 font-mono text-xs text-foreground focus:outline-none truncate"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 font-mono text-[11px] text-foreground hover:bg-muted transition-colors"
                  aria-label={t('share_copy')}
                >
                  <Copy size={11} /> {t('share_copy')}
                </button>
                <a
                  href={buildShareUrl(token)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 font-mono text-[11px] text-foreground hover:bg-muted transition-colors"
                  aria-label={t('share_open')}
                >
                  <ExternalLink size={11} /> {t('share_open')}
                </a>
              </div>
              <p className="font-mono text-[10px] text-[--text-muted] px-1">
                ⚠ {t('share_warning')}
              </p>
            </div>
          )}

          {/* Action footer */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40 mt-2">
            {!token && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleActivate}
                disabled={working}
              >
                {working && <Loader2 size={14} className="animate-spin" />}
                {t('share_activate')}
              </Button>
            )}
            {token && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRotate}
                  disabled={working}
                  title={t('share_rotate')}
                >
                  <RefreshCw size={14} /> {t('share_rotate')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRevoke}
                  disabled={working}
                >
                  {working && <Loader2 size={14} className="animate-spin" />}
                  {t('share_revoke')}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
