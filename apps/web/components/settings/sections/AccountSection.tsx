'use client'

import { useEffect, useState } from 'react'
import { Loader2, Check, Camera } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { useLanguage } from '@/lib/i18n'
import { toast } from '@/components/ui/toast'

export function AccountSection() {
  const supabase = createBrowserClient()
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const [userId, setUserId]       = useState('')
  const [email, setEmail]         = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return
        setUserId(session.user.id)
        setEmail(session.user.email ?? '')
        const { data } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', session.user.id)
          .maybeSingle()
        const parts = (data?.full_name ?? '').trim().split(/\s+/)
        setFirstName(parts[0] ?? '')
        setLastName(parts.slice(1).join(' '))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase])

  const initials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || '?'

  async function handleSave() {
    if (!userId || saving) return
    setSaving(true)
    try {
      const full = `${firstName.trim()} ${lastName.trim()}`.trim()
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: full })
        .eq('id', userId)
      if (error) throw error
      toast.success(t('acc_profile_updated'))
    } catch (err) {
      toast.error(t('acc_save_error'))
    } finally {
      setSaving(false)
    }
  }

  async function handlePasswordReset() {
    if (!email || resetting || resetSent) return
    setResetting(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setResetSent(true)
      toast.success(t('acc_email_sent'))
      setTimeout(() => setResetSent(false), 10_000)
    } catch (err) {
      toast.error(t('acc_error'))
    } finally {
      setResetting(false)
    }
  }

  if (loading) {
    return <div className="py-20 flex items-center justify-center"><Loader2 className="animate-spin text-[--text-muted]" /></div>
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">{t('accountSettings')}</h2>
        <p className="font-body text-sm text-[--text-secondary] mt-1">
          {t('acc_description')}
        </p>
      </div>

      {/* Avatar */}
      <Field label={t('acc_profile_photo')}>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-grad-primary flex items-center justify-center shrink-0 shadow-sm">
            <span className="font-mono text-xl font-bold text-white">{initials}</span>
          </div>
          <div className="space-y-1">
            <button
              type="button"
              disabled
              title="Coming soon"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-body font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Camera size={13} /> {t('acc_upload_photo')}
            </button>
            <p className="font-body text-xs text-[--text-muted]">{t('acc_photo_hint')}</p>
          </div>
        </div>
      </Field>

      {/* Name */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={t('acc_first_name')} htmlFor="account-first-name">
          <input
            id="account-first-name"
            name="first_name"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-body text-foreground placeholder:text-[--text-muted] focus:outline-none focus:border-primary transition-colors"
            placeholder={t('acc_first_name_placeholder')}
          />
        </Field>
        <Field label={t('acc_last_name')} htmlFor="account-last-name">
          <input
            id="account-last-name"
            name="last_name"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-body text-foreground placeholder:text-[--text-muted] focus:outline-none focus:border-primary transition-colors"
            placeholder={t('acc_last_name_placeholder')}
          />
        </Field>
      </div>

      <div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-foreground text-background px-5 py-2.5 text-sm font-display font-semibold hover:opacity-90 disabled:opacity-60 transition-all"
        >
          {saving ? <><Loader2 size={13} className="animate-spin" /> {t('saving')}</> : t('save')}
        </button>
      </div>

      {/* Email */}
      <Field label={t('acc_email')}>
        <p className="font-body text-sm text-foreground mb-2">{email}</p>
        <button
          type="button"
          disabled
          title="Coming soon"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-body font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {t('acc_change_email')}
        </button>
      </Field>

      {/* Password */}
      <Field label={t('acc_password')}>
        <button
          type="button"
          onClick={handlePasswordReset}
          disabled={resetting || resetSent}
          className={`inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-body font-medium transition-colors ${
            resetSent
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 cursor-default'
              : 'bg-background text-foreground hover:bg-muted disabled:opacity-60'
          }`}
        >
          {resetting ? (
            <><Loader2 size={13} className="animate-spin" /> {t('acc_sending')}</>
          ) : resetSent ? (
            <><Check size={13} /> {t('acc_email_sent_btn')}</>
          ) : (
            t('acc_change_password')
          )}
        </button>
        <p className="font-body text-xs text-[--text-muted] mt-2">
          {t('acc_password_reset_hint')} <span className="font-mono">{email}</span>. {t('acc_valid_1h')}
        </p>
      </Field>

      {/* 2FA (stub) */}
      <Field label={t('acc_2fa')}>
        <div className="flex items-center gap-3">
          <div className="relative inline-flex items-center">
            <div className="w-10 h-5 rounded-full bg-muted border border-border" />
            <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-background shadow" />
          </div>
          <span className="font-body text-sm text-[--text-muted]">{t('acc_2fa_disabled')}</span>
        </div>
        <p className="font-body text-xs text-[--text-muted] mt-2">
          {t('acc_2fa_unavailable')}
        </p>
      </Field>
    </div>
  )
}

// ── Field ─────────────────────────────────────────────────────────────────

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="font-body text-sm font-semibold text-foreground">{label}</label>
      {children}
    </div>
  )
}
