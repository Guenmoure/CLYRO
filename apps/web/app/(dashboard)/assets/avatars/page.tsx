'use client'

import { useEffect, useState, useMemo } from 'react'
import { UserPlus, Video, ChevronDown, ChevronUp, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AvatarFilters, type AvatarFilter } from '@/components/assets/AvatarFilters'
import { AvatarPreviewModal } from '@/components/assets/AvatarPreviewModal'
import { CreateAvatarModal } from '@/components/assets/CreateAvatarModal'
import { getStudioAvatars, type StudioAvatar } from '@/lib/api'
import { groupAvatarsByName, type AvatarGroup } from '@/lib/avatar-grouping'
import { useLanguage } from '@/lib/i18n'
import { cn } from '@/lib/utils'

type AvatarTab = 'public' | 'my'

// ── Skeleton ───────────────────────────────────────────────────────────────────

function AvatarSkeleton() {
  return <div className="aspect-[3/4] rounded-2xl bg-muted animate-pulse" />
}

// ── Empty personal avatar state ────────────────────────────────────────────────

function NoPersonalAvatar({ onCreate }: { onCreate: () => void }) {
  const { t } = useLanguage()
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-full bg-muted border border-border flex items-center justify-center mb-4">
        <UserPlus size={30} className="text-[--text-muted]" />
      </div>
      <h3 className="font-body text-lg font-semibold text-foreground">{t('createFirstAvatar')}</h3>
      <p className="font-body text-sm text-[--text-muted] mt-2 max-w-sm">
        {t('createAvatarDesc')}
      </p>
      <Button variant="primary" className="mt-6" leftIcon={<Video size={14} />} onClick={onCreate}>
        {t('createMyAvatar')}
      </Button>
    </div>
  )
}

// ── Avatar Group Card (grouped by name, expandable looks) ──────────────────────

function AvatarGroupCard({
  group,
  isExpanded,
  onToggle,
  onSelectAvatar,
}: {
  group: AvatarGroup
  isExpanded: boolean
  onToggle: () => void
  onSelectAvatar: (av: StudioAvatar) => void
}) {
  const { t } = useLanguage()
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden transition-all hover:border-blue-500/30">
      {/* Main card — click to expand */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label={`${group.baseName}, ${group.totalLooks} looks`}
        className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div className="relative aspect-[3/4] bg-muted overflow-hidden group">
          {group.mainPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={group.mainPreview}
              alt={group.baseName}
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

          {/* Info overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <p className="font-body text-sm text-white font-semibold leading-tight truncate">
              {group.baseName}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-body text-xs text-white/60">
                {group.totalLooks} look{group.totalLooks !== 1 ? 's' : ''}
              </span>
              {isExpanded
                ? <ChevronUp size={12} className="text-white/60" />
                : <ChevronDown size={12} className="text-white/60" />
              }
            </div>
          </div>
        </div>
      </button>

      {/* Expanded looks grid */}
      {isExpanded && (
        <div className="p-3 border-t border-border bg-muted/30">
          <p className="font-body text-xs font-medium text-[--text-muted] mb-2">
            {group.totalLooks} look{group.totalLooks !== 1 ? 's' : ''} {t('available')}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {group.avatars.map((av) => {
              // If avatar has individual looks, show them
              if (av.looks.length > 0) {
                return av.looks.map((look) => (
                  <button
                    key={look.look_id}
                    type="button"
                    onClick={() => onSelectAvatar(av)}
                    className="relative rounded-xl overflow-hidden border border-border hover:border-blue-500 transition-all group/look focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <div
                      className="aspect-[3/4] bg-cover bg-center bg-muted"
                      style={{ backgroundImage: `url(${look.preview_image_url})` }}
                    />
                    <p className="font-body text-[11px] text-foreground px-1.5 py-1 truncate bg-card text-center">
                      {look.name || av.avatar_name}
                    </p>
                  </button>
                ))
              }
              // Otherwise show the avatar itself as a look
              return (
                <button
                  key={av.avatar_id}
                  type="button"
                  onClick={() => onSelectAvatar(av)}
                  className="relative rounded-xl overflow-hidden border border-border hover:border-blue-500 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <div
                    className="aspect-[3/4] bg-cover bg-center bg-muted"
                    style={{ backgroundImage: `url(${av.preview_image_url})` }}
                  />
                  <p className="font-body text-[11px] text-foreground px-1.5 py-1 truncate bg-card text-center">
                    {av.avatar_name}
                  </p>
                </button>
              )
            })}
          </div>
        </div>
      )}
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
  const [selected, setSelected]         = useState<StudioAvatar | null>(null)
  const [createOpen, setCreateOpen]     = useState(false)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)

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

  // Filter then group
  const groups = useMemo(() => {
    let list = activeTab === 'my' ? personalAvatars : avatars
    if (activeFilter !== 'all' && activeFilter !== 'favorites') {
      list = list.filter((a) => a.category === activeFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((a) => a.avatar_name.toLowerCase().includes(q))
    }
    return groupAvatarsByName(list)
  }, [avatars, personalAvatars, activeTab, activeFilter, search])

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

      {/* Grid — grouped by name */}
      <div className="px-6 py-6">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => <AvatarSkeleton key={i} />)}
          </div>
        ) : activeTab === 'my' && personalAvatars.length === 0 ? (
          <div className="grid">
            <NoPersonalAvatar onCreate={() => setCreateOpen(true)} />
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="font-body text-sm text-[--text-muted]">
              {t('noAvatarsMatch')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {groups.map((group) => (
              <AvatarGroupCard
                key={group.baseName}
                group={group}
                isExpanded={expandedGroup === group.baseName}
                onToggle={() => setExpandedGroup(
                  expandedGroup === group.baseName ? null : group.baseName
                )}
                onSelectAvatar={setSelected}
              />
            ))}
          </div>
        )}

        {/* Footer count */}
        {!loading && groups.length > 0 && (
          <p className="font-body text-xs text-[--text-muted] text-center mt-6">
            {groups.length} avatar{groups.length > 1 ? 's' : ''} &middot; {totalAvatars} total look{totalAvatars > 1 ? 's' : ''}
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
