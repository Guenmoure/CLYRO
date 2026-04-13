import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? ''
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

/**
 * Client Supabase pour les composants React (browser-side).
 * Utilise createClientComponentClient qui stocke la session dans les cookies.
 *
 * Guard: si les env vars NEXT_PUBLIC_SUPABASE_* sont absentes (ex: Vercel sans
 * env configurées), on retourne un client "anon" direct de @supabase/supabase-js
 * avec des URLs factices pour éviter un crash SSR. Les appels auth retournent
 * des sessions vides, ce qui est le comportement attendu sans env valides.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createBrowserClient(): any {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    // Stub silencieux — empêche le crash SSR quand les env vars sont absentes.
    // Les composants qui en dépendent afficheront simplement l'état "non connecté".
    return createClient('https://placeholder.supabase.co', 'placeholder-anon-key')
  }
  return createClientComponentClient<Database>()
}

/**
 * Client Supabase pour les Route Handlers Next.js (server-side).
 * Lecture seule de la session utilisateur.
 */
export function createServerClient(): SupabaseClient<Database> {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    throw new Error(
      'Missing Supabase environment variables — add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to Vercel.'
    )
  }
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON)
}
