import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/database.types'
import { MotionStudio } from '@/components/motion/motion-studio'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Motion Hub — CLYRO' }

export default async function MotionHubPage() {
  const supabase = createServerComponentClient<Database>({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  const { data: videos } = await supabase
    .from('videos')
    .select('id, title, status, output_url, created_at')
    .eq('user_id', user?.id ?? '')
    .eq('module', 'motion')
    .order('created_at', { ascending: false })
    .limit(20)

  return <MotionStudio initialVideos={videos ?? []} />
}
