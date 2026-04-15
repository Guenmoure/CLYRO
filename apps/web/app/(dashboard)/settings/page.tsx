'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ProfileForm } from '@/components/settings/profile-form'
import { Shield, CreditCard, ChevronRight, User, Bell, Loader2, Check } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { toast } from '@/components/ui/toast'

export default function SettingsPage() {
  const [resetting, setResetting] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  async function handlePasswordReset() {
    if (resetting || resetSent) return
    setResetting(true)
    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.email) {
        toast.error('Impossible de récupérer ton email')
        return
      }
      const { error } = await supabase.auth.resetPasswordForEmail(session.user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setResetSent(true)
      toast.success('Email de réinitialisation envoyé')
      setTimeout(() => setResetSent(false), 10_000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l\'envoi')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background px-6 py-8">
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">

        {/* Page header */}
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-[--text-secondary] font-semibold mb-1">Compte</p>
          <h1 className="font-display text-3xl font-bold text-foreground">Paramètres</h1>
          <p className="font-body text-sm text-[--text-secondary] mt-1">
            Gère ton profil, ton abonnement et tes préférences.
          </p>
        </div>

        {/* Profile */}
        <section className="rounded-2xl border border-border bg-card overflow-hidden">
          <header className="flex items-center gap-3 px-6 py-4 border-b border-border">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <User size={16} className="text-blue-500" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-foreground">Profil</h2>
              <p className="font-body text-xs text-[--text-secondary]">Nom affiché et informations personnelles</p>
            </div>
          </header>
          <div className="p-6">
            <ProfileForm />
          </div>
        </section>

        {/* Billing — clickable card with interactive hover */}
        <Link
          href="/settings/billing"
          className="card-interactive flex items-center gap-4 rounded-2xl border border-border bg-card px-6 py-5 group"
        >
          <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
            <CreditCard size={18} className="text-purple-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display font-semibold text-foreground">Abonnement & crédits</h2>
            <p className="font-body text-sm text-[--text-secondary] mt-0.5">
              Gérer ton plan, tes crédits et tes moyens de paiement.
            </p>
          </div>
          <ChevronRight
            size={18}
            className="text-[--text-secondary] group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0"
          />
        </Link>

        {/* Security */}
        <section className="rounded-2xl border border-border bg-card overflow-hidden">
          <header className="flex items-center gap-3 px-6 py-4 border-b border-border">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Shield size={16} className="text-emerald-500" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-foreground">Sécurité</h2>
              <p className="font-body text-xs text-[--text-secondary]">Mot de passe et accès au compte</p>
            </div>
          </header>
          <div className="p-6 space-y-4">
            <p className="font-body text-sm text-[--text-secondary]">
              Ton mot de passe peut être réinitialisé via un lien sécurisé envoyé par email. Le lien reste valide 1h.
            </p>
            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={resetting || resetSent}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 font-body text-sm font-medium transition-all ${
                resetSent
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 cursor-default'
                  : 'bg-muted border border-border text-foreground hover:bg-border hover:border-border disabled:opacity-60'
              }`}
            >
              {resetting ? (
                <><Loader2 size={13} className="animate-spin" /> Envoi en cours…</>
              ) : resetSent ? (
                <><Check size={13} /> Email envoyé</>
              ) : (
                <>Envoyer le lien de réinitialisation →</>
              )}
            </button>
          </div>
        </section>

        {/* Notifications (placeholder — could become a full section later) */}
        <section className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Bell size={15} className="text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-body text-sm text-foreground">Notifications par email</p>
            <p className="font-body text-xs text-[--text-secondary] mt-0.5">
              Bientôt disponible — choisis quels événements déclenchent un email.
            </p>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full bg-muted border border-border text-[--text-muted]">
            Bientôt
          </span>
        </section>

      </div>
    </div>
  )
}
