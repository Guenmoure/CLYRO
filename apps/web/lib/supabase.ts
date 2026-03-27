import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

/**
 * Client Supabase pour les composants React (browser-side)
 * Utilise createClientComponentClient qui stocke la session dans les cookies
 * → compatible avec createMiddlewareClient dans middleware.ts
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createBrowserClient(): any {
  return createClientComponentClient<Database>()
}

/**
 * Client Supabase pour les Route Handlers Next.js (server-side)
 * Lecture seule de la session utilisateur
 */
export function createServerClient(): SupabaseClient<Database> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey)
}

