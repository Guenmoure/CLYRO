import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/database.types'
import { FacelessHub } from '@/components/faceless/faceless-hub'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Faceless Hub — CLYRO' }

export default async function FacelessHubPage({
  searchParams,
}: {
  searchParams?: { draft?: string; resume?: string }
}) {
  const supabase = createServerComponentClient<Database>({ cookies })
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const userId = user?.id ?? ''

  const draftId  = searchParams?.draft
  const resumeId = searchParams?.resume

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [videosRes, draftRes, resumeRes]: [any, any, any] = await Promise.all([
    supabase
      .from('videos')
      .select('id, title, status, output_url, created_at')
      .eq('user_id', userId)
      .eq('module', 'faceless')
      .neq('status', 'draft')
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
    resumeId
      ? supabase
          .from('videos')
          .select('id, title, status')
          .eq('id', resumeId)
          .eq('user_id', userId)
          .neq('status', 'draft')
          .single()
      : Promise.resolve({ data: null }),
  ])

  const initialDraft = draftRes?.data
    ? { id: draftRes.data.id as string, wizard_state: draftRes.data.wizard_state ?? null }
    : null

  // resumeVideoId: non-null only when a real in-flight (or recently done) video exists
  const resumeVideoId: string | null = resumeRes?.data?.id ?? null

  return (
    <FacelessHub
      initialVideos={videosRes?.data ?? []}
      initialDraft={initialDraft}
      resumeVideoId={resumeVideoId}
    />
  )
}
