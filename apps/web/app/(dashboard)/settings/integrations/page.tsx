import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'

// ── Types ───────────────────────────────────────────────────────────────────────

type IntegrationStatus = 'Connected' | 'Available'

interface Integration {
  id: string
  name: string
  description: string
  icon: string
  status: IntegrationStatus
  category: string
}

// ── Data ────────────────────────────────────────────────────────────────────────

const INTEGRATIONS: Integration[] = [
  {
    id: 'youtube',
    name: 'YouTube',
    description: 'Upload directly to your YouTube channel',
    icon: '▶',
    status: 'Available',
    category: 'Publishing',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    description: 'Auto-publish short-form videos to TikTok',
    icon: '♪',
    status: 'Available',
    category: 'Publishing',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    description: 'Share reels and stories to your profile',
    icon: '◈',
    status: 'Available',
    category: 'Publishing',
  },
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Automate workflows with 5,000+ apps',
    icon: '⚡',
    status: 'Available',
    category: 'Automation',
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Import scripts and briefs from Notion pages',
    icon: '◻',
    status: 'Available',
    category: 'Content',
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Export finished videos directly to Drive',
    icon: '△',
    status: 'Available',
    category: 'Storage',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Get notifications when renders complete',
    icon: '#',
    status: 'Available',
    category: 'Notifications',
  },
  {
    id: 'wordpress',
    name: 'WordPress',
    description: 'Embed published videos in your posts',
    icon: 'W',
    status: 'Available',
    category: 'Publishing',
  },
]

// ── Page ────────────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-4xl mx-auto">
      <div className="space-y-8 animate-fade-in">

        {/* Back link */}
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 font-body text-sm text-[--text-secondary] hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} />
          Settings
        </Link>

        <PageHeader
          eyebrow="Settings"
          title="Integrations"
          description="Connect your favorite tools to streamline your video workflow"
        />

        {/* Integration grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {INTEGRATIONS.map((integration) => (
            <Card
              key={integration.id}
              padding="none"
              className="overflow-hidden"
            >
              <div className="p-5 flex items-start gap-4">
                {/* Icon */}
                <div className="w-11 h-11 rounded-xl bg-muted border border-border flex items-center justify-center shrink-0">
                  <span
                    className="font-mono font-bold text-lg text-[--text-secondary]"
                    aria-hidden="true"
                  >
                    {integration.icon}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-display font-semibold text-foreground text-sm">
                      {integration.name}
                    </h3>
                    <Badge variant={integration.status === 'Connected' ? 'success' : 'neutral'}>
                      {integration.status}
                    </Badge>
                  </div>
                  <p className="font-body text-xs text-[--text-secondary] leading-relaxed mb-3">
                    {integration.description}
                  </p>
                  <Button
                    variant={integration.status === 'Connected' ? 'secondary' : 'outline'}
                    size="sm"
                  >
                    {integration.status === 'Connected' ? 'Manage' : 'Connect'}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Request an integration */}
        <div className="rounded-2xl border border-dashed border-border bg-background p-6 flex flex-col gap-4">
          <div>
            <h3 className="font-display font-semibold text-foreground">
              Request an integration
            </h3>
            <p className="font-body text-sm text-[--text-secondary] mt-1">
              Don&apos;t see a tool you need? Let us know and we&apos;ll consider it for a future release.
            </p>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="e.g. Webflow, Airtable, HubSpot…"
              className="flex-1 min-w-0 bg-muted border border-border rounded-xl px-4 py-2 font-body text-sm text-foreground placeholder:text-[--text-muted] focus:outline-none focus:ring-2 focus:ring-[--ring] focus:ring-offset-2 focus:ring-offset-background transition"
            />
            <Button variant="secondary" size="md">
              Submit
            </Button>
          </div>
        </div>

      </div>
    </div>
  )
}
