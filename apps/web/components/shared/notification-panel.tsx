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
    title: 'Paiement échoué',
    body: "Le renouvellement de ton abonnement **Creator** n'a pas pu être traité. Vérifie ta carte.",
    time: 'Il y a 2h',
    read: false,
    cta: { label: 'Voir mon plan', href: '/settings' },
  },
  {
    id: '2',
    type: 'update',
    title: 'Nouveau — ElevenLabs v2.5',
    body: 'La synthèse vocale est maintenant 2× plus rapide avec le modèle eleven_turbo_v2_5.',
    time: 'Il y a 1j',
    read: false,
  },
  {
    id: '3',
    type: 'success',
    title: 'Vidéo prête',
    body: 'Ta vidéo **"Motivation 60s"** a été générée avec succès.',
    time: 'Il y a 2j',
    read: true,
    cta: { label: 'Voir la vidéo', href: '/projects' },
  },
  {
    id: '4',
    type: 'info',
    title: 'Mise à jour CLYRO v1.2',
    body: 'Dark mode, pipeline voix, et nouveau hub Faceless disponibles.',
    time: 'Il y a 3j',
    read: true,
  },
  {
    id: '5',
    type: 'payment_failed',
    title: 'Paiement échoué',
    body: "Deuxième tentative de débit échouée sur ton abonnement **Creator**.",
    time: 'Il y a 4j',
    read: true,
    cta: { label: 'Mettre à jour', href: '/settings' },
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
  { key: 'all',      label: 'Toutes' },
  { key: 'updates',  label: 'Mises à jour', types: ['update', 'info', 'success'] },
  { key: 'payments', label: 'Paiements',    types: ['payment_failed'] },
]

function renderBody(text: string) {
  return text.split(/\*\*(.*?)\*\*/).map((part, i) =>
    i % 2 === 1
      ? <strong key={i} className="font-semibold text-foreground">{part}</strong>
      : <span key={i}>{part}</span>
  )
}

export function NotificationPanel() {
  const [open, setOpen]   = useState(false)
  const [tab, setTab]     = useState<Tab>('all')
  const [notifs, setNotifs] = useState(MOCK_NOTIFICATIONS)
  const ref = useRef<HTMLDivElement>(null)

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
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
  }

  function dismiss(id: string) {
    setNotifs(prev => prev.filter(n => n.id !== id))
  }

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen(v => !v)}
        className="relative w-9 h-9 rounded-xl glass glass-hover flex items-center justify-center text-[--text-muted] hover:text-foreground transition-colors duration-200"
      >
        <Bell size={15} strokeWidth={1.6} />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full" />
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-11 w-[360px] bg-navy-800 border border-navy-700 rounded-2xl shadow-xl overflow-hidden z-50">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-navy-700">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Notifications</span>
              {unread > 0 && (
                <span className="text-[10px] font-bold text-white bg-error rounded-full px-1.5 py-0.5 leading-none">
                  {unread}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={markAllRead}
              className="text-[11px] text-purple-400 hover:text-purple-300 font-medium transition-colors"
            >
              Tout marquer lu
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-navy-700 px-4">
            {TABS.map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`text-xs font-medium py-2.5 mr-5 border-b-2 transition-colors ${
                  tab === t.key
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-[--text-muted] hover:text-[--text-secondary]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto divide-y divide-navy-700">
            {filtered.length === 0 ? (
              <div className="py-12 text-center">
                <Bell size={24} className="text-navy-600 mx-auto mb-2" />
                <p className="text-sm text-[--text-muted]">Aucune notification</p>
              </div>
            ) : (
              filtered.map(n => {
                const meta = TYPE_META[n.type]
                return (
                  <div
                    key={n.id}
                    className={`relative flex gap-3 px-4 py-3.5 ${!n.read ? 'bg-navy-900/50' : ''}`}
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
                        <span className="text-[10px] text-[--text-muted] shrink-0 whitespace-nowrap">{n.time}</span>
                      </div>
                      <p className="text-xs text-[--text-muted] mt-0.5 leading-relaxed">
                        {renderBody(n.body)}
                      </p>
                      {n.cta && (
                        <a
                          href={n.cta.href}
                          className="inline-block mt-2 text-[11px] font-semibold text-purple-400 hover:text-purple-300 transition-colors"
                        >
                          {n.cta.label} →
                        </a>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => dismiss(n.id)}
                      aria-label="Supprimer"
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
          <div className="px-4 py-3 border-t border-navy-700 text-center">
            <a
              href="/settings"
              className="text-[11px] text-[--text-muted] hover:text-purple-400 transition-colors font-medium"
            >
              Gérer les préférences de notification
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
