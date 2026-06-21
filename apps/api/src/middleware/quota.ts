import type { Request, Response, NextFunction } from 'express'
import { type PlanId, isUnlimitedPlan } from '@clyro/shared'
import { getBalance } from '../services/credits'
import { logger } from '../lib/logger'

export interface UserProfile {
  credits:         number
  monthly_credits: number
  plan:            PlanId
}

// Extend Express Request to carry the authenticated user's profile.
// Routes can read req.userProfile after this middleware runs.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userProfile?: UserProfile
    }
  }
}

/**
 * Pre-generation quota check.
 *
 * Loads the user's profile and ensures they have at least 1 credit.
 * The exact deduction (which depends on the chosen mode + duration)
 * happens later via deductCredits() in the credits service.
 *
 * Doesn't block users on unlimited plans (none today, but reserved
 * via UNLIMITED_PLANS in @clyro/shared).
 *
 * Must run AFTER authMiddleware so req.userId is set.
 */
export async function quotaMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
      return
    }

    const balance = await getBalance(req.userId)
    if (!balance) {
      res.status(404).json({ error: 'Profile not found', code: 'NOT_FOUND' })
      return
    }

    // Audit 19/06/26 — was only checking `isUnlimitedPlan(plan)`. Test /
    // staging / support accounts that carry the operational
    // `internal_unlimited` flag would still be 403'd here when their
    // visible balance hit 0, even though deductCredits() correctly
    // short-circuits the actual deduction. Now both gates respect the
    // same source of truth.
    const unlimited = isUnlimitedPlan(balance.plan) || balance.internal_unlimited
    if (!unlimited && balance.credits <= 0) {
      logger.warn({ userId: req.userId, credits: balance.credits }, 'Quota exceeded')
      res.status(403).json({
        error:   'Insufficient credits',
        code:    'INSUFFICIENT_CREDITS',
        balance: balance.credits,
      })
      return
    }

    req.userProfile = {
      credits:         balance.credits,
      monthly_credits: balance.monthly_credits,
      plan:            balance.plan,
    }
    next()
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'quotaMiddleware error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
}

/**
 * Legacy 1-credit deduction. Kept as a thin wrapper so existing
 * callers compile, but new code should call deductCredits() from
 * services/credits.ts directly with the per-video cost computed via
 * creditCostForVideo(durationSeconds, mode).
 *
 * @deprecated Use deductCredits / creditCostForVideo from services/credits
 */
export async function deductCredit(_userId: string, _profile: UserProfile): Promise<void> {
  logger.warn(
    'deductCredit (legacy 1-credit path) was called — switch the caller to deductCredits()'
    + ' from services/credits.ts to compute the real per-mode/duration cost.'
  )
  // Intentionally a no-op: pipelines that have been migrated will
  // deduct the correct amount themselves; legacy callers would
  // double-charge if we deducted again here.
}
