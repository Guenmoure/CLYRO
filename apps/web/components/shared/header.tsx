'use client'

import { createBrowserClient } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import type { Database } from '@/lib/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

export function Header() {
  const supabase = createBrowserClient()
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data)
    }
    loadProfile()
  }, [supabase])

  return (
    <header className="h-14 bg-brand-surface border-b border-brand-border flex items-center justify-end px-6">
      <div className="flex items-center gap-3">
        {profile && (
          <>
            {/* Credits badge */}
            <div className="hidden sm:flex items-center gap-2 bg-brand-bg border border-brand-border rounded-full px-4 py-1.5">
              <span className="font-mono text-xs text-brand-muted uppercase tracking-widest">
                Crédits
              </span>
              <span className="font-display font-bold text-brand-primary text-sm">
                {profile.credits}
              </span>
            </div>

            {/* Plan badge */}
            <div className="hidden sm:block bg-brand-primary-light border border-brand-primary/20 rounded-full px-4 py-1.5">
              <span className="font-mono text-xs uppercase tracking-widest text-brand-primary font-medium capitalize">
                {profile.plan}
              </span>
            </div>

            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-grad-primary flex items-center justify-center">
              <span className="font-display font-bold text-white text-sm">
                {(profile.full_name ?? 'U').charAt(0).toUpperCase()}
              </span>
            </div>
          </>
        )}
      </div>
    </header>

  )
}
