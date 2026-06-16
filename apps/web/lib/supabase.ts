import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? ''
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

/**
 * Client Supabase pour les composants React (browser-side).
 * Utilise @supabase/ssr qui gère la session dans les cookies du navigateur.
 */
export function createBrowserClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
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
