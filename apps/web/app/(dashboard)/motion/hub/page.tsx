import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/database.types'
import { MotionStudio } from '@/components/motion/motion-studio'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Motion Hub — CLYRO' }

export default async function MotionHubPage({
  searchParams,
}: {
  searchParams?: { draft?: string }
}) {
  const supabase = createServerComponentClient<Database>({ cookies })
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const userId = user?.id ?? ''

  // Run the sessions query + optional draft fetch in parallel
  const draftId = searchParams?.draft
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [videosRes, draftRes]: [any, any] = await Promise.all([
    supabase
      .from('videos')
      .select('id, title, status, output_url, created_at')
      .eq('user_id', userId)
      .eq('module', 'motion')
      .neq('status', 'draft')          // drafts are surfaced via /projects + /drafts, not the sidebar
      .order('created_at', { ascending: false })
      .limit(20),
    draftId
      ? supabase
          .from('videos')
          .select('id, wizard_state')
          .eq('id', draftId)
          .eq('user_id', userId)
          .eq('status', 'draft')
          .single()
      : Promise.resolve({ data: null }),
  ])

  const initialDraft = draftRes?.data
    ? { id: draftRes.data.id as string, wizard_state: draftRes.data.wizard_state ?? null }
    : null

  return <MotionStudio initialVideos={videosRes?.data ?? []} initialDraft={initialDraft} />
}
