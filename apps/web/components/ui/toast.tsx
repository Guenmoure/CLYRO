'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
}

// ── Singleton store (simple, sans Context pour garder les dépendances légères) ──

type Listener = (toasts: Toast[]) => void
let toasts: Toast[] = []
const listeners = new Set<Listener>()

// Errors stay visible longer so users have time to read them.
const DEFAULT_DURATION = 4000
const ERROR_DURATION = 8000

function notify() {
  listeners.forEach((l) => l([...toasts]))
}

function dismiss(id: string) {
  toasts = toasts.filter((t) => t.id !== id)
  notify()
}

export function toast(message: string, type: ToastType = 'info', duration?: number) {
  const id = Math.random().toString(36).slice(2)
  toasts = [...toasts, { id, message, type }]
  notify()

  const ms = duration ?? (type === 'error' ? ERROR_DURATION : DEFAULT_DURATION)
  setTimeout(() => dismiss(id), ms)
}

toast.success = (msg: string, opts?: { duration?: number }) => toast(msg, 'success', opts?.duration)
toast.error   = (msg: string, opts?: { duration?: number }) => toast(msg, 'error', opts?.duration)
toast.info    = (msg: string, opts?: { duration?: number }) => toast(msg, 'info', opts?.duration)

// ── Composant Toaster ────────────────────────────────────────────────────────

export function Toaster() {
  const { t } = useLanguage()
  const [items, setItems] = useState<Toast[]>([])

  useEffect(() => {
    listeners.add(setItems)
    return () => { listeners.delete(setItems) }
  }, [])

  if (items.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm">
      {items.map((item) => (
        <div
          key={item.id}
          role={item.type === 'error' ? 'alert' : 'status'}
          aria-live={item.type === 'error' ? 'assertive' : 'polite'}
          className={cn(
            'flex items-start gap-3 px-4 py-3 rounded-xl border bg-card text-sm font-body shadow-lg animate-fade-in',
            item.type === 'success' && 'border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
            item.type === 'error'   && 'border-red-500/30 text-red-700 dark:text-red-300',
            item.type === 'info'    && 'border-brand/30 text-brand dark:text-violet-300'
          )}
        >
          <span className="shrink-0 mt-0.5" aria-hidden="true">
            {item.type === 'success' && '✓'}
            {item.type === 'error'   && '✕'}
            {item.type === 'info'    && 'ℹ'}
          </span>
          <span className="flex-1">{item.message}</span>
          <button
            type="button"
            onClick={() => dismiss(item.id)}
            aria-label={t('close')}
            className="shrink-0 -mr-1 mt-0.5 w-5 h-5 rounded flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
