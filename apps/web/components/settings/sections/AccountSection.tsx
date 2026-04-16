'use client'

import { useEffect, useState } from 'react'
import { Loader2, Check, Camera } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { toast } from '@/components/ui/toast'

export function AccountSection() {
  const supabase = createBrowserClient()
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
      toast.success('Profile updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save error')
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
      toast.success('Email sent')
      setTimeout(() => setResetSent(false), 10_000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
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
        <h2 className="font-display text-2xl font-bold text-foreground">Account</h2>
        <p className="font-body text-sm text-[--text-secondary] mt-1">
          Manage your personal information and security.
        </p>
      </div>

      {/* Avatar */}
      <Field label="Profile photo">
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
              <Camera size={13} /> Upload photo
            </button>
            <p className="font-body text-xs text-[--text-muted]">Max 4 MB · Coming soon.</p>
          </div>
        </div>
      </Field>

      {/* Name */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="First name">
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-body text-foreground placeholder:text-[--text-muted] focus:outline-none focus:border-blue-500 transition-colors"
            placeholder="Your first name"
          />
        </Field>
        <Field label="Last name">
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-body text-foreground placeholder:text-[--text-muted] focus:outline-none focus:border-blue-500 transition-colors"
            placeholder="Your last name"
          />
        </Field>
      </div>

      <div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-gray-900 dark:bg-foreground dark:text-gray-950 text-white px-5 py-2.5 text-sm font-display font-semibold hover:opacity-90 disabled:opacity-60 transition-all"
        >
          {saving ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : 'Save'}
        </button>
      </div>

      {/* Email */}
      <Field label="Email">
        <p className="font-body text-sm text-foreground mb-2">{email}</p>
        <button
          type="button"
          disabled
          title="Coming soon"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-body font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Change email
        </button>
      </Field>

      {/* Password */}
      <Field label="Password">
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
            <><Loader2 size={13} className="animate-spin" /> Sending…</>
          ) : resetSent ? (
            <><Check size={13} /> Email sent</>
          ) : (
            'Change password'
          )}
        </button>
        <p className="font-body text-xs text-[--text-muted] mt-2">
          A secure link will be sent to <span className="font-mono">{email}</span>. Valid for 1 hour.
        </p>
      </Field>

      {/* 2FA (stub) */}
      <Field label="Two-factor authentication">
        <div className="flex items-center gap-3">
          <div className="relative inline-flex items-center">
            <div className="w-10 h-5 rounded-full bg-muted border border-border" />
            <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-background shadow" />
          </div>
          <span className="font-body text-sm text-[--text-muted]">Disabled</span>
        </div>
        <p className="font-body text-xs text-[--text-muted] mt-2">
          2FA is not yet available on your account.
        </p>
      </Field>
    </div>
  )
}

// ── Field ─────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="font-body text-sm font-semibold text-foreground">{label}</p>
      {children}
    </div>
  )
}
