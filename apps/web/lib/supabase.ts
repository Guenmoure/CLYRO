import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

/**
 * Client Supabase pour les composants React (browser-side)
 * Utilise la session de l'utilisateur courant via cookies
 */
export function createBrowserClient() {
  return createClientComponentClient<Database>()
}

/**
 * Client Supabase pour les Route Handlers Next.js (server-side)
 * Lecture seule de la session utilisateur
 */
export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey)
}

// Instance singleton pour usage dans les composants
export const supabase = createBrowserClient()
