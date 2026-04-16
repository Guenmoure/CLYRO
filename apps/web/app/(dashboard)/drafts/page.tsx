'use client'

import { useEffect, useState } from 'react'
import { PenLine, Video, Sparkles, Clock, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createBrowserClient } from '@/lib/supabase'
import { DraftCard, type DbDraftMeta } from '@/components/dashboard/DraftCard'

// ── Filter types ───────────────────────────────────────────────────────────────

type Filter = 'all' | 'faceless' | 'motion'

const FILTERS: { value: Filter; label: string; icon: React.ReactNode }[] = [
  { value: 'all',      label: 'Tous',     icon: <PenLine  size={13} /> },
  { value: 'faceless', label: 'Faceless', icon: <Video    size={13} /> },
  { value: 'motion',   label: 'Motion',   icon: <Sparkles size={13} /> },
]

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center mb-4">
        <PenLine size={24} className="text-[--text-muted]" strokeWidth={1.4} />
      </div>
      <h3 className="font-display text-base text-foreground mb-1">Aucun brouillon</h3>
      <p className="font-body text-sm text-[--text-muted] max-w-xs">
        Tes projets en cours apparaîtront ici. Lance un projet Faceless ou Motion pour commencer.
      </p>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DraftsPage() {
  const [drafts,  setDrafts]  = useState<DbDraftMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState<Filter>('all')

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setLoading(false); return }
      supabase
        .from('videos')
        .select('id, module, title, wizard_step, wizard_state, updated_at')
        .eq('user_id', session.user.id)
        .eq('status', 'draft')
        .order('updated_at', { ascending: false })
        .then(({ data }) => {
          setDrafts((data ?? []) as DbDraftMeta[])
          setLoading(false)
        })
    })
  }, [])

  function handleDelete(id: string) {
    const supabase = createBrowserClient()
    supabase.from('videos').delete().eq('id', id).then(() => {
      setDrafts(prev => prev.filter(d => d.id !== id))
    })
  }

  async function handleDeleteAll() {
    const ids = filtered.map(d => d.id)
    if (ids.length === 0) return
    const supabase = createBrowserClient()
    await supabase.from('videos').delete().in('id', ids)
    setDrafts(prev => prev.filter(d => !ids.includes(d.id)))
  }

  const filtered = filter === 'all' ? drafts : drafts.filter(d => d.module === filter)

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center">
            <PenLine size={18} className="text-warning" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Brouillons</h1>
            <p className="font-mono text-xs text-[--text-muted]">
              {loading ? '…' : `${drafts.length} projet${drafts.length !== 1 ? 's' : ''} en cours`}
            </p>
          </div>
        </div>

        {filtered.length > 0 && (
          <button
            type="button"
            onClick={handleDeleteAll}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg',
              'font-mono text-xs text-[--text-muted] border border-border',
              'hover:text-error hover:border-error/30 hover:bg-error/5 transition-colors',
            )}
          >
            <Trash2 size={12} />
            Supprimer tout
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-6 p-1 bg-muted rounded-xl w-fit">
        {FILTERS.map(f => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs transition-all duration-150',
              filter === f.value
                ? 'bg-card text-foreground shadow-sm'
                : 'text-[--text-muted] hover:text-foreground',
            )}
          >
            {f.icon}
            {f.label}
            {f.value !== 'all' && (
              <span className="text-[10px] opacity-60">
                {drafts.filter(d => d.module === f.value).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Expiry notice */}
      {drafts.length > 0 && (
        <div className="flex items-center gap-2 mb-6 px-3 py-2 rounded-xl bg-muted border border-border/50">
          <Clock size={13} className="text-[--text-muted] shrink-0" />
          <p className="font-mono text-[11px] text-[--text-muted]">
            Les brouillons non repris depuis 7 jours sont supprimés automatiquement.
          </p>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-44 rounded-2xl bg-muted border border-border animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(draft => (
            <DraftCard
              key={draft.id}
              draft={draft}
              onDelete={() => handleDelete(draft.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
