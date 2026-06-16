'use client'

import { useEffect, useState } from 'react'
import { PenLine, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase'
import { DraftCard, type DbDraftMeta } from './DraftCard'
import { useLanguage } from '@/lib/i18n'

const PREVIEW_LIMIT = 4

export function DraftsSection() {
  const { t } = useLanguage()
  const [drafts,     setDrafts]     = useState<DbDraftMeta[]>([])
  const [totalCount, setTotalCount] = useState<number | null>(null)

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: any } }) => {
      if (!session) return

      // Count all drafts
      supabase
        .from('videos')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('status', 'draft')
        .then(({ count }: { count: any }) => setTotalCount(count ?? 0))

      // Fetch preview set
      supabase
        .from('videos')
        .select('id, module, title, wizard_step, wizard_state, updated_at')
        .eq('user_id', session.user.id)
        .eq('status', 'draft')
        .order('updated_at', { ascending: false })
        .limit(PREVIEW_LIMIT)
        .then(({ data }: { data: any }) => {
          if (data) setDrafts(data as DbDraftMeta[])
        })
    })
  }, [])

  function handleDelete(id: string) {
    const supabase = createBrowserClient()
    supabase.from('videos').delete().eq('id', id).then(() => {
      setDrafts(prev => prev.filter(d => d.id !== id))
      setTotalCount(prev => Math.max(0, (prev ?? 0) - 1))
    })
  }

  if (drafts.length === 0) return null

  return (
    <section>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <PenLine size={15} className="text-warning" strokeWidth={1.8} />
        <h2 className="font-display text-base font-semibold text-foreground">{t('ds_drafts')}</h2>
        <span className="font-mono text-[11px] font-bold text-warning bg-warning/10 border border-warning/20 rounded-full px-2 py-0.5 leading-none">
          {totalCount ?? '—'}
        </span>

        {(totalCount ?? 0) > PREVIEW_LIMIT && (
          <Link
            href="/drafts"
            className="ml-auto flex items-center gap-1 text-xs font-medium text-[--text-muted] hover:text-foreground transition-colors"
          >
            {t('ds_see_all')}
            <ArrowRight size={12} />
          </Link>
        )}
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {drafts.map(draft => (
          <DraftCard
            key={draft.id}
            draft={draft}
            onDelete={() => handleDelete(draft.id)}
          />
        ))}
      </div>

      {/* Footer — "Voir tous" when truncated */}
      {(totalCount ?? 0) > PREVIEW_LIMIT && (
        <div className="mt-3 flex justify-center">
          <Link
            href="/drafts"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[--text-muted] border border-border rounded-xl px-4 py-2 hover:bg-muted hover:text-foreground transition-colors"
          >
            <PenLine size={12} />
            {(totalCount ?? 0) - PREVIEW_LIMIT} {(totalCount ?? 0) - PREVIEW_LIMIT > 1 ? t('ds_drafts_plural') : t('ds_draft_singular')} {(totalCount ?? 0) - PREVIEW_LIMIT > 1 ? t('ds_additional_plural') : t('ds_additional_singular')}
            <ArrowRight size={12} />
          </Link>
        </div>
      )}
    </section>
  )
}
