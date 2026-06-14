'use client'

/**
 * Brand Photoshoot landing — Phase 4 du portage Pomelli.
 *
 * Deux entrées :
 *   - « Create a product photoshoot » → /photoshoot/templates
 *   - « Generate or edit an image »   → /photoshoot/generate (V2)
 *
 * Sous les cards, la liste des photoshoots existants de cette marque.
 */

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Camera, Wand2, Loader2, AlertCircle, CheckCircle2, Sparkles, type LucideIcon } from 'lucide-react'
import { BrandKitLayout } from '@/components/brand/BrandKitLayout'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'
import { getBrandKit, listBrandPhotoshoots, type BrandPhotoshoot } from '@/lib/api'
import type { BrandKit } from '@clyro/shared'

export default function BrandPhotoshootLandingPage() {
  const params = useParams<{ kitId: string }>()
  const kitId = params?.kitId ?? ''
  const { t } = useLanguage()

  const [kit, setKit] = useState<BrandKit | null>(null)
  const [photoshoots, setPhotoshoots] = useState<BrandPhotoshoot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!kitId) return
    setLoading(true)
    setError(null)
    Promise.all([getBrandKit(kitId), listBrandPhotoshoots(kitId)])
      .then(([k, p]) => { setKit(k.data); setPhotoshoots(p.data) })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'error'))
      .finally(() => setLoading(false))
  }, [kitId])

  if (loading) {
    return (
      <BrandKitLayout kitId={kitId}>
        <div className="flex items-center justify-center py-20 text-[--text-muted]">
          <Loader2 size={20} className="animate-spin" />
        </div>
      </BrandKitLayout>
    )
  }
  if (error) {
    return (
      <BrandKitLayout kitId={kitId}>
        <div className="flex flex-col items-center gap-2 py-20">
          <AlertCircle size={24} className="text-error" />
          <p className="font-body text-sm text-[--text-muted]">{error === 'error' ? t('bk_failedLoad') : error}</p>
        </div>
      </BrandKitLayout>
    )
  }

  return (
    <BrandKitLayout kitId={kitId} kitName={kit?.name}>
      <div className="max-w-5xl mx-auto space-y-10">
        <section>
          <p className="font-mono text-[10px] uppercase tracking-wider text-[--text-muted]">{t('bk_ps_kicker')}</p>
          <h2 className="font-display text-2xl font-semibold text-foreground mt-1">{t('bk_ps_title')}</h2>
          <p className="font-body text-sm text-[--text-muted] mt-1">
            {t('bk_ps_sub')}
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModeCard
            href={`/brand/${kitId}/photoshoot/templates`}
            Icon={Camera}
            title={t('bk_ps_card1Title')}
            description={t('bk_ps_card1Desc')}
            cta={t('bk_ps_card1Cta')}
          />
          <ModeCard
            href={`/brand/${kitId}/photoshoot/generate`}
            Icon={Wand2}
            title={t('bk_ps_card2Title')}
            description={t('bk_ps_card2Desc')}
            cta={t('bk_ps_card2Cta')}
          />
        </section>

        <section>
          <h3 className="font-display text-sm font-semibold text-foreground mb-3">{t('bk_ps_recent')}</h3>
          {photoshoots.length === 0 ? (
            <p className="font-body text-xs text-[--text-muted]">
              {t('bk_ps_empty')}
            </p>
          ) : (
            <ul className="space-y-2">
              {photoshoots.map((p) => (
                <PhotoshootRow key={p.id} shoot={p} kitId={kitId} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </BrandKitLayout>
  )
}

function ModeCard({
  href, Icon, title, description, cta, disabled,
}: {
  href:        string
  Icon:        LucideIcon
  title:       string
  description: string
  cta:         string
  disabled?:   boolean
}) {
  const content = (
    <div className={cn(
      'h-full rounded-2xl border border-border bg-card p-6 flex flex-col gap-3 transition-colors',
      !disabled && 'hover:border-foreground/40',
      disabled && 'opacity-60',
    )}>
      <Icon size={22} className="text-[--text-muted]" />
      <h4 className="font-display text-base font-semibold text-foreground">{title}</h4>
      <p className="font-body text-xs text-[--text-muted] leading-relaxed flex-1">{description}</p>
      <span className="font-mono text-[11px] text-foreground">
        {cta} {!disabled && '→'}
        {disabled && <span className="ml-1 text-[--text-muted]">· soon</span>}
      </span>
    </div>
  )
  if (disabled) return <div role="presentation" className="cursor-not-allowed">{content}</div>
  return <Link href={href}>{content}</Link>
}

function PhotoshootRow({ shoot, kitId }: { shoot: BrandPhotoshoot; kitId: string }) {
  const { t } = useLanguage()
  const meta = {
    pending:    { label: t('bk_statusPending'),    cls: 'text-[--text-muted] bg-muted',     Icon: Loader2 },
    generating: { label: t('bk_statusGenerating'), cls: 'text-blue-700 bg-blue-100',         Icon: Loader2 },
    done:       { label: t('bk_statusReady'),      cls: 'text-emerald-700 bg-emerald-100',   Icon: CheckCircle2 },
    error:      { label: t('bk_statusError'),      cls: 'text-error bg-error/10',            Icon: AlertCircle },
  }[shoot.status]
  const Icon = meta.Icon
  return (
    <li>
      <Link
        href={`/brand/${kitId}/photoshoot/${shoot.id}`}
        className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-foreground/30 transition-colors"
      >
        {shoot.output_urls.length > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shoot.output_urls[0]} alt={t('bk_photoshootThumb')} className="w-12 h-12 rounded-md object-cover border border-border" />
        ) : shoot.input_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shoot.input_image_url} alt={t('bk_sourceImage')} className="w-12 h-12 rounded-md object-cover border border-border opacity-70" />
        ) : (
          <div className="w-12 h-12 rounded-md border border-border bg-muted flex items-center justify-center text-[--text-muted]">
            <Sparkles size={16} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider', meta.cls)}>
              <Icon size={10} className={shoot.status === 'generating' || shoot.status === 'pending' ? 'animate-spin' : undefined} />
              {meta.label}
            </span>
            <span className="font-mono text-[10px] text-[--text-muted]">{shoot.aspect_ratio}</span>
            {shoot.template_id && (
              <span className="font-mono text-[10px] text-[--text-muted] truncate">· {shoot.template_id}</span>
            )}
          </div>
          <p className="font-mono text-[10px] text-[--text-muted] mt-0.5">
            {t('bk_ps_variationsMeta').replace('{count}', String(shoot.output_urls.length))} · {new Date(shoot.created_at).toLocaleString()}
          </p>
        </div>
      </Link>
    </li>
  )
}
