import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Sparkles, Check, Lock, Palette, Globe, Mail, Image as ImageIcon,
} from 'lucide-react'
import type { Database } from '@/lib/database.types'
import { Card } from '@/components/ui/card'
import { UpgradeCard } from '@/components/plans/UpgradeCard'
import { hasWhitelabel, planLabel, type UserPlan } from '@/lib/plans'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'White-label — CLYRO' }

interface BrandKit {
  id: string
  name: string
  primary_color: string
  secondary_color: string | null
  logo_url: string | null
  is_default: boolean
}

export default async function WhiteLabelPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return (
      <div className="px-4 sm:px-6 py-16 max-w-2xl mx-auto">
        <p className="font-body text-sm text-[--text-muted]">Missing configuration.</p>
      </div>
    )
  }

  const supabase = createServerComponentClient<Database>({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/settings/white-label')

  const [profileResult, brandKitsResult] = await Promise.all([
    supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle(),
    supabase
      .from('brand_kits')
      .select('id, name, primary_color, secondary_color, logo_url, is_default')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const profile = (profileResult.data as { plan: string } | null) ?? null
  const plan = (profile?.plan ?? 'free') as UserPlan
  const unlocked = hasWhitelabel(plan)
  const brandKits = ((brandKitsResult.data ?? []) as BrandKit[])
  const defaultKit = brandKits.find(b => b.is_default) ?? brandKits[0] ?? null

  return (
    <div className="px-4 sm:px-6 py-10 max-w-3xl mx-auto">
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <h1 className="font-display text-2xl font-semibold text-foreground">White-label</h1>
          <span
            className={`font-mono text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full ${
              unlocked
                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                : 'bg-muted text-[--text-muted] border border-border'
            }`}
          >
            {unlocked ? 'Active' : 'Locked'}
          </span>
        </div>
        <p className="font-body text-sm text-[--text-muted]">
          Ship videos that look like they came from <em>your</em> brand, not ours.
          {' '}On your current <strong className="text-foreground">{planLabel(plan)}</strong> plan,
          {' '}
          {unlocked
            ? 'white-label is fully unlocked.'
            : 'CLYRO branding appears on renders and shared pages.'}
        </p>
      </header>

      {/* Plan gate */}
      {!unlocked && (
        <div className="mb-8">
          <UpgradeCard
            headline="Make it look like yours, not ours"
            description={
              <>
                Remove the CLYRO watermark on renders, brand the share pages with
                your logo &amp; colors, and get your domain on public video links.
              </>
            }
            plans={['Pro', 'Creator', 'Studio']}
          />
        </div>
      )}

      {/* When unlocked: pin the default brand kit to the top — the brand kit
          IS the white-label, so show it before the feature list. */}
      {unlocked && (
        <Card variant="highlight" padding="lg" className="mb-8">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-sm font-semibold text-foreground">
                Your brand on every render
              </h2>
              <p className="font-body text-xs text-[--text-muted] mt-1">
                Applied automatically to share pages and video outros.
              </p>
            </div>
            <Link
              href="/brand"
              className="inline-flex items-center gap-1.5 font-body text-xs font-medium px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
            >
              Manage
            </Link>
          </div>

          {defaultKit ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
              {defaultKit.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={defaultKit.logo_url}
                  alt=""
                  className="w-11 h-11 rounded-lg object-contain bg-background border border-border shrink-0"
                />
              ) : (
                <div
                  className="w-11 h-11 rounded-lg border border-border shrink-0"
                  style={{ backgroundColor: defaultKit.primary_color }}
                  aria-hidden="true"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-body text-sm text-foreground truncate">{defaultKit.name}</p>
                <p className="font-mono text-[11px] text-[--text-muted]">
                  {defaultKit.primary_color.toUpperCase()}
                  {defaultKit.secondary_color ? ` · ${defaultKit.secondary_color.toUpperCase()}` : ''}
                </p>
              </div>
              {defaultKit.is_default && (
                <span className="font-mono text-[11px] uppercase tracking-wide text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5 shrink-0">
                  Default
                </span>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
              <div className="w-11 h-11 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3" aria-hidden="true">
                <Palette size={18} className="text-[--text-muted]" />
              </div>
              <p className="font-body text-sm text-foreground">
                No brand kit yet
              </p>
              <p className="font-body text-xs text-[--text-muted] mt-1 max-w-xs mx-auto">
                Add a logo and a primary color and we'll apply them automatically.
              </p>
              <Link
                href="/brand/new"
                className="inline-flex items-center gap-2 mt-4 bg-blue-500 text-white font-body font-medium px-4 py-2 rounded-xl text-sm hover:bg-blue-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Sparkles size={14} aria-hidden="true" />
                Create a brand kit
              </Link>
            </div>
          )}
        </Card>
      )}

      {/* Feature list */}
      <section aria-label="White-label features" className="space-y-3">
        <FeatureRow
          icon={<ImageIcon size={16} aria-hidden="true" />}
          title="No CLYRO watermark on renders"
          desc="Clean exports. No badge, no outro — just your video."
          active={unlocked}
        />
        <FeatureRow
          icon={<Palette size={16} aria-hidden="true" />}
          title="Your brand kit on share pages"
          desc="Public video pages use your default brand kit's logo and primary color."
          active={unlocked}
        />
        <FeatureRow
          icon={<Globe size={16} aria-hidden="true" />}
          title="Custom domain on share links"
          desc="Point a CNAME at CLYRO and share videos from videos.yourdomain.com. (Studio only)"
          active={unlocked && plan === 'studio'}
        />
        <FeatureRow
          icon={<Mail size={16} aria-hidden="true" />}
          title="Branded notification emails"
          desc={'"Your video is ready" emails come from your brand, not ours. (Studio only)'}
          active={unlocked && plan === 'studio'}
        />
      </section>
    </div>
  )
}

// ── Feature row ────────────────────────────────────────────────────────────────

function FeatureRow({
  icon,
  title,
  desc,
  active,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  active: boolean
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-3 ${
        active ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-border bg-muted/30'
      }`}
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          active ? 'bg-emerald-500/10 text-emerald-300' : 'bg-muted text-[--text-muted]'
        }`}
        aria-hidden="true"
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-display text-sm font-medium text-foreground">{title}</p>
          {active ? (
            <span
              className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wide text-emerald-300"
              aria-label="Active"
            >
              <Check size={10} aria-hidden="true" />
              On
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wide text-[--text-muted]"
              aria-label="Locked"
            >
              <Lock size={10} aria-hidden="true" />
              Locked
            </span>
          )}
        </div>
        <p className="font-body text-xs text-[--text-muted] mt-0.5">{desc}</p>
      </div>
    </div>
  )
}
