'use client'

import { createBrowserClient } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { Bell, Search } from 'lucide-react'
import type { Database } from '@/lib/database.types'
import { ThemeToggle } from '@/components/ui/theme-toggle'

type Profile = Database['public']['Tables']['profiles']['Row']

export function Header() {
  const supabase = createBrowserClient()
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data as Profile)
    }
    loadProfile()
  }, [supabase])

  return (
    <header className="animate-header-in h-16 glass-heavy glass-border-b flex items-center px-6 gap-4 shrink-0 relative z-10">
      {/* Search */}
      <div className="flex-1 max-w-sm">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/25 pointer-events-none" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full glass rounded-xl pl-9 pr-4 py-2 text-sm text-gray-700 dark:text-white/80 placeholder-gray-400 dark:placeholder-white/25 focus:outline-none focus:border-clyro-blue/40 transition-all duration-200 font-body"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 ml-auto">
        {/* Theme toggle */}
        <ThemeToggle />

        {/* Notification bell */}
        <button
          type="button"
          aria-label="Notifications"
          className="relative w-9 h-9 rounded-xl glass glass-hover flex items-center justify-center text-white/50 dark:text-white/50 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
        >
          <Bell size={17} strokeWidth={1.5} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
        </button>

        {/* Credits */}
        {profile && (
          <div className="hidden sm:flex items-center gap-2 glass-blue rounded-full px-3 py-1.5">
            <span className="font-mono text-[10px] text-white/40 uppercase tracking-widest">Credits</span>
            <span className="font-display font-bold text-clyro-cyan text-sm">{profile.credits}</span>
          </div>
        )}

        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-clyro-blue to-clyro-purple flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(59,142,240,0.4)]">
          <span className="font-display font-bold text-white text-sm">
            {(profile?.full_name ?? 'U').charAt(0).toUpperCase()}
          </span>
        </div>
      </div>
    </header>
  )
}
