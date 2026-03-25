import { createServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

/**
 * OAuth callback handler pour Google / Apple / SSO
 * Supabase redirige ici après l'authentification externe
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const redirectTo = requestUrl.searchParams.get('redirectTo') ?? '/dashboard'

  if (code) {
    const supabase = createServerClient()
    try {
      await supabase.auth.exchangeCodeForSession(code)
    } catch {
      return NextResponse.redirect(new URL('/login?error=auth_callback_failed', requestUrl.origin))
    }
  }

  return NextResponse.redirect(new URL(redirectTo, requestUrl.origin))
}
