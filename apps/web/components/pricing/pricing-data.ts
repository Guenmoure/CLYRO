/**
 * Source unique de vérité pour les prix CLYRO.
 * Utilisée par toutes les sections de /pricing et par le calculateur de crédits.
 *
 * NOTE: All user-facing strings use translation key references (xxxKey fields).
 * Consumers must call t(key) at render time to get the translated string.
 */

export type PlanId = 'free' | 'starter' | 'pro' | 'creator' | 'studio'
export type Mode   = 'storyboard' | 'fast' | 'pro'

export interface Perk {
  labelKey: string
  included: boolean
}

export interface Plan {
  id: PlanId
  name: string                // Brand name — not translated
  subtitleKey: string
  monthly: number
  yearly: number
  credits: number
  perks: Perk[]
  ctaLabelKey: string
  highlight?: boolean
  teamBadge?: boolean
  forever?: boolean
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    subtitleKey: 'pr_freeSub',
    monthly: 0,
    yearly: 0,
    credits: 250,
    forever: true,
    ctaLabelKey: 'pr_freeCta',
    perks: [
      { labelKey: 'pr_perk_1video',           included: true  },
      { labelKey: 'pr_perk_storyFast',        included: true  },
      { labelKey: 'pr_perk_5minMax',          included: true  },
      { labelKey: 'pr_perk_720p',             included: true  },
      { labelKey: 'pr_perk_watermark',        included: false },
      { labelKey: 'pr_perk_noTopups',         included: false },
      { labelKey: 'pr_perk_noBrandKit',       included: false },
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    subtitleKey: 'pr_starterSub',
    monthly: 9,
    yearly: 7,
    credits: 800,
    ctaLabelKey: 'pr_starterCta',
    perks: [
      { labelKey: 'pr_perk_storyFast',        included: true  },
      { labelKey: 'pr_perk_8minMax',          included: true  },
      { labelKey: 'pr_perk_1080p',            included: true  },
      { labelKey: 'pr_perk_noWatermark',      included: true  },
      { labelKey: 'pr_perk_rollover',         included: true  },
      { labelKey: 'pr_perk_topupsAvail',      included: true  },
      { labelKey: 'pr_perk_noProAnim',        included: false },
      { labelKey: 'pr_perk_noBrandKit',       included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    subtitleKey: 'pr_proSub',
    monthly: 29,
    yearly: 23,
    credits: 3000,
    highlight: true,
    ctaLabelKey: 'pr_proCta',
    perks: [
      { labelKey: 'pr_perk_allModes',         included: true },
      { labelKey: 'pr_perk_15minMax',         included: true },
      { labelKey: 'pr_perk_1080p4k',          included: true },
      { labelKey: 'pr_perk_noWatermark',      included: true },
      { labelKey: 'pr_perk_rollover',         included: true },
      { labelKey: 'pr_perk_topupsAvail',      included: true },
      { labelKey: 'pr_perk_brandKit5',        included: true },
      { labelKey: 'pr_perk_2voices',          included: true },
      { labelKey: 'pr_perk_premiumStyles',    included: true },
      { labelKey: 'pr_perk_unlimitedRegen',   included: true },
    ],
  },
  {
    id: 'creator',
    name: 'Creator',
    subtitleKey: 'pr_creatorSub',
    monthly: 69,
    yearly: 55,
    credits: 9000,
    ctaLabelKey: 'pr_creatorCta',
    perks: [
      { labelKey: 'pr_perk_allPro',           included: true },
      { labelKey: 'pr_perk_brandKitUnlim',    included: true },
      { labelKey: 'pr_perk_voicesUnlim',      included: true },
      { labelKey: 'pr_perk_apiAccess',        included: true },
      { labelKey: 'pr_perk_clipDownload',     included: true },
      { labelKey: 'pr_perk_priorityRender',   included: true },
      { labelKey: 'pr_perk_brandKitLinks',    included: true },
      { labelKey: 'pr_perk_prioritySupport',  included: true },
    ],
  },
  {
    id: 'studio',
    name: 'Studio',
    subtitleKey: 'pr_studioSub',
    monthly: 149,
    yearly: 119,
    credits: 25000,
    teamBadge: true,
    ctaLabelKey: 'pr_studioCta',
    perks: [
      { labelKey: 'pr_perk_allCreator',       included: true },
      { labelKey: 'pr_perk_team5',            included: true },
      { labelKey: 'pr_perk_teamDashboard',    included: true },
      { labelKey: 'pr_perk_sharedCredits',    included: true },
      { labelKey: 'pr_perk_consolidatedBill', included: true },
      { labelKey: 'pr_perk_mobileMoney',      included: true },
      { labelKey: 'pr_perk_sso',              included: true },
      { labelKey: 'pr_perk_accountManager',   included: true },
    ],
  },
]

// Coût en crédits par minute selon le mode
export const CREDIT_COST_PER_MIN: Record<Mode, number> = {
  storyboard: 5,
  fast:       25,
  pro:        80,
}

export const MODE_META: Record<Mode, { labelKey: string; color: string; accent: string }> = {
  storyboard: { labelKey: 'pr_modeStoryboard', color: 'text-[--text-secondary]', accent: 'border-border'           },
  fast:       { labelKey: 'pr_modeFast',        color: 'text-amber-400',          accent: 'border-amber-500/30'     },
  pro:        { labelKey: 'pr_modePro',         color: 'text-purple-400',         accent: 'border-purple-500/30'    },
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
