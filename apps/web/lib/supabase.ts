import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? ''
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

/**
 * Client Supabase pour les composants React (browser-side).
 * Utilise @supabase/ssr qui gère la session dans les cookies du navigateur.
 *
 * Guard: si les env vars NEXT_PUBLIC_SUPABASE_* sont absentes (ex: Vercel sans
 * env configurées), on retourne un stub avec des URLs factices pour éviter un
 * crash SSR. Les appels auth retournent des sessions vides, ce qui est le
 * comportement attendu sans env valides.
 */
export function createBrowserClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    // Stub silencieux — empêche le crash SSR quand les env vars sont absentes.
    return createSSRBrowserClient<Database>(
      'https://placeholder.supabase.co',
      'placeholder-anon-key',
    )
  }
  return createSSRBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON)
}

/**
 * Client Supabase pour les Route Handlers Next.js (server-side).
 * Lecture seule de la session utilisateur.
 */
export function createServerClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    throw new Error(
      'Missing Supabase environment variables — add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to Vercel.'
    )
  }
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON)
}
