import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type { Database } from '@/lib/database.types'

/**
 * OAuth callback handler pour Google / Apple / SSO
 * Supabase redirige ici après l'authentification externe
 */
function safeRedirect(raw: string | null): string {
  if (!raw) return '/dashboard'
  // Same-origin relative paths only — avoid open-redirect via "//evil.com" or absolute URLs
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/dashboard'
  return raw
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const redirectTo = safeRedirect(requestUrl.searchParams.get('redirectTo'))

  if (code) {
    const supabase = createRouteHandlerClient<Database>({ cookies })
    try {
      await supabase.auth.exchangeCodeForSession(code)
    } catch {
      return NextResponse.redirect(new URL('/login?error=auth_callback_failed', requestUrl.origin))
    }
  }

  return NextResponse.redirect(new URL(redirectTo, requestUrl.origin))
}
