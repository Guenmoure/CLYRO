'use client'

import { useEffect, useState, useMemo } from 'react'
import { UserPlus, Video, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { AvatarFilters, type AvatarFilter } from '@/components/assets/AvatarFilters'
import { AvatarPreviewModal } from '@/components/assets/AvatarPreviewModal'
import { CreateAvatarModal } from '@/components/assets/CreateAvatarModal'
import { getStudioAvatars, type StudioAvatar } from '@/lib/api'
import { groupAvatarsByName, type AvatarGroup } from '@/lib/avatar-grouping'
import { useFavoriteAvatars } from '@/lib/use-favorite-avatars'
import { useLanguage } from '@/lib/i18n'
import { cn } from '@/lib/utils'

type AvatarTab = 'public' | 'my'

// ── Skeleton ───────────────────────────────────────────────────────────────────

function AvatarSkeleton() {
  return <div className="aspect-[3/4] rounded-2xl bg-muted animate-pulse" />
}

// ── Avatar Group Card (one card per persona name) ──────────────────────────────

function AvatarGroupCard({
  group,
  isFavorite,
  onClick,
  onToggleFavorite,
}: {
  group: AvatarGroup
  isFavorite: boolean
  onClick: () => void
  onToggleFavorite: () => void
}) {
  const { t } = useLanguage()
  return (
    <div className="relative rounded-2xl border border-border bg-card overflow-hidden transition-all hover:border-blue-500/30 hover:shadow-md w-full group">
      <button
        type="button"
        onClick={onClick}
        className="block text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={`${group.baseName}, ${group.totalLooks} looks`}
      >
        <div className="relative aspect-[3/4] bg-muted overflow-hidden">
          {group.mainPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={group.mainPreview}
              alt={group.baseName}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
              <span className="font-body text-4xl text-foreground/40">
                {group.baseName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

          {/* Looks count badge — top right */}
          {group.totalLooks > 1 && (
            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5">
              <span className="font-mono text-[10px] text-white/90">
                {group.totalLooks} looks
              </span>
            </div>
          )}

          {/* Info overlay — bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <p className="font-body text-sm text-white font-semibold leading-tight truncate">
              {group.baseName}
            </p>
            {group.totalLooks > 1 && (
              <p className="font-body text-xs text-white/60 mt-0.5">
                {group.totalLooks !== 1
                  ? t('av_looksAvailable_plural').replace('{n}', String(group.totalLooks))
                  : t('av_looksAvailable').replace('{n}', '1')}
              </p>
            )}
          </div>
        </div>
      </button>

      {/* Favorite toggle — sits OUTSIDE the main <button> so its onClick
          doesn't bubble up and open the preview modal. Visible by default
          when favorited, otherwise appears on hover. */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleFavorite() }}
        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        aria-pressed={isFavorite}
        className={cn(
          'absolute top-2 left-2 z-10 rounded-full p-1.5 transition-all',
          isFavorite
            ? 'bg-red-500/15 backdrop-blur-sm opacity-100'
            : 'bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100',
        )}
      >
        <Heart
          size={14}
          className={cn(
            'transition-colors',
            isFavorite ? 'text-red-400 fill-red-400' : 'text-white/85',
          )}
        />
      </button>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AvatarsPage() {
  const { t } = useLanguage()
  const [avatars, setAvatars]           = useState<StudioAvatar[]>([])
  const [loading, setLoading]           = useState(true)
  const [activeTab, setActiveTab]       = useState<AvatarTab>('public')
  const [search, setSearch]             = useState('')
  const [activeFilter, setActiveFilter] = useState<AvatarFilter>('all')
  const [selectedGroup, setSelectedGroup] = useState<AvatarGroup | null>(null)
  const [createOpen, setCreateOpen]     = useState(false)
  const fav = useFavoriteAvatars()

  useEffect(() => {
    getStudioAvatars()
      .then(({ avatars: av }) => setAvatars(av))
      .catch(() => setAvatars([]))
      .finally(() => setLoading(false))
  }, [])

  // "My avatars" = avatars uploaded by the user via the Instant Avatar
  // pipeline. HeyGen labels these `'private'` (older HeyGen versions also
  // returned `'custom'`). The previous code filtered on `'personal'` which
  // HeyGen never produces, so this tab was always empty.
  const personalAvatars = useMemo(
    () => avatars.filter((a) => a.avatar_type === 'private' || a.avatar_type === 'custom'),
    [avatars],
  )

  // Filter then group. Order matters: tab → category/favorites → search.
  // Favorites is mutually exclusive with the category pills (they live in
  // the same FilterPill row), so it short-circuits the category check.
  const groups = useMemo(() => {
    let list = activeTab === 'my' ? personalAvatars : avatars
    if (activeFilter === 'favorites') {
      list = list.filter((a) => fav.isFavorite(a.avatar_id))
    } else if (activeFilter !== 'all') {
      list = list.filter((a) => a.category === activeFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((a) => a.avatar_name.toLowerCase().includes(q))
    }
    return groupAvatarsByName(list)
  }, [avatars, personalAvatars, activeTab, activeFilter, search, fav])

  const totalAvatars = useMemo(
    () => groups.reduce((sum, g) => sum + g.avatars.length, 0),
    [groups],
  )

  const tabs: { key: AvatarTab; label: string; count: number }[] = [
    { key: 'public', label: t('publicAvatars'), count: avatars.length },
    { key: 'my',     label: t('myAvatars'),     count: personalAvatars.length },
  ]

  return (
    <>
      {/* Sub-header: avatar tabs + CTA */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/30 bg-card/40">
        <div className="flex items-center gap-4">
          <h1 className="font-body text-lg font-bold text-foreground">{t('pageAvatars')}</h1>
          <div className="flex gap-1">
          {tabs.map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg font-body text-sm transition-all duration-150',
                activeTab === key
                  ? 'bg-blue-500/10 text-blue-500'
                  : 'text-[--text-muted] hover:text-foreground hover:bg-muted',
              )}
            >
              {label}
              <span className={cn(
                'font-body text-[10px] rounded-full px-1.5 py-0.5',
                activeTab === key ? 'bg-blue-500/20 text-blue-500' : 'bg-muted text-[--text-muted]',
              )}>
                {count}
              </span>
            </button>
          ))}
          </div>
        </div>

        <Button
          variant="primary"
          size="sm"
          leftIcon={<UserPlus size={13} />}
          onClick={() => setCreateOpen(true)}
        >
          {t('createAvatar')}
        </Button>
      </div>

      {/* Filters */}
      <AvatarFilters
        search={search}
        activeFilter={activeFilter}
        onSearch={setSearch}
        onFilter={setActiveFilter}
      />

      {/* Grid — one card per persona name */}
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 12 }).map((_, i) => <AvatarSkeleton key={i} />)}
          </div>
        ) : activeTab === 'my' && personalAvatars.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title={t('createFirstAvatar')}
            description={t('createAvatarDesc')}
            accent="blue"
            size="lg"
            action={
              <Button variant="primary" leftIcon={<Video size={14} />} onClick={() => setCreateOpen(true)}>
                {t('createMyAvatar')}
              </Button>
            }
          />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title={t('noAvatarsMatch')}
            accent="neutral"
            size="md"
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {groups.map((group) => {
              // A group is "favorited" if AT LEAST ONE of its avatars is.
              // Toggling targets the first avatar's id, which is the canonical
              // representative of the group (matches mainPreview).
              const firstId = group.avatars[0]?.avatar_id ?? ''
              const groupFav = group.avatars.some((a) => fav.isFavorite(a.avatar_id))
              return (
                <AvatarGroupCard
                  key={group.baseName}
                  group={group}
                  isFavorite={groupFav}
                  onClick={() => setSelectedGroup(group)}
                  onToggleFavorite={() => firstId && fav.toggle(firstId)}
                />
              )
            })}
          </div>
        )}

        {/* Footer count */}
        {!loading && groups.length > 0 && (
          <p className="font-body text-xs text-[--text-muted] text-center mt-6">
            {groups.length > 1
              ? t('av_footerSummary_plural').replace('{groups}', String(groups.length)).replace('{total}', String(totalAvatars))
              : t('av_footerSummary').replace('{groups}', String(groups.length)).replace('{total}', String(totalAvatars))
            }
          </p>
        )}
      </div>

      {/* Modal — shows all looks for selected persona */}
      <AvatarPreviewModal
        group={selectedGroup}
        isOpen={!!selectedGroup}
        onClose={() => setSelectedGroup(null)}
      />
      <CreateAvatarModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </>
  )
}
