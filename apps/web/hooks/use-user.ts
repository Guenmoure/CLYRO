'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

interface UseUserReturn {
  profile: Profile | null
  email: string | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Hook client-side pour récupérer le profil Supabase de l'utilisateur connecté.
 * Écoute les changements de session (connexion / déconnexion).
 */
export function useUser(): UseUserReturn {
  const supabase = createBrowserClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadProfile() {
    setLoading(true)
    setError(null)

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        setProfile(null)
        setEmail(null)
        return
      }

      setEmail(user.email ?? null)

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError) {
        setError(profileError.message)
        return
      }

      setProfile(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()

    // Rafraîchir le profil à chaque changement d'auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadProfile()
    })

    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { profile, email, loading, error, refetch: loadProfile }
}
