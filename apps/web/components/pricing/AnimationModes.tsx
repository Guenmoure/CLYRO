import { Image as ImageIcon, Zap, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

const MODES = [
  {
    icon: ImageIcon,
    name: 'Storyboard',
    badge: <Badge variant="neutral">Le plus rapide</Badge>,
    variant: 'elevated' as const,
    borderClass: '',
    accentText:  'text-[--text-secondary]',
    cost:        '5 crédits / minute',
    costClass:   'text-amber-400',
    generation:  '⚡ Génération en ~2 min',
    description: "Images générées par IA avec zoom et panoramique doux. Idéal pour tester tes scripts et valider le rythme avant d'investir en animation.",
    bullets: [
      'Test rapide de narratifs',
      'Faible consommation de crédits',
      'Rendu immédiat',
    ],
    preview: 'bg-gradient-to-br from-slate-500/30 via-slate-400/20 to-slate-600/30',
    previewLabel: 'Ken Burns effect',
  },
  {
    icon: Zap,
    name: 'Fast Animation',
    badge: <Badge variant="warning">Recommandé</Badge>,
    variant: 'elevated' as const,
    borderClass: 'border-amber-500/30',
    accentText:  'text-amber-400',
    cost:        '25 crédits / minute',
    costClass:   'text-amber-400',
    generation:  '⚡ Génération en ~5 min',
    description: 'Clips animés avec modèles GPU optimisés. Le meilleur rapport qualité/crédit pour une publication régulière.',
    bullets: [
      'Mouvement naturel et fluide',
      'Idéal pour TikTok, YouTube',
      'Cohérence visuelle entre scènes',
    ],
    preview: 'bg-gradient-to-br from-amber-500/30 via-orange-500/20 to-red-500/20',
    previewLabel: 'Clips animés GPU',
  },
  {
    icon: Sparkles,
    name: 'Pro Animation',
    badge: <Badge variant="purple">Qualité maximale</Badge>,
    variant: 'gradient' as const,
    borderClass: '',
    accentText:  'text-purple-400',
    cost:        '80 crédits / minute',
    costClass:   'text-purple-400',
    generation:  '⚡ Génération en ~15 min',
    description: 'Kling v1.5 pro + orchestration avancée. Pour les créateurs qui ne font pas de compromis sur la qualité visuelle.',
    bullets: [
      'Modèles premium (Kling v1.5 Pro)',
      'Personnages et mouvements complexes',
      'Sound design avancé',
      'Disponible Pro, Creator, Studio',
    ],
    preview: 'bg-gradient-to-br from-purple-500/30 via-pink-500/20 to-indigo-500/30',
    previewLabel: 'Kling v1.5 Pro',
  },
]

export function AnimationModes() {
  return (
    <section className="px-6 py-20">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 space-y-3">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">
            Trois modes pour chaque créateur
          </h2>
          <p className="font-body text-[--text-secondary] max-w-2xl mx-auto">
            Du storyboard rapide à l&apos;animation premium. Même crédit, qualité différente.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {MODES.map((m) => {
            const Icon = m.icon
            return (
              <Card
                key={m.name}
                variant={m.variant}
                padding="lg"
                className={`relative ${m.borderClass}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <Icon size={18} className={m.accentText} />
                    <h3 className="font-display text-lg font-bold text-foreground">{m.name}</h3>
                  </div>
                  {m.badge}
                </div>

                {/* Preview */}
                <div className={`relative aspect-video rounded-xl overflow-hidden ${m.preview} border border-border`}>
                  <div className="absolute inset-0 grid-bg opacity-[0.04]" />
                  <div className="absolute bottom-2 left-2 inline-flex items-center rounded-full bg-black/40 backdrop-blur-sm px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-white/90">
                    {m.previewLabel}
                  </div>
                </div>

                {/* Description */}
                <p className="font-body text-sm text-[--text-secondary] mt-4 leading-relaxed">
                  {m.description}
                </p>

                {/* Cost */}
                <div className="mt-4 space-y-1">
                  <p className={`font-mono text-sm font-semibold ${m.costClass}`}>{m.cost}</p>
                  <p className="font-mono text-[11px] text-[--text-muted]">{m.generation}</p>
                </div>

                {/* Bullets */}
                <ul className="mt-4 space-y-1.5">
                  {m.bullets.map((b) => (
                    <li key={b} className="font-body text-xs text-[--text-secondary] flex items-start gap-2">
                      <span className="text-[--text-muted]">·</span>
                      {b}
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
