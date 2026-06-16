import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? ''
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

/**
 * Client Supabase pour les composants React (browser-side).
 * Utilise @supabase/auth-helpers-nextjs pour partager le même format de
 * cookies que le middleware et les route handlers (auth-helpers-shared).
 */
export function createBrowserClient() {
  return createClientComponentClient<Database>()
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
