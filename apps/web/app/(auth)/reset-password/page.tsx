'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Lock, Loader2, CheckCircle } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { Button } from '@/components/ui/button'
import { createBrowserClient } from '@/lib/supabase'
import { toast } from '@/components/ui/toast'
import { useLanguage } from '@/lib/i18n'

export default function ResetPasswordPage() {
  const { t } = useLanguage()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [sessionError, setSessionError] = useState(false)

  // Supabase delivers the recovery token via a hash fragment.
  // The JS client picks it up automatically on page load,
  // establishing a session for the recovering user.
  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
      }
    })
    // Also check if there's already a session (e.g. user refreshed)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true)
    })
    // Timeout — if no session after 5s, show error
    const timer = setTimeout(() => {
      setSessionReady((ready) => {
        if (!ready) setSessionError(true)
        return ready
      })
    }, 5000)
    return () => clearTimeout(timer)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return

    if (password.length < 8) {
      toast.error(t('rp_tooShort'))
      return
    }
    if (password !== confirmPassword) {
      toast.error(t('rp_mismatch'))
      return
    }

    setLoading(true)
    try {
      const supabase = createBrowserClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
    } catch {
      toast.error(t('errorOccurred'))
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="flex flex-col items-center gap-3">
          <Logo variant="full" size="lg" href={false} />
        </div>
        <div className="bg-card border border-border rounded-2xl p-8">
          <div className="flex flex-col items-center text-center gap-4 py-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle size={24} className="text-emerald-500" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground">
                {t('rp_successTitle')}
              </h2>
              <p className="text-[--text-secondary] text-sm mt-2 font-body max-w-xs">
                {t('rp_successDesc')}
              </p>
            </div>
            <Button variant="primary" size="md" className="mt-2" onClick={() => router.push('/dashboard')}>
              {t('rp_goToDashboard')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col items-center gap-3">
        <Logo variant="full" size="lg" href={false} />
        <p className="text-[--text-muted] font-body text-sm">
          {t('rp_subtitle')}
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-8">
        {sessionError ? (
          <div className="flex flex-col items-center text-center gap-4 py-4">
            <p className="font-display text-lg font-semibold text-foreground">
              {t('rp_expiredTitle')}
            </p>
            <p className="text-[--text-secondary] text-sm font-body max-w-xs">
              {t('rp_expiredDesc')}
            </p>
            <Button variant="primary" size="md" asChild>
              <Link href="/forgot-password">{t('rp_requestNewLink')}</Link>
            </Button>
          </div>
        ) : !sessionReady ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 size={24} className="animate-spin text-[--text-muted]" />
            <p className="text-[--text-muted] text-sm font-body">{t('rp_verifying')}</p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="font-display text-xl font-semibold text-foreground">
                {t('rp_heading')}
              </h2>
              <p className="text-[--text-secondary] text-sm mt-1 font-body">
                {t('rp_headingDesc')}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="new-password" className="block font-body text-sm font-medium text-foreground mb-1.5">
                  {t('rp_newPassword')}
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--text-muted]" />
                  <input
                    id="new-password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={t('minChars')}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    autoFocus
                    className="w-full rounded-xl border border-border bg-input px-3 py-2.5 pl-10 font-body text-sm text-foreground placeholder:text-[--text-muted] focus:outline-none focus:ring-2 focus:ring-ring/50 transition-shadow"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block font-body text-sm font-medium text-foreground mb-1.5">
                  {t('rp_confirmPassword')}
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--text-muted]" />
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder={t('rp_confirmPlaceholder')}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-border bg-input px-3 py-2.5 pl-10 font-body text-sm text-foreground placeholder:text-[--text-muted] focus:outline-none focus:ring-2 focus:ring-ring/50 transition-shadow"
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full"
                disabled={loading || !password.trim() || !confirmPassword.trim()}
              >
                {loading ? (
                  <><Loader2 size={14} className="animate-spin mr-1.5" /> {t('rp_updating')}</>
                ) : (
                  t('rp_updatePassword')
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
