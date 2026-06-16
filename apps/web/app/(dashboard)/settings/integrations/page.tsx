'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { useLanguage } from '@/lib/i18n'

// ── Types ───────────────────────────────────────────────────────────────────────

type IntegrationStatus = 'Connected' | 'Available'

interface Integration {
  id: string
  name: string
  descKey: string
  icon: string
  status: IntegrationStatus
}

// ── Data ────────────────────────────────────────────────────────────────────────

const INTEGRATIONS: Integration[] = [
  { id: 'youtube',      name: 'YouTube',      descKey: 'integ_youtubeDesc',   icon: '▶', status: 'Available' },
  { id: 'tiktok',       name: 'TikTok',       descKey: 'integ_tiktokDesc',    icon: '♪', status: 'Available' },
  { id: 'instagram',    name: 'Instagram',     descKey: 'integ_instagramDesc', icon: '◈', status: 'Available' },
  { id: 'zapier',       name: 'Zapier',        descKey: 'integ_zapierDesc',    icon: '⚡', status: 'Available' },
  { id: 'notion',       name: 'Notion',        descKey: 'integ_notionDesc',    icon: '◻', status: 'Available' },
  { id: 'google-drive', name: 'Google Drive',  descKey: 'integ_gdriveDesc',    icon: '△', status: 'Available' },
  { id: 'slack',        name: 'Slack',         descKey: 'integ_slackDesc',     icon: '#', status: 'Available' },
  { id: 'wordpress',    name: 'WordPress',     descKey: 'integ_wordpressDesc', icon: 'W', status: 'Available' },
]

// ── Page ────────────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const { t } = useLanguage()

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-4xl mx-auto">
      <div className="space-y-8 animate-fade-in">

        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 font-body text-sm text-[--text-secondary] hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} />
          {t('integ_backSettings')}
        </Link>

        <PageHeader
          eyebrow={t('integ_eyebrow')}
          title={t('integ_title')}
          description={t('integ_description')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {INTEGRATIONS.map((integration) => (
            <Card key={integration.id} padding="none" className="overflow-hidden">
              <div className="p-5 flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-muted border border-border flex items-center justify-center shrink-0">
                  <span className="font-mono font-bold text-lg text-[--text-secondary]" aria-hidden="true">
                    {integration.icon}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-display font-semibold text-foreground text-sm">
                      {integration.name}
                    </h3>
                    <Badge variant={integration.status === 'Connected' ? 'success' : 'neutral'}>
                      {integration.status === 'Connected' ? t('integ_connected') : t('integ_comingSoon')}
                    </Badge>
                  </div>
                  <p className="font-body text-xs text-[--text-secondary] leading-relaxed mb-3">
                    {t(integration.descKey)}
                  </p>
                  <Button
                    variant={integration.status === 'Connected' ? 'secondary' : 'outline'}
                    size="sm"
                    disabled={integration.status !== 'Connected'}
                  >
                    {integration.status === 'Connected' ? t('integ_manage') : t('integ_notifyMe')}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="rounded-2xl border border-dashed border-border bg-background p-6 flex flex-col gap-4">
          <div>
            <h3 className="font-display font-semibold text-foreground">
              {t('integ_requestTitle')}
            </h3>
            <p className="font-body text-sm text-[--text-secondary] mt-1">
              {t('integ_requestDesc')}
            </p>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder={t('integ_requestPlaceholder')}
              className="flex-1 min-w-0 bg-muted border border-border rounded-xl px-4 py-2 font-body text-sm text-foreground placeholder:text-[--text-muted] focus:outline-none focus:ring-2 focus:ring-[--ring] focus:ring-offset-2 focus:ring-offset-background transition"
            />
            <Button variant="secondary" size="md">
              {t('integ_submit')}
            </Button>
          </div>
        </div>

      </div>
    </div>
  )
}
