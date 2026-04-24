/**
 * Plan tier helpers — single source of truth for feature gating in the UI.
 *
 * Note: the Supabase `profiles.plan` column currently accepts
 * `'free' | 'starter' | 'studio'` (see 20260321000000_initial_schema.sql),
 * but the product surface already speaks about 'pro' and 'creator' tiers
 * (UserPlan in CloneVoiceModal, pricing pages). Keep this helper loose so
 * adding a new plan via a later migration doesn't break the guards.
 */

export type UserPlan = 'free' | 'starter' | 'pro' | 'creator' | 'studio' | string

/** Plans that unlock white-label (remove CLYRO watermark + branded share pages). */
export const WHITELABEL_PLANS: ReadonlySet<UserPlan> = new Set([
  'pro',
  'creator',
  'studio',
])

/** Plans that unlock voice cloning. */
export const VOICE_CLONE_PLANS: ReadonlySet<UserPlan> = new Set([
  'starter',  // limited to 2 voices
  'pro',
  'creator',
  'studio',
])

/** Plans that unlock Autopilot (scheduled auto-generation). */
export const AUTOPILOT_PLANS: ReadonlySet<UserPlan> = new Set([
  'pro',
  'creator',
  'studio',
])

export function hasWhitelabel(plan: UserPlan | null | undefined): boolean {
  return !!plan && WHITELABEL_PLANS.has(plan)
}

export function hasAutopilot(plan: UserPlan | null | undefined): boolean {
  return !!plan && AUTOPILOT_PLANS.has(plan)
}

/** Short human label for the plan (UI chips, banners). */
export function planLabel(plan: UserPlan | null | undefined): string {
  switch (plan) {
    case 'free':    return 'Free'
    case 'starter': return 'Starter'
    case 'pro':     return 'Pro'
    case 'creator': return 'Creator'
    case 'studio':  return 'Studio'
    default:        return 'Free'
  }
}
