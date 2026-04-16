'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, X, CreditCard, Zap, CheckCircle, Info } from 'lucide-react'

type NotifType = 'payment_failed' | 'update' | 'success' | 'info'
type Tab = 'all' | 'updates' | 'payments'

interface Notification {
  id: string
  type: NotifType
  title: string
  body: string
  time: string
  read: boolean
  cta?: { label: string; href: string }
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'payment_failed',
    title: 'Payment failed',
    body: "Your **Creator** subscription renewal could not be processed. Verify your card.",
    time: '2h ago',
    read: false,
    cta: { label: 'View my plan', href: '/settings' },
  },
  {
    id: '2',
    type: 'update',
    title: 'New — ElevenLabs v2.5',
    body: 'Voice synthesis is now 2× faster with the eleven_turbo_v2_5 model.',
    time: '1d ago',
    read: false,
  },
  {
    id: '3',
    type: 'success',
    title: 'Video ready',
    body: 'Your video **"Motivation 60s"** has been generated successfully.',
    time: '2d ago',
    read: true,
    cta: { label: 'View video', href: '/projects' },
  },
  {
    id: '4',
    type: 'info',
    title: 'CLYRO v1.2 Update',
    body: 'Dark mode, voice pipeline, and new Faceless hub now available.',
    time: '3d ago',
    read: true,
  },
  {
    id: '5',
    type: 'payment_failed',
    title: 'Payment failed',
    body: "Second payment attempt failed on your **Creator** subscription.",
    time: '4d ago',
    read: true,
    cta: { label: 'Update', href: '/settings' },
  },
]

const TYPE_META: Record<NotifType, { icon: React.ReactNode; color: string; bg: string }> = {
  payment_failed: {
    icon: <CreditCard size={14} strokeWidth={1.8} />,
    color: 'text-error',
    bg: 'bg-error/10',
  },
  update: {
    icon: <Zap size={14} strokeWidth={1.8} />,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
  },
  success: {
    icon: <CheckCircle size={14} strokeWidth={1.8} />,
    color: 'text-success',
    bg: 'bg-success/10',
  },
  info: {
    icon: <Info size={14} strokeWidth={1.8} />,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
}

const TABS: { key: Tab; label: string; types?: NotifType[] }[] = [
  { key: 'all',      label: 'All' },
  { key: 'updates',  label: 'Updates', types: ['update', 'info', 'success'] },
  { key: 'payments', label: 'Payments',    types: ['payment_failed'] },
]

function renderBody(text: string) {
  return text.split(/\*\*(.*?)\*\*/).map((part, i) =>
    i % 2 === 1
      ? <strong key={i} className="font-semibold text-foreground">{part}</strong>
      : <span key={i}>{part}</span>
  )
}

const STORAGE_KEY = 'clyro:notifs:dismissed'
const READ_KEY    = 'clyro:notifs:read'

function loadDismissed(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')) } catch { return new Set() }
}
function saveDismissed(ids: Set<string>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids])) } catch {}
}
function loadRead(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? '[]')) } catch { return new Set() }
}
function saveRead(ids: Set<string>) {
  try { localStorage.setItem(READ_KEY, JSON.stringify([...ids])) } catch {}
}

export function NotificationPanel() {
  const [open, setOpen]   = useState(false)
  const [tab, setTab]     = useState<Tab>('all')
  const [notifs, setNotifs] = useState<Notification[]>([])
  const ref = useRef<HTMLDivElement>(null)

  // Hydrate from localStorage on mount
  useEffect(() => {
    const dismissed = loadDismissed()
    const read      = loadRead()
    setNotifs(
      MOCK_NOTIFICATIONS
        .filter(n => !dismissed.has(n.id))
        .map(n => ({ ...n, read: n.read || read.has(n.id) }))
    )
  }, [])

  const unread = notifs.filter(n => !n.read).length

  const tabDef    = TABS.find(t => t.key === tab)!
  const filtered  = tabDef.types
    ? notifs.filter(n => tabDef.types!.includes(n.type))
    : notifs

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function markAllRead() {
    setNotifs(prev => {
      const updated = prev.map(n => ({ ...n, read: true }))
      saveRead(new Set(updated.map(n => n.id)))
      return updated
    })
  }

  function dismiss(id: string) {
    setNotifs(prev => {
      const next = prev.filter(n => n.id !== id)
      const dismissed = loadDismissed()
      dismissed.add(id)
      saveDismissed(dismissed)
      return next
    })
  }

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen(v => !v)}
        className="relative w-9 h-9 rounded-xl glass glass-hover flex items-center justify-center text-[--text-secondary] hover:text-foreground transition-colors duration-200"
      >
        <Bell size={15} strokeWidth={1.6} />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-error text-white text-[10px] font-mono font-bold flex items-center justify-center shadow ring-2 ring-background"
            aria-label={`${unread} unread notifications`}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-11 w-[360px] bg-card border border-border rounded-2xl shadow-xl overflow-hidden z-50">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Notifications</span>
              {unread > 0 && (
                <span className="text-[11px] font-bold text-white bg-error rounded-full px-1.5 py-0.5 leading-none">
                  {unread}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={markAllRead}
              className="text-[11px] text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium transition-colors"
            >
              Mark all as read
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border px-4">
            {TABS.map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`text-xs font-medium py-2.5 mr-5 border-b-2 transition-colors ${
                  tab === t.key
                    ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                    : 'border-transparent text-[--text-muted] hover:text-[--text-secondary]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto divide-y divide-border">
            {filtered.length === 0 ? (
              <div className="py-12 text-center">
                <Bell size={24} className="text-[--text-muted] mx-auto mb-2" />
                <p className="text-sm text-[--text-muted]">No notifications</p>
              </div>
            ) : (
              filtered.map(n => {
                const meta = TYPE_META[n.type]
                return (
                  <div
                    key={n.id}
                    className={`relative flex gap-3 px-4 py-3.5 ${!n.read ? 'bg-muted/50' : ''}`}
                  >
                    {!n.read && (
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-purple-500" />
                    )}

                    <div className={`w-8 h-8 rounded-xl ${meta.bg} ${meta.color} flex items-center justify-center shrink-0 mt-0.5`}>
                      {meta.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-foreground leading-snug">{n.title}</p>
                        <span className="text-[11px] text-[--text-muted] shrink-0 whitespace-nowrap">{n.time}</span>
                      </div>
                      <p className="text-xs text-[--text-muted] mt-0.5 leading-relaxed">
                        {renderBody(n.body)}
                      </p>
                      {n.cta && (
                        <a
                          href={n.cta.href}
                          className="inline-block mt-2 text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                        >
                          {n.cta.label} →
                        </a>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => dismiss(n.id)}
                      aria-label="Delete"
                      className="shrink-0 mt-0.5 text-[--text-muted] hover:text-foreground transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-border text-center">
            <a
              href="/settings"
              className="text-[11px] text-[--text-muted] hover:text-purple-600 dark:hover:text-purple-400 transition-colors font-medium"
            >
              Manage notification preferences
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
