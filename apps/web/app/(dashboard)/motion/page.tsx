import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/database.types'
import { MotionHub } from '@/components/motion/motion-hub'

export const metadata = { title: 'Motion Design — CLYRO' }

export default async function MotionPage() {
  const supabase = createServerComponentClient<Database>({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  const { data: videos } = await supabase
    .from('videos')
    .select('id, title, status, created_at')
    .eq('user_id', user?.id ?? '')
    .eq('type', 'motion')
    .order('created_at', { ascending: false })
    .limit(20)

  return <MotionHub initialVideos={videos ?? []} />
}
