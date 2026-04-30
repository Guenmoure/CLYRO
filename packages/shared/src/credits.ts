/**
 * CLYRO — Credits configuration shared between backend and frontend.
 *
 * Single source of truth for:
 *  - Plan IDs and the monthly credit quota for each plan
 *  - Credit cost per minute by animation mode
 *  - Top-up packs (price + credits granted)
 *
 * Mirrors the marketing values exposed on the public /pricing page
 * (apps/web/components/pricing/pricing-data.ts). When you change a
 * value here, also update the pricing page so what users see equals
 * what we charge.
 */

import type { AnimationMode } from './types/video'
export type { AnimationMode }

// ── Plans ────────────────────────────────────────────────────────────────────

export type PlanId = 'free' | 'starter' | 'pro' | 'creator' | 'studio'

export const PLAN_IDS: readonly PlanId[] = ['free', 'starter', 'pro', 'creator', 'studio']

/**
 * Monthly credit quota per plan. Granted on subscription renewal
 * (cron tick) AND on initial signup for Free.
 */
export const PLAN_MONTHLY_CREDITS: Record<PlanId, number> = {
  free:    250,
  starter: 800,
  pro:     3000,
  creator: 9000,
  studio:  25000,
}

/**
 * Display label for each plan (used by UI / emails / logs).
 */
export const PLAN_LABELS: Record<PlanId, string> = {
  free:    'Free',
  starter: 'Starter',
  pro:     'Pro',
  creator: 'Creator',
  studio:  'Studio',
}

/**
 * Plans treated as "unlimited" — no balance check, no decrement.
 * Empty for now (Studio still consumes credits, just at high quota).
 * Kept as a typed constant so future "Enterprise" plans can opt in.
 */
export const UNLIMITED_PLANS: ReadonlyArray<PlanId> = []

export function isUnlimitedPlan(plan: PlanId | string | null | undefined): boolean {
  return !!plan && (UNLIMITED_PLANS as readonly string[]).includes(plan)
}

// ── Per-minute cost by animation mode ────────────────────────────────────────

/**
 * Credit cost per minute of generated video, by animation mode
 * (re-exported from ./types/video).
 * - storyboard : Ken Burns over still images (cheapest)
 * - fast       : Kling Standard image-to-video (mid)
 * - pro        : Kling Pro / premium image-to-video (most expensive)
 */
export const CREDIT_COST_PER_MIN: Record<AnimationMode, number> = {
  storyboard: 5,
  fast:       25,
  pro:        80,
}

/**
 * Compute the credit cost of generating a video. Always returns at
 * least 1 credit so a 5-second test still bills something — and so
 * the float→int rounding never lands on 0.
 */
export function creditCostForVideo(durationSeconds: number, mode: AnimationMode): number {
  const safeDuration = Math.max(1, durationSeconds)
  const minutes = safeDuration / 60
  const raw = CREDIT_COST_PER_MIN[mode] * minutes
  return Math.max(1, Math.ceil(raw))
}

// ── Top-up packs ─────────────────────────────────────────────────────────────

export type TopupPackId = 'boost' | 'pro_boost' | 'power' | 'studio'

export interface TopupPack {
  id:        TopupPackId
  name:      string
  credits:   number
  priceEur:  number
}

/**
 * Source of truth for the credit packs sold on /pricing.
 * Aligned with apps/web/components/pricing/CreditTopups.tsx.
 */
export const TOPUP_PACKS: Record<TopupPackId, TopupPack> = {
  boost:     { id: 'boost',     name: 'Boost',     credits:   500, priceEur:   8 },
  pro_boost: { id: 'pro_boost', name: 'Pro Boost', credits:  1500, priceEur:  20 },
  power:     { id: 'power',     name: 'Power',     credits:  5000, priceEur:  55 },
  studio:    { id: 'studio',    name: 'Studio',    credits: 15000, priceEur: 130 },
}

export function getTopupPack(id: string): TopupPack | null {
  return (TOPUP_PACKS as Record<string, TopupPack | undefined>)[id] ?? null
}

// ── Stripe price IDs ─────────────────────────────────────────────────────────

/**
 * Read Stripe price IDs from env vars. Returned as a function so we
 * don't snapshot env at module-load (Next.js env reload, tests, etc.).
 */
export function getStripePriceMap(): Record<Exclude<PlanId, 'free'>, string | undefined> {
  return {
    starter: process.env.STRIPE_PRICE_STARTER,
    pro:     process.env.STRIPE_PRICE_PRO,
    creator: process.env.STRIPE_PRICE_CREATOR,
    studio:  process.env.STRIPE_PRICE_STUDIO,
  }
}

/**
 * Reverse map: Stripe priceId → planId. Returns null when the price
 * is unknown (logs upstream so we know to update env vars).
 */
export function planFromStripePriceId(priceId: string): PlanId | null {
  const map = getStripePriceMap()
  for (const [plan, id] of Object.entries(map)) {
    if (id && id === priceId) return plan as PlanId
  }
  return null
}
