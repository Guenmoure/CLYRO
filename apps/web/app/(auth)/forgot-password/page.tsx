'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Mail, Loader2, CheckCircle } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { Button } from '@/components/ui/button'
import { createBrowserClient } from '@/lib/supabase'
import { toast } from '@/components/ui/toast'
import { useLanguage } from '@/lib/i18n'

export default function ForgotPasswordPage() {
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || loading) return

    setLoading(true)
    try {
      const supabase = createBrowserClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setSent(true)
    } catch (err) {
      toast.error(t('errorOccurred'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        <Logo variant="full" size="lg" href={false} />
        <p className="text-[--text-muted] font-body text-sm">
          {t('resetYourPassword')}
        </p>
      </div>

      {/* Card */}
      <div className="bg-card border border-border rounded-2xl p-8">
        {sent ? (
          <div className="flex flex-col items-center text-center gap-4 py-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle size={24} className="text-emerald-500" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground">
                {t('checkYourEmail')}
              </h2>
              <p className="text-[--text-secondary] text-sm mt-2 font-body max-w-xs">
                {t('resetEmailSent')} <strong className="text-foreground">{email}</strong>.
                {' '}{t('resetEmailClick')}
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full mt-2">
              <Button variant="primary" size="md" onClick={() => setSent(false)}>
                {t('tryAnotherEmail')}
              </Button>
              <Button variant="ghost" size="md" asChild>
                <Link href="/login">
                  <ArrowLeft size={14} className="mr-1.5" />
                  {t('backToLogin')}
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="font-display text-xl font-semibold text-foreground">
                {t('forgotPassword')}
              </h2>
              <p className="text-[--text-secondary] text-sm mt-1 font-body">
                {t('forgotPasswordDesc')}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block font-body text-sm font-medium text-foreground mb-1.5">
                  {t('emailAddress')}
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--text-muted]" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoFocus
                    autoComplete="email"
                    className="w-full rounded-xl border border-border bg-input px-3 py-2.5 pl-10 font-body text-sm text-foreground placeholder:text-[--text-muted] focus:outline-none focus:ring-2 focus:ring-ring/50 transition-shadow"
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full"
                disabled={loading || !email.trim()}
              >
                {loading ? (
                  <><Loader2 size={14} className="animate-spin mr-1.5" /> {t('sending')}</>
                ) : (
                  t('sendResetLink')
                )}
              </Button>
            </form>

            <div className="mt-5 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-sm font-body text-[--text-secondary] hover:text-foreground transition-colors"
              >
                <ArrowLeft size={14} />
                {t('backToLogin')}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
