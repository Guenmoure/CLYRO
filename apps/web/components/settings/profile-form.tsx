'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useUser } from '@/hooks/use-user'
import { toast } from '@/components/ui/toast'

const supabase = createBrowserClient()

export function ProfileForm() {
  const { profile, email, loading, refetch } = useUser()
  const [fullName, setFullName] = useState('')
  const [saving, setSaving] = useState(false)

  // Initialiser le champ avec la valeur actuelle (une seule fois)
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

      if (error) {
        toast.error('Impossible de sauvegarder le profil.')
        return
      }

      await refetch()
      toast.success('Profil mis à jour.')
    } catch {
      toast.error('Une erreur est survenue.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-4 bg-navy-800 rounded w-1/3" />
        <div className="h-11 bg-navy-800 rounded-xl" />
        <div className="h-4 bg-navy-800 rounded w-1/2" />
        <div className="h-11 bg-navy-800 rounded-xl" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div>
        <label className="label-mono block mb-2">Nom complet</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Jean Dupont"
          className="w-full bg-navy-800 border border-border rounded-xl px-4 py-3 text-foreground font-body text-sm placeholder:text-muted-foreground focus:outline-none focus:border-clyro-blue focus:ring-1 focus:ring-clyro-blue transition-colors"
        />
      </div>

      <div>
        <label className="label-mono block mb-2">Email</label>
        <input
          type="email"
          value={email ?? ''}
          disabled
          className="w-full bg-navy-800/50 border border-border rounded-xl px-4 py-3 text-muted-foreground font-body text-sm cursor-not-allowed"
        />
        <p className="text-xs text-muted-foreground mt-1 font-body">
          L&apos;email ne peut pas être modifié ici.
        </p>
      </div>

      <div className="flex items-center gap-4 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="bg-grad-primary text-white font-display font-semibold px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
        >
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Plan</span>
          <span className="font-mono text-xs text-clyro-purple uppercase tracking-widest bg-clyro-purple/10 border border-clyro-purple/20 px-2 py-1 rounded-full">
            {profile?.plan ?? 'free'}
          </span>
        </div>
      </div>
    </form>
  )
}
