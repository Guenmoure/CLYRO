'use client'

import { Image as ImageIcon, Zap, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { useLanguage } from '@/lib/i18n'

interface ModeConfig {
  icon: React.ElementType
  nameKey: string
  badgeKey: string
  badgeVariant: React.ComponentProps<typeof Badge>['variant']
  variant: 'elevated' | 'gradient'
  borderClass: string
  accentText: string
  costKey: string
  costClass: string
  generationKey: string
  descKey: string
  bulletKeys: string[]
  preview: string
  previewLabel: string
}

const MODES: ModeConfig[] = [
  {
    icon: ImageIcon,
    nameKey: 'pr_modeStoryboard',
    badgeKey: 'pr_modeBadge1',
    badgeVariant: 'neutral',
    variant: 'elevated',
    borderClass: '',
    accentText: 'text-[--text-secondary]',
    costKey: 'pr_modeCost1',
    costClass: 'text-amber-400',
    generationKey: 'pr_modeGen1',
    descKey: 'pr_modeDesc1',
    bulletKeys: ['pr_modeBullet1_1', 'pr_modeBullet1_2', 'pr_modeBullet1_3'],
    preview: 'bg-gradient-to-br from-slate-500/30 via-slate-400/20 to-slate-600/30',
    previewLabel: 'Ken Burns effect',
  },
  {
    icon: Zap,
    nameKey: 'pr_modeFast',
    badgeKey: 'pr_modeBadge2',
    badgeVariant: 'warning',
    variant: 'elevated',
    borderClass: 'border-amber-500/30',
    accentText: 'text-amber-400',
    costKey: 'pr_modeCost2',
    costClass: 'text-amber-400',
    generationKey: 'pr_modeGen2',
    descKey: 'pr_modeDesc2',
    bulletKeys: ['pr_modeBullet2_1', 'pr_modeBullet2_2', 'pr_modeBullet2_3'],
    preview: 'bg-gradient-to-br from-amber-500/30 via-orange-500/20 to-red-500/20',
    previewLabel: 'GPU animated clips',
  },
  {
    icon: Sparkles,
    nameKey: 'pr_modePro',
    badgeKey: 'pr_modeBadge3',
    badgeVariant: 'purple',
    variant: 'gradient',
    borderClass: '',
    accentText: 'text-purple-400',
    costKey: 'pr_modeCost3',
    costClass: 'text-purple-400',
    generationKey: 'pr_modeGen3',
    descKey: 'pr_modeDesc3',
    bulletKeys: ['pr_modeBullet3_1', 'pr_modeBullet3_2', 'pr_modeBullet3_3', 'pr_modeBullet3_4'],
    preview: 'bg-gradient-to-br from-purple-500/30 via-pink-500/20 to-indigo-500/30',
    previewLabel: 'Kling v1.5 Pro',
  },
]

export function AnimationModes() {
  const { t } = useLanguage()

  return (
    <section className="px-6 py-20">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 space-y-3">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">
            {t('pr_modesTitle')}
          </h2>
          <p className="font-body text-[--text-secondary] max-w-2xl mx-auto">
            {t('pr_modesSubtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {MODES.map((m) => {
            const Icon = m.icon
            return (
              <Card
                key={m.nameKey}
                variant={m.variant}
                padding="lg"
                className={`relative ${m.borderClass}`}
              >
                <div className="flex items-start justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <Icon size={18} className={m.accentText} />
                    <h3 className="font-display text-lg font-bold text-foreground">{t(m.nameKey)}</h3>
                  </div>
                  <Badge variant={m.badgeVariant}>{t(m.badgeKey)}</Badge>
                </div>

                <div className={`relative aspect-video rounded-xl overflow-hidden ${m.preview} border border-border`}>
                  <div className="absolute inset-0 grid-bg opacity-[0.04]" />
                  <div className="absolute bottom-2 left-2 inline-flex items-center rounded-full bg-black/40 backdrop-blur-sm px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-white/90">
                    {m.previewLabel}
                  </div>
                </div>

                <p className="font-body text-sm text-[--text-secondary] mt-4 leading-relaxed">
                  {t(m.descKey)}
                </p>

                <div className="mt-4 space-y-1">
                  <p className={`font-mono text-sm font-semibold ${m.costClass}`}>{t(m.costKey)}</p>
                  <p className="font-mono text-[11px] text-[--text-muted]">{t(m.generationKey)}</p>
                </div>

                <ul className="mt-4 space-y-1.5">
                  {m.bulletKeys.map((b) => (
                    <li key={b} className="font-body text-xs text-[--text-secondary] flex items-start gap-2">
                      <span className="text-[--text-muted]">·</span>
                      {t(b)}
                    </li>
                  ))}
                </ul>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
