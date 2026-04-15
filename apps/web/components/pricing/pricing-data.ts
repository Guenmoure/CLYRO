/**
 * Source unique de vérité pour les prix CLYRO.
 * Utilisée par toutes les sections de /pricing et par le calculateur de crédits.
 */

export type PlanId = 'free' | 'starter' | 'pro' | 'creator' | 'studio'
export type Mode   = 'storyboard' | 'fast' | 'pro'

export interface Plan {
  id: PlanId
  name: string
  subtitle: string
  monthly: number            // prix mensuel en €
  yearly: number             // prix équivalent mensuel avec annuel (-20%)
  credits: number            // crédits alloués par mois
  perks: Array<{ label: string; included: boolean }>
  ctaLabel: string
  highlight?: boolean        // Pro — mise en avant
  teamBadge?: boolean        // Studio — badge "Équipes"
  forever?: boolean          // Free — "pour toujours"
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    subtitle: 'Pour tester CLYRO',
    monthly: 0,
    yearly: 0,
    credits: 250,
    forever: true,
    ctaLabel: 'Commencer gratuitement',
    perks: [
      { label: '1 vidéo au total',                        included: true  },
      { label: 'Modes Storyboard + Fast Animation',       included: true  },
      { label: 'Durée max 5 min par vidéo',               included: true  },
      { label: 'Export 720p',                             included: true  },
      { label: 'Watermark CLYRO',                         included: false },
      { label: 'Pas de top-ups disponibles',              included: false },
      { label: 'F3 Brand Kit non disponible',             included: false },
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    subtitle: 'Pour les créateurs réguliers',
    monthly: 9,
    yearly: 7,
    credits: 800,
    ctaLabel: 'Commencer',
    perks: [
      { label: 'Modes Storyboard + Fast Animation',        included: true  },
      { label: "Vidéos jusqu'à 8 min",                     included: true  },
      { label: 'Export 1080p',                             included: true  },
      { label: 'Sans watermark',                           included: true  },
      { label: 'Crédits roll-over (report automatique)',   included: true  },
      { label: 'Top-ups disponibles',                      included: true  },
      { label: 'Pro Animation non disponible',             included: false },
      { label: 'F3 Brand Kit non disponible',              included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    subtitle: 'Pour les YouTubeurs sérieux',
    monthly: 29,
    yearly: 23,
    credits: 3000,
    highlight: true,
    ctaLabel: 'Essayer Pro',
    perks: [
      { label: "TOUS les modes d'animation",               included: true },
      { label: "Vidéos jusqu'à 15 min",                    included: true },
      { label: 'Export 1080p + 4K',                        included: true },
      { label: 'Sans watermark',                           included: true },
      { label: 'Crédits roll-over',                        included: true },
      { label: 'Top-ups disponibles',                      included: true },
      { label: 'F3 Brand Kit — 5 identités/mois',          included: true },
      { label: '2 voix clonées',                           included: true },
      { label: 'Tous les styles premium (6 styles)',       included: true },
      { label: 'Régénération scène par scène illimitée',   included: true },
    ],
  },
  {
    id: 'creator',
    name: 'Creator',
    subtitle: 'Pour scaler sa production',
    monthly: 69,
    yearly: 55,
    credits: 9000,
    ctaLabel: 'Passer Creator',
    perks: [
      { label: 'Tout le plan Pro',                         included: true },
      { label: 'F3 Brand Kit illimité',                    included: true },
      { label: 'Voix clonées illimitées',                  included: true },
      { label: 'API access (automatisation)',              included: true },
      { label: 'Téléchargement des clips individuels',     included: true },
      { label: 'Rendu prioritaire (file dédiée)',          included: true },
      { label: 'Liens de partage brand kit',               included: true },
      { label: 'Support prioritaire',                      included: true },
    ],
  },
  {
    id: 'studio',
    name: 'Studio',
    subtitle: 'Pour les agences et équipes',
    monthly: 149,
    yearly: 119,
    credits: 25000,
    teamBadge: true,
    ctaLabel: "Contacter l'équipe",
    perks: [
      { label: 'Tout le plan Creator',                     included: true },
      { label: "Gestion d'équipe (5 membres)",             included: true },
      { label: 'Dashboard équipe partagé',                 included: true },
      { label: 'Crédits partagés entre membres',           included: true },
      { label: 'Facturation consolidée',                   included: true },
      { label: 'Paiement Mobile Money (Moneroo)',          included: true },
      { label: 'SSO optionnel',                            included: true },
      { label: 'Account Manager dédié',                    included: true },
    ],
  },
]

// Coût en crédits par minute selon le mode
export const CREDIT_COST_PER_MIN: Record<Mode, number> = {
  storyboard: 5,
  fast:       25,
  pro:        80,
}

export const MODE_META: Record<Mode, { label: string; color: string; accent: string }> = {
  storyboard: { label: 'Storyboard',     color: 'text-[--text-secondary]', accent: 'border-border'           },
  fast:       { label: 'Fast Animation', color: 'text-amber-400',          accent: 'border-amber-500/30'     },
  pro:        { label: 'Pro Animation',  color: 'text-purple-400',         accent: 'border-purple-500/30'    },
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function videosPerMonth(credits: number, durationMin: number, mode: Mode): number {
  return Math.floor(credits / (CREDIT_COST_PER_MIN[mode] * durationMin))
}

export function secondsAvailable(credits: number, mode: Mode): number {
  return Math.floor((credits / CREDIT_COST_PER_MIN[mode]) * 60)
}

export function creditsForVideo(durationMin: number, mode: Mode): number {
  return CREDIT_COST_PER_MIN[mode] * durationMin
}

export function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR').replace(',', ' ')
}
