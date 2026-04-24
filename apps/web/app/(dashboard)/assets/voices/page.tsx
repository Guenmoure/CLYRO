'use client'

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { Plus, ChevronRight, TrendingUp, Sparkles, Mic2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VoiceCard } from '@/components/assets/VoiceCard'
import { VoiceFilters } from '@/components/assets/VoiceFilters'
import { VoicePreviewModal } from '@/components/assets/VoicePreviewModal'
import { CloneVoiceModal, type UserPlan } from '@/components/assets/CloneVoiceModal'
import {
  getVoices, getPublicVoices, getVoiceFilters, toggleVoiceFavorite,
  type ClyroVoice,
} from '@/lib/api'
import { useUser } from '@/hooks/use-user'
import { useLanguage } from '@/lib/i18n'
import { cn } from '@/lib/utils'

type VoiceTab = 'explore' | 'my_voices' | 'default'

// ── Skeleton ───────────────────────────────────────────────────────────────────

function VoiceSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card animate-pulse">
      <div className="w-12 h-12 rounded-full bg-muted shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-muted rounded w-1/2" />
        <div className="h-2.5 bg-muted rounded w-1/3" />
      </div>
      <div className="w-9 h-9 rounded-full bg-muted shrink-0" />
    </div>
  )
}

// ── Collection card (horizontal carousel) ─────────────────────────────────────

function CollectionCard({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="shrink-0 w-48 rounded-xl bg-muted border border-border p-4 cursor-pointer hover:border-blue-500/30 hover:bg-muted/80 transition-all">
      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
        {icon}
      </div>
      <p className="font-body text-sm text-foreground leading-snug">{title}</p>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function VoicesAssetsPage() {
  const { t } = useLanguage()
  const { profile } = useUser()
  const [allVoices, setAllVoices]   = useState<ClyroVoice[]>([])
  const [myVoices, setMyVoices]     = useState<ClyroVoice[]>([])
  const [loading, setLoading]       = useState(true)
  const [activeTab, setActiveTab]   = useState<VoiceTab>('explore')
  const [cloneOpen, setCloneOpen]   = useState(false)
  const [search, setSearch]         = useState('')
  const [category, setCategory]     = useState<string | null>(null)
  const [playingId, setPlayingId]   = useState<string | null>(null)
  const [selected, setSelected]     = useState<ClyroVoice | null>(null)
  // Server-side filter state — pushed as query params to /voices/public.
  // Separate from client-side `search` + `category` which narrow further
  // within the already-returned list without a round trip.
  const [gender, setGender]         = useState('')
  const [language, setLanguage]     = useState('')
  const [useCase, setUseCase]       = useState('')
  const [filterOptions, setFilterOptions] = useState<{
    genders: string[]
    languages: Array<{ value: string; label: string; flag: string }>
    useCases: string[]
  } | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Filter dropdown options are fetched once — they're cached server-side
  // for 15min via memoizeTTL, so the cost is negligible on repeat navigations.
  useEffect(() => {
    getVoiceFilters()
      .then((opts) => setFilterOptions(opts))
      .catch(() => {})
  }, [])

  // Refetch public voices whenever a server-side filter changes. Personal
  // voices don't accept filters so they're fetched once.
  const reload = useCallback(() => {
    setLoading(true)
    const filters = {
      ...(gender   ? { gender }   : {}),
      ...(language ? { language } : {}),
      ...(useCase  ? { useCase }  : {}),
    }
    Promise.all([getPublicVoices(filters), getVoices()])
      .then(([pub, mine]) => {
        setAllVoices(pub.voices)
        setMyVoices((mine.personal ?? []) as ClyroVoice[])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [gender, language, useCase])

  useEffect(() => { reload() }, [reload])

  /**
   * Optimistic favorite toggle — flip the UI immediately, roll back on
   * network failure. The backend's `upsert`/`delete` is idempotent so a
   * retry on rollback is safe.
   */
  function handleFavorite(voice: ClyroVoice) {
    const nextState = !voice.isFavorite
    const action = nextState ? 'add' : 'remove'

    const flip = (v: ClyroVoice): ClyroVoice =>
      v.id === voice.id ? { ...v, isFavorite: nextState } : v

    setAllVoices((prev) => prev.map(flip))
    setMyVoices((prev) => prev.map(flip))

    toggleVoiceFavorite(voice.id, action).catch(() => {
      // Rollback — the server rejected the change.
      const revert = (v: ClyroVoice): ClyroVoice =>
        v.id === voice.id ? { ...v, isFavorite: !nextState } : v
      setAllVoices((prev) => prev.map(revert))
      setMyVoices((prev) => prev.map(revert))
    })
  }

  // Single audio singleton
  function handlePlay(id: string | null) {
    if (!id) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }
    if (playingId === id) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }
    audioRef.current?.pause()
    const voice = allVoices.find((v) => v.id === id)
    if (!voice?.previewUrl) { setPlayingId(id); return }
    const audio = new Audio(voice.previewUrl)
    audioRef.current = audio
    audio.play().catch(() => {})
    audio.onended = () => setPlayingId(null)
    setPlayingId(id)
  }

  const activeVoices = activeTab === 'my_voices' ? myVoices : allVoices

  const trendingVoices = useMemo(
    () => allVoices.filter((v) => v.previewUrl).slice(0, 6),
    [allVoices],
  )

  const filtered = useMemo(() => {
    let list = activeVoices
    if (category) {
      list = list.filter((v) =>
        v.useCase?.toLowerCase().includes(category.toLowerCase()),
      )
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((v) =>
        v.name.toLowerCase().includes(q) ||
        v.description?.toLowerCase().includes(q) ||
        v.accent?.toLowerCase().includes(q) ||
        v.language?.toLowerCase().includes(q),
      )
    }
    return list
  }, [activeVoices, category, search])

  const TABS: { key: VoiceTab; label: string; count?: number }[] = [
    { key: 'explore',   label: t('exploreVoices'),        count: allVoices.length },
    { key: 'my_voices', label: t('myVoicesTab'),       count: myVoices.length },
    { key: 'default',   label: t('premadeVoices') },
  ]

  return (
    <>
      {/* Page heading */}
      <div className="px-6 py-4 border-b border-border/30 bg-card/40">
        <h1 className="font-body text-lg font-bold text-foreground">{t('pageVoices')}</h1>
      </div>

      {/* Sub-header: tabs + CTA */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/30 bg-card/40">
        <div className="flex gap-1">
          {TABS.map(({ key, label, count }) => (
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
              {count !== undefined && (
                <span className={cn(
                  'font-body text-[11px] rounded-full px-1.5 py-0.5',
                  activeTab === key ? 'bg-blue-500/20 text-blue-500' : 'bg-muted text-[--text-muted]',
                )}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus size={13} />}
          onClick={() => setCloneOpen(true)}
        >
          {t('createVoice')}
        </Button>
      </div>

      {/* Filters */}
      <VoiceFilters
        search={search}
        activeCategory={category}
        onSearch={setSearch}
        onCategory={setCategory}
        filterOptions={filterOptions ?? undefined}
        gender={gender}
        language={language}
        useCase={useCase}
        onGender={setGender}
        onLanguage={setLanguage}
        onUseCase={setUseCase}
      />

      {/* Content */}
      <div className="px-6 py-6 space-y-8">

        {/* Trending voices — only on Explore tab */}
        {activeTab === 'explore' && !loading && trendingVoices.length > 0 && !search && !category && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-blue-500" />
              <h2 className="font-body text-base font-semibold text-foreground">{t('trendingVoices')}</h2>
              <ChevronRight size={14} className="text-[--text-muted]" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {trendingVoices.map((voice) => (
                <VoiceCard
                  key={voice.id}
                  voice={voice}
                  playing={playingId === voice.id}
                  onPlay={handlePlay}
                  onClick={() => setSelected(voice)}
                  onFavorite={handleFavorite}
                />
              ))}
            </div>
          </section>
        )}

        {/* Collections carousel — only on Explore tab */}
        {activeTab === 'explore' && !loading && !search && !category && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={15} className="text-purple-400" />
              <h2 className="font-body text-base font-semibold text-foreground">{t('handpicked')}</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto scrollbar-thin pb-2">
              {[
                { title: t('bestVoicesV3'),      icon: <Sparkles size={14} className="text-blue-400" /> },
                { title: t('popularTikTok'),           icon: <TrendingUp size={14} className="text-pink-400" /> },
                { title: t('studioConversational'),   icon: <Sparkles size={14} className="text-amber-400" /> },
                { title: t('narrationVoices'),                icon: <Sparkles size={14} className="text-emerald-400" /> },
                { title: t('podcastsYouTube'),              icon: <TrendingUp size={14} className="text-purple-400" /> },
              ].map((col) => (
                <CollectionCard key={col.title} title={col.title} icon={col.icon} />
              ))}
            </div>
          </section>
        )}

        {/* All voices list */}
        <section>
          <h2 className="font-body text-base font-semibold text-foreground mb-4">
            {activeTab === 'my_voices' ? t('myVoices') : activeTab === 'default' ? t('defaultVoices') : t('allVoices')}
            {!loading && (
              <span className="font-body text-sm text-[--text-muted] ml-2 font-normal">
                ({filtered.length})
              </span>
            )}
          </h2>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => <VoiceSkeleton key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Mic2 size={24} className="text-[--text-muted] mb-2" />
              <p className="font-body text-sm text-[--text-muted]">
                {activeTab === 'my_voices'
                  ? t('noClonedVoices')
                  : t('noVoicesMatch')}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((voice) => (
                <VoiceCard
                  key={voice.id}
                  voice={voice}
                  playing={playingId === voice.id}
                  onPlay={handlePlay}
                  onClick={() => setSelected(voice)}
                  onFavorite={handleFavorite}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Voice preview modal */}
      <VoicePreviewModal
        voice={selected}
        isOpen={!!selected}
        onClose={() => setSelected(null)}
      />

      {/* Clone-a-voice modal (audit P2 — voice cloning UI surfaced) */}
      <CloneVoiceModal
        isOpen={cloneOpen}
        onClose={() => setCloneOpen(false)}
        onCloned={() => {
          setActiveTab('my_voices')
          reload()
        }}
        userPlan={(profile?.plan ?? 'free') as UserPlan}
        existingClonedCount={myVoices.length}
      />
    </>
  )
}
