import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes nécessitant une authentification
const PROTECTED_ROUTES = [
  '/dashboard',
  '/faceless',
  '/motion',
  '/history',
  '/voices',
  '/settings',
]

// Routes accessibles uniquement en non-authentifié
const AUTH_ROUTES = ['/login', '/signup']

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // Refresh session + vérifier l'authentification
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const pathname = req.nextUrl.pathname

  // Rediriger vers /login si route protégée et non authentifié
  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route))
  if (isProtected && !session) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Rediriger vers /dashboard si déjà authentifié et tente d'accéder à auth routes
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route))
  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return res
}

export const config = {
  matcher: [
    /*
     * Matcher pour toutes les routes sauf :
     * - API routes Next.js (_next/static, _next/image, favicon.ico)
     * - Fichiers statiques (images, fonts, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
