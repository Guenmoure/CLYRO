import { Plus } from 'lucide-react'

const QUESTIONS = [
  {
    q: "Qu'est-ce qu'un crédit exactement ?",
    a: "Un crédit est une unité de génération abstraite. Il masque la complexité du coût GPU réel derrière un nombre simple. La consommation dépend du mode d'animation (Storyboard, Fast, Pro) et de la durée de ta vidéo. Voir le calculateur ci-dessus pour les détails.",
  },
  {
    q: "Que se passe-t-il si j'utilise tous mes crédits ?",
    a: "Tu reçois une notification quand il te reste 20% de crédits. À 0, la génération est bloquée et tu es invité à acheter un top-up ou à attendre le renouvellement mensuel. Tes projets en cours ne sont pas supprimés.",
  },
  {
    q: "Les crédits non utilisés expirent-ils ?",
    a: "Non, jamais. Les crédits mensuels non consommés passent automatiquement au mois suivant (roll-over). Les crédits achetés en top-up s'accumulent sans date limite. Tu construis un stock au fil du temps.",
  },
  {
    q: "Puis-je changer de plan à tout moment ?",
    a: "Oui. Upgrade immédiat (les nouveaux crédits sont disponibles immédiatement). Downgrade à la prochaine date de renouvellement. Annulation : ton plan reste actif jusqu'à la fin de la période payée, puis passe automatiquement en Free.",
  },
  {
    q: "La qualité Pro Animation vaut-elle vraiment les crédits supplémentaires ?",
    a: "Pour les scènes avec des personnages animés complexes, oui clairement. Pour les plans larges, les fonds et les contenus textuels, Fast Animation donne des résultats quasi-identiques pour 3× moins de crédits. Notre recommandation : commence en Fast et utilise Pro sélectivement pour les scènes clés.",
  },
  {
    q: "Le Mobile Money est-il disponible pour tous les plans ?",
    a: "Le paiement Mobile Money (Orange Money, Wave, MTN, Moov) est disponible à partir du plan Studio. Pour les autres plans, le paiement se fait par carte bancaire internationale via Stripe.",
  },
]

export function PricingFAQ() {
  return (
    <section className="px-6 py-20">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10 space-y-3">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">
            Questions fréquentes
          </h2>
          <p className="font-body text-[--text-secondary]">
            Tout ce qu&apos;il faut savoir sur la tarification CLYRO.
          </p>
        </div>

        <div className="space-y-2">
          {QUESTIONS.map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl border border-border bg-card overflow-hidden transition-all hover:border-border open:border-blue-500/30"
            >
              <summary className="flex items-center justify-between gap-3 cursor-pointer list-none px-5 py-4">
                <span className="font-display text-base font-semibold text-foreground">
                  {item.q}
                </span>
                <Plus
                  size={16}
                  className="shrink-0 text-[--text-secondary] transition-transform group-open:rotate-45"
                />
              </summary>
              <div className="px-5 pb-4 -mt-1 font-body text-sm text-[--text-secondary] leading-relaxed">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
