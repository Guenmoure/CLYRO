'use client'

import { useState } from 'react'
import { useLanguage } from '@/lib/i18n'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

interface Connection {
  id: string
  name: string
  description: string
  iconBg: string
  iconComponent: React.ReactNode
  status: 'available' | 'coming'
}

const CONNECTIONS: Connection[] = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Get notified when your videos are ready, directly in your channel of choice.',
    iconBg: 'bg-[#4A154B]',
    iconComponent: <span className="text-white font-display font-black text-base">S</span>,
    status: 'coming',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    description: 'Publish your Faceless and Motion videos directly to your YouTube channel in one click.',
    iconBg: 'bg-red-600',
    iconComponent: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor" aria-hidden="true">
        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
    status: 'coming',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Share your videos and brand kit directly to your LinkedIn profile or company page.',
    iconBg: 'bg-[#0A66C2]',
    iconComponent: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor" aria-hidden="true">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
    status: 'coming',
  },
]

export function ConnectionsSection() {
  const { t } = useLanguage()
  const [pending, setPending] = useState<string | null>(null)

  async function handleConnect(id: string) {
    if (pending) return
    setPending(id)
    // Stub — backend connectors not yet wired
    setTimeout(() => {
      toast.info(`Connection ${id} — coming soon`)
      setPending(null)
    }, 300)
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">{t('connections')}</h2>
        <p className="font-body text-sm text-[--text-secondary] mt-1">
          Connect Clyro to your tools to publish and automate.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CONNECTIONS.map((c) => (
          <div
            key={c.id}
            className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5 transition-all hover:border-border"
          >
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', c.iconBg)}>
              {c.iconComponent}
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-display font-semibold text-foreground">{c.name}</p>
                {c.status === 'coming' && (
                  <span className="shrink-0 inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-[--text-muted]">
                    {t('connectionSoon')}
                  </span>
                )}
              </div>
              <p className="font-body text-xs text-[--text-secondary] leading-relaxed">
                {c.description}
              </p>
              <button
                type="button"
                onClick={() => handleConnect(c.id)}
                disabled={c.status === 'coming' || pending === c.id}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-display font-semibold transition-colors',
                  c.status === 'coming'
                    ? 'border border-border bg-background text-[--text-muted] cursor-not-allowed opacity-70'
                    : 'bg-foreground text-background hover:opacity-90',
                )}
              >
                {c.status === 'coming' ? t('connectionSoon') : 'Connect'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="font-body text-xs text-[--text-muted]">
        Need another integration? Contact us at{' '}
        <a href="mailto:support@clyro.app" className="text-blue-500 hover:underline">support@clyro.app</a>.
      </p>
    </div>
  )
}
