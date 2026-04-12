'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

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

function notify() {
  listeners.forEach((l) => l([...toasts]))
}

export function toast(message: string, type: ToastType = 'info', duration: number = 4000) {
  const id = Math.random().toString(36).slice(2)
  toasts = [...toasts, { id, message, type }]
  notify()

  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    notify()
  }, duration)
}

toast.success = (msg: string, opts?: { duration?: number }) => toast(msg, 'success', opts?.duration ?? 4000)
toast.error   = (msg: string, opts?: { duration?: number }) => toast(msg, 'error', opts?.duration ?? 4000)
toast.info    = (msg: string, opts?: { duration?: number }) => toast(msg, 'info', opts?.duration ?? 4000)

// ── Composant Toaster ────────────────────────────────────────────────────────

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([])

  useEffect(() => {
    listeners.add(setItems)
    return () => { listeners.delete(setItems) }
  }, [])

  if (items.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            'flex items-start gap-3 px-4 py-3 rounded-xl border text-sm font-body shadow-lg animate-fade-in',
            t.type === 'success' && 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
            t.type === 'error'   && 'bg-red-500/10 border-red-500/20 text-red-300',
            t.type === 'info'    && 'bg-clyro-blue/10 border-clyro-blue/20 text-clyro-blue'
          )}
        >
          <span className="shrink-0 mt-0.5">
            {t.type === 'success' && '✓'}
            {t.type === 'error'   && '✕'}
            {t.type === 'info'    && 'ℹ'}
          </span>
          {t.message}
        </div>
      ))}
    </div>
  )
}
