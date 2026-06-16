import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './database.types'

/**
 * Supabase client for Server Components (RSC) and Route Handlers.
 * Uses @supabase/ssr with the same cookie format as the middleware
 * and the browser client, ensuring session continuity.
 *
 * Drop-in replacement for the deprecated createServerComponentClient
 * and createRouteHandlerClient from @supabase/auth-helpers-nextjs.
 */
export function createSSRClient() {
  const cookieStore = cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options)
            } catch {
              // setAll may be called from a Server Component where
              // cookies are read-only. Safe to ignore — the middleware
              // already refreshes the session on each request.
            }
          })
        },
      },
    },
  )
}
