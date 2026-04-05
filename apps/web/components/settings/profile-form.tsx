'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useUser } from '@/hooks/use-user'
import { toast } from '@/components/ui/toast'

const supabase = createBrowserClient()

export function ProfileForm() {
  const { profile, email, loading, refetch } = useUser()
  const [fullName, setFullName] = useState('')
  const [saving, setSaving]     = useState(false)

  const displayName = fullName || profile?.full_name || ''

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName || profile.full_name })
        .eq('id', profile.id)

      if (error) { toast.error('Impossible de sauvegarder le profil.'); return }
      await refetch()
      toast.success('Profil mis à jour.')
    } catch { toast.error('Une erreur est survenue.') }
    finally { setSaving(false) }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-4 bg-gray-100 dark:bg-white/5 rounded w-1/3" />
        <div className="h-11 bg-gray-100 dark:bg-white/5 rounded-xl" />
        <div className="h-4 bg-gray-100 dark:bg-white/5 rounded w-1/2" />
        <div className="h-11 bg-gray-100 dark:bg-white/5 rounded-xl" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div>
        <label className="font-mono text-[11px] uppercase tracking-widest text-gray-400 dark:text-white/40 mb-2 block">Nom complet</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Jean Dupont"
          className="w-full glass rounded-xl px-4 py-3 text-gray-700 dark:text-white/80 font-body text-sm placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none focus:border-clyro-primary/50 transition-all duration-200"
        />
      </div>

      <div>
        <label className="font-mono text-[11px] uppercase tracking-widest text-gray-400 dark:text-white/40 mb-2 block">Email</label>
        <input
          type="email"
          value={email ?? ''}
          disabled
          className="w-full bg-gray-100 dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.04] rounded-xl px-4 py-3 text-gray-400 dark:text-white/30 font-body text-sm cursor-not-allowed"
        />
        <p className="text-xs text-gray-400 dark:text-white/30 mt-1 font-body">L&apos;email ne peut pas être modifié ici.</p>
      </div>

      <div className="flex items-center gap-4 pt-1">
        <button type="submit" disabled={saving}
          className="bg-grad-primary text-white font-display font-semibold px-6 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-50 text-sm transition-opacity">
          {saving ? 'Sauvegarde…' : 'Sauvegarder'}
        </button>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-gray-400 dark:text-white/40 uppercase tracking-widest">Plan</span>
          <span className="font-mono text-xs text-clyro-accent uppercase tracking-widest bg-clyro-accent/10 border border-clyro-accent/20 px-2 py-1 rounded-full">
            {profile?.plan ?? 'free'}
          </span>
        </div>
      </div>
    </form>
  )
}
