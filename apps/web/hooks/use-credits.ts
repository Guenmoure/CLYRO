'use client'

import { useEffect, useState, useCallback } from 'react'
import { isUnlimitedPlan, type PlanId } from '@clyro/shared'
import { createBrowserClient } from '@/lib/supabase'

interface UseCreditsReturn {
  credits:                 number
  monthlyCredits:          number
  plan:                    PlanId
  subscriptionRenewedAt:   string | null
  loading:                 boolean
  hasCredits:              boolean
  isUnlimited:             boolean
  refetch:                 () => Promise<void>
}

/**
 * Reads the user's credit balance, plan, and renewal date in real time
 * via Supabase Realtime. The single source of truth for "do I have
 * enough credits to generate" on the client.
 */
export function useCredits(): UseCreditsReturn {
  const supabase = createBrowserClient()
  const [credits, setCredits] = useState(0)
  const [monthlyCredits, setMonthlyCredits] = useState(0)
  const [plan, setPlan] = useState<PlanId>('free')
  const [subscriptionRenewedAt, setSubscriptionRenewedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // Operational override — true for test / staging / support accounts.
  // Migrated in 20260616000000_profile_internal_unlimited.sql. Only writable
  // server-side (service-role), so a client can READ it (own row only)
  // but can't promote itself to unlimited.
  const [internalUnlimited, setInternalUnlimited] = useState(false)

  const fetchCredits = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('profiles')
      .select('credits, monthly_credits, plan, subscription_renewed_at, internal_unlimited')
      .eq('id', user.id)
      .single()

    const profile = data as {
      credits: number
      monthly_credits: number | null
      plan: PlanId
      subscription_renewed_at: string | null
      internal_unlimited: boolean | null
    } | null

    if (profile) {
      setCredits(profile.credits)
      setMonthlyCredits(profile.monthly_credits ?? 0)
      setPlan(profile.plan)
      setSubscriptionRenewedAt(profile.subscription_renewed_at)
      setInternalUnlimited(profile.internal_unlimited ?? false)
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchCredits()

    // Listen for realtime updates on profiles so the banner reflects
    // deductions/grants the moment they hit the DB.
    const channel = supabase
      .channel('credits-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const updated = payload.new as {
            credits: number
            monthly_credits?: number
            plan: PlanId
            subscription_renewed_at?: string | null
            internal_unlimited?: boolean | null
          }
          setCredits(updated.credits)
          if (typeof updated.monthly_credits === 'number') setMonthlyCredits(updated.monthly_credits)
          setPlan(updated.plan)
          if ('subscription_renewed_at' in updated) {
            setSubscriptionRenewedAt(updated.subscription_renewed_at ?? null)
          }
          if ('internal_unlimited' in updated) {
            setInternalUnlimited(updated.internal_unlimited ?? false)
          }
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [fetchCredits, supabase])

  // The `internal_unlimited` flag also bypasses the credit balance check
  // so the UI surfaces the right state (button enabled, no « out of
  // credits » banner) for test / staging accounts.
  const unlimited = isUnlimitedPlan(plan) || internalUnlimited

  return {
    credits,
    monthlyCredits,
    plan,
    subscriptionRenewedAt,
    loading,
    hasCredits:  unlimited || credits > 0,
    isUnlimited: unlimited,
    refetch:     fetchCredits,
  }
}
