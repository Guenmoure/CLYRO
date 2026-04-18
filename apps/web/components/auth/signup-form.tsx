'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'
import { useLanguage } from '@/lib/i18n'

export function SignupForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createBrowserClient()
  const { t }        = useLanguage()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Pré-script passé depuis le hero textarea (?script=...)
  useEffect(() => {
    const raw = searchParams.get('script')
    if (raw) {
      try {
        const decoded = decodeURIComponent(raw)
        // Persist across email-confirmation round-trip
        localStorage.setItem('clyro_prefilled_script', decoded)
      } catch {
        // Ignore malformed param
      }
    }
  }, [searchParams])

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      setSuccess(true)
    } catch {
      setError(t('errorOccurred'))
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSignup() {
    setLoading(true)
    setError(null)

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })

    if (oauthError) {
      setError(oauthError.message)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-center py-4">
        <div className="w-16 h-16 bg-success/10 border border-success/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-success text-2xl">✓</span>
        </div>
        <h3 className="font-display font-semibold text-white mb-2">{t('checkYourEmail')}</h3>
        <p className="text-white/50 text-sm font-body">
          {t('confirmationSent')} <strong className="text-white">{email}</strong>.
          {t('clickToActivate')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Google OAuth */}
      <button
        onClick={handleGoogleSignup}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 glass glass-hover text-white/80 font-body font-medium py-3 px-4 rounded-xl transition-all duration-200 disabled:opacity-50"
      >
        <GoogleIcon />
        {t('continueWithGoogle')}
      </button>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-white/10" />
        <span className="font-mono text-xs text-white/30 uppercase tracking-widest">{t('or')}</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* Signup form */}
      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label htmlFor="signup-name" className="label-mono block mb-2">{t('fullName')}</label>
          <input
            id="signup-name"
            name="full_name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="John Doe"
            required
            className="w-full glass rounded-xl px-4 py-3 text-white/80 font-body text-sm placeholder:text-white/25 focus:outline-none focus:border-clyro-primary/50 transition-all duration-200"
          />
        </div>
        <div>
          <label htmlFor="signup-email" className="label-mono block mb-2">{t('email')}</label>
          <input
            id="signup-email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className="w-full glass rounded-xl px-4 py-3 text-white/80 font-body text-sm placeholder:text-white/25 focus:outline-none focus:border-clyro-primary/50 transition-all duration-200"
          />
        </div>
        <div>
          <label htmlFor="signup-password" className="label-mono block mb-2">{t('password')}</label>
          <input
            id="signup-password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('minChars')}
            required
            minLength={8}
            className="w-full glass rounded-xl px-4 py-3 text-white/80 font-body text-sm placeholder:text-white/25 focus:outline-none focus:border-clyro-primary/50 transition-all duration-200"
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm font-body bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-grad-primary text-white font-display font-semibold py-3 px-4 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? t('creatingAccount') : t('createAccount')}
        </button>
      </form>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  )
}
