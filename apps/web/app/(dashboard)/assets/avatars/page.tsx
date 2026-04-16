'use client'

import { useEffect, useState, useMemo } from 'react'
import { UserPlus, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AvatarCard } from '@/components/assets/AvatarCard'
import { AvatarFilters, type AvatarFilter } from '@/components/assets/AvatarFilters'
import { AvatarPreviewModal } from '@/components/assets/AvatarPreviewModal'
import { CreateAvatarModal } from '@/components/assets/CreateAvatarModal'
import { getStudioAvatars, type StudioAvatar } from '@/lib/api'
import { cn } from '@/lib/utils'

type AvatarTab = 'public' | 'my'

// ── Skeleton ───────────────────────────────────────────────────────────────────

function AvatarSkeleton() {
  return (
    <div className="aspect-[3/4] rounded-2xl bg-muted animate-shimmer" />
  )
}

// ── Empty personal avatar state ────────────────────────────────────────────────

function NoPersonalAvatar({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-full bg-muted border border-border flex items-center justify-center mb-4">
        <UserPlus size={30} className="text-[--text-muted]" />
      </div>
      <h3 className="font-display text-lg text-foreground">Crée ton premier avatar</h3>
      <p className="font-body text-sm text-[--text-secondary] mt-2 max-w-sm">
        Clone ton apparence en 2 minutes. Upload une courte vidéo et CLYRO génère
        ton avatar IA via HeyGen Instant Avatar.
      </p>
      <Button variant="primary" className="mt-6" leftIcon={<Video size={14} />} onClick={onCreate}>
        Créer mon avatar
      </Button>
      <p className="font-mono text-xs text-[--text-muted] mt-3">
        Disponible à partir du plan Creator
      </p>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AvatarsPage() {
  const [avatars,      setAvatars]      = useState<StudioAvatar[]>([])
  const [loading,      setLoading]      = useState(true)
  const [activeTab,    setActiveTab]    = useState<AvatarTab>('public')
  const [search,       setSearch]       = useState('')
  const [activeFilter, setActiveFilter] = useState<AvatarFilter>('all')
  const [selected,     setSelected]     = useState<StudioAvatar | null>(null)
  const [createOpen,   setCreateOpen]   = useState(false)

  useEffect(() => {
    getStudioAvatars()
      .then(({ avatars: av }) => setAvatars(av))
      .catch(() => setAvatars([]))
      .finally(() => setLoading(false))
  }, [])

  const personalAvatars = useMemo(
    () => avatars.filter((a) => a.avatar_type === 'personal'),
    [avatars],
  )

  const filtered = useMemo(() => {
    let list = activeTab === 'my' ? personalAvatars : avatars
    if (activeFilter !== 'all' && activeFilter !== 'favorites') {
      list = list.filter((a) => a.category === activeFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((a) => a.avatar_name.toLowerCase().includes(q))
    }
    return list
  }, [avatars, personalAvatars, activeTab, activeFilter, search])

  const tabs: { key: AvatarTab; label: string; count: number }[] = [
    { key: 'public', label: 'Avatars Publics', count: avatars.length },
    { key: 'my',     label: 'Mes Avatars',     count: personalAvatars.length },
  ]

  return (
    <>
      {/* Sub-header: avatar tabs + CTA */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/30 bg-card/40">
        <div className="flex gap-1">
          {tabs.map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg font-body text-sm transition-all duration-150',
                activeTab === key
                  ? 'bg-blue-500/10 text-blue-400'
                  : 'text-[--text-secondary] hover:text-foreground hover:bg-muted',
              )}
            >
              {label}
              <span className={cn(
                'font-mono text-[10px] rounded-full px-1.5 py-0.5',
                activeTab === key ? 'bg-blue-500/20 text-blue-400' : 'bg-muted text-[--text-muted]',
              )}>
                {count}
              </span>
            </button>
          ))}
        </div>

        <Button
          variant="primary"
          size="sm"
          leftIcon={<UserPlus size={13} />}
          onClick={() => setCreateOpen(true)}
        >
          Créer un avatar
        </Button>
      </div>

      {/* Filters */}
      <AvatarFilters
        search={search}
        activeFilter={activeFilter}
        onSearch={setSearch}
        onFilter={setActiveFilter}
      />

      {/* Grid */}
      <div className="px-6 py-6">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => <AvatarSkeleton key={i} />)}
          </div>
        ) : activeTab === 'my' && personalAvatars.length === 0 ? (
          <div className="grid">
            <NoPersonalAvatar onCreate={() => setCreateOpen(true)} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="font-body text-sm text-[--text-muted]">
              Aucun avatar ne correspond à ta recherche.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filtered.map((avatar) => (
              <AvatarCard
                key={avatar.avatar_id}
                avatar={avatar}
                onClick={() => setSelected(avatar)}
                onUse={() => setSelected(avatar)}
              />
            ))}
          </div>
        )}

        {/* Footer count */}
        {!loading && filtered.length > 0 && (
          <p className="font-mono text-xs text-[--text-muted] text-center mt-6">
            {filtered.length} avatar{filtered.length > 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Modals */}
      <AvatarPreviewModal
        avatar={selected}
        isOpen={!!selected}
        onClose={() => setSelected(null)}
      />
      <CreateAvatarModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </>
  )
}
