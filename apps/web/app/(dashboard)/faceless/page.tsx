import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/database.types'
import { FacelessHub } from '@/components/faceless/faceless-hub'

export const metadata = { title: 'Faceless Video — CLYRO' }

export default async function FacelessPage() {
  const supabase = createServerComponentClient<Database>({ cookies })
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: videos } = await supabase
    .from('videos')
    .select('id, title, status, created_at')
    .eq('user_id', user?.id ?? '')
    .eq('type', 'faceless')
    .order('created_at', { ascending: false })
    .limit(20)

  return <FacelessHub initialVideos={videos ?? []} />
}
