'use client'

import { useEffect, useState } from 'react'
import {
  Loader2, Check, Shield, Smartphone, Mail,
  AlertTriangle, ShieldCheck,
} from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { useLanguage } from '@/lib/i18n'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

export function SecuritySection() {
  const supabase = createBrowserClient()
  const { t } = useLanguage()
  const [email, setEmail]   = useState('')
  const [loading, setLoading] = useState(true)

  // Password change
  const [newPassword, setNewPassword]   = useState('')
  const [confirmPass, setConfirmPass]   = useState('')
  const [saving, setSaving]             = useState(false)
  const [showForm, setShowForm]         = useState(false)

  // Email reset fallback
  const [resetting, setResetting]       = useState(false)
  const [resetSent, setResetSent]       = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      setEmail(session?.user?.email ?? '')
      setLoading(false)
    }
    load()
  }, [supabase])

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPass) {
      toast.error('Passwords do not match')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      toast.success('Password changed')
      setNewPassword('')
      setConfirmPass('')
      setShowForm(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function handleResetEmail() {
    if (resetting || resetSent) return
    setResetting(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setResetSent(true)
      toast.success('Email sent')
      setTimeout(() => setResetSent(false), 10_000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setResetting(false)
    }
  }

  const strength = getPasswordStrength(newPassword)

  if (loading) {
    return <div className="py-20 flex items-center justify-center"><Loader2 className="animate-spin text-[--text-muted]" /></div>
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">{t('securitySettings')}</h2>
        <p className="font-body text-sm text-[--text-secondary] mt-1">
          Password, authentication and active sessions.
        </p>
      </div>

      {/* Password */}
      <section className="rounded-2xl border border-border bg-card overflow-hidden">
        <header className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Shield size={16} className="text-emerald-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-semibold text-foreground">Password</p>
            <p className="font-body text-xs text-[--text-secondary]">
              Account associated with <span className="font-mono">{email}</span>
            </p>
          </div>
        </header>

        <div className="p-5 space-y-3">
          {!showForm ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-body font-medium text-foreground hover:bg-muted transition-colors"
              >
                Change password
              </button>
              <button
                type="button"
                onClick={handleResetEmail}
                disabled={resetting || resetSent}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-body font-medium transition-colors',
                  resetSent
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 cursor-default'
                    : 'bg-background border-border text-[--text-secondary] hover:text-foreground disabled:opacity-60',
                )}
              >
                {resetting ? <><Loader2 size={13} className="animate-spin" /> Sending…</> :
                  resetSent ? <><Check size={13} /> Email sent</> :
                  <><Mail size={13} /> Receive link via email</>}
              </button>
            </div>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label htmlFor="new-pass" className="font-body text-xs font-semibold text-foreground mb-1.5 block">
                  {t('newPassword')}
                </label>
                <input
                  id="new-pass"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm font-body text-foreground placeholder:text-[--text-muted] focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                />
                {newPassword && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', strength.color)} style={{ width: `${strength.percent}%` }} />
                    </div>
                    <span className={cn('font-mono text-[10px] uppercase', strength.textColor)}>{strength.label}</span>
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="confirm-pass" className="font-body text-xs font-semibold text-foreground mb-1.5 block">
                  Confirm
                </label>
                <input
                  id="confirm-pass"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm font-body text-foreground placeholder:text-[--text-muted] focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="Retype the same password"
                  required
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-gray-900 dark:bg-foreground dark:text-gray-950 text-white px-4 py-2 text-sm font-display font-semibold hover:opacity-90 disabled:opacity-60 transition-all"
                >
                  {saving ? <><Loader2 size={13} className="animate-spin" /> {t('saving')}</> : t('save')}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setNewPassword(''); setConfirmPass('') }}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-body text-[--text-secondary] hover:text-foreground transition-colors"
                >
                  {t('cancel')}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* 2FA */}
      <section className="rounded-2xl border border-border bg-card overflow-hidden">
        <header className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Smartphone size={16} className="text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-semibold text-foreground">
              Two-factor authentication
            </p>
            <p className="font-body text-xs text-[--text-secondary]">
              An extra layer of security via an authentication app.
            </p>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full bg-muted border border-border text-[--text-muted] shrink-0">
            Coming soon
          </span>
        </header>
        <div className="p-5 flex items-center gap-3">
          <div className="relative inline-flex items-center opacity-50">
            <div className="w-11 h-6 rounded-full bg-muted border border-border" />
            <div className="absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-background shadow" />
          </div>
          <p className="font-body text-sm text-[--text-secondary]">2FA will be activatable very soon from this screen.</p>
        </div>
      </section>

      {/* Tip banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
        <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-1 min-w-0">
          <p className="font-body text-sm text-foreground font-medium">Tip</p>
          <p className="font-body text-xs text-[--text-secondary]">
            Use a unique password + a password manager (1Password, Bitwarden). Never reuse a password from another service.
          </p>
        </div>
      </div>

      {/* Sessions footer */}
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-5 py-4 flex items-start gap-3">
        <ShieldCheck size={18} className="text-[--text-muted] shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-body text-sm text-foreground">Active sessions</p>
          <p className="font-body text-xs text-[--text-secondary] mt-0.5">
            List of connected devices and remote revocation. Coming soon.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Password strength ────────────────────────────────────────────────────

function getPasswordStrength(pass: string): { percent: number; label: string; color: string; textColor: string } {
  if (!pass) return { percent: 0, label: '', color: '', textColor: '' }
  let score = 0
  if (pass.length >= 8)   score += 25
  if (pass.length >= 12)  score += 15
  if (/[A-Z]/.test(pass)) score += 15
  if (/[0-9]/.test(pass)) score += 20
  if (/[^A-Za-z0-9]/.test(pass)) score += 25

  if (score < 40) return { percent: 25,  label: 'Weak', color: 'bg-error',   textColor: 'text-error'   }
  if (score < 70) return { percent: 60,  label: 'Fair',  color: 'bg-amber-500', textColor: 'text-amber-500' }
  return           { percent: 100, label: 'Strong',   color: 'bg-emerald-500', textColor: 'text-emerald-500' }
}
