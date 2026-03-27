'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type UserPlan = Database['public']['Tables']['profiles']['Row']['plan']

interface UseCreditsReturn {
  credits: number
  plan: UserPlan
  loading: boolean
  hasCredits: boolean
  isUnlimited: boolean
  refetch: () => Promise<void>
}

/**
 * Hook pour lire et écouter en temps réel les crédits de l'utilisateur.
 * Se met à jour automatiquement via Supabase Realtime quand les crédits changent.
 */
export function useCredits(): UseCreditsReturn {
  const supabase = createBrowserClient()
  const [credits, setCredits] = useState(0)
  const [plan, setPlan] = useState<UserPlan>('free')
  const [loading, setLoading] = useState(true)

  const fetchCredits = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { data } = await supabase
      .from('profiles')
      .select('credits, plan')
      .eq('id', user.id)
      .single()

    const profile = data as { credits: number; plan: UserPlan } | null
    if (profile) {
      setCredits(profile.credits)
      setPlan(profile.plan)
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchCredits()

    // Écouter les mises à jour Realtime sur la table profiles
    const channel = supabase
      .channel('credits-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          const updated = payload.new as { credits: number; plan: UserPlan }
          setCredits(updated.credits)
          setPlan(updated.plan)
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [fetchCredits, supabase])

  return {
    credits,
    plan,
    loading,
    hasCredits: plan === 'studio' || credits > 0,
    isUnlimited: plan === 'studio',
    refetch: fetchCredits,
  }
}
