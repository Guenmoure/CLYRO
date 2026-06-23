'use client'

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { Plus, ChevronRight, TrendingUp, Sparkles, Mic2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { VoiceCard } from '@/components/assets/VoiceCard'
import { VoiceFilters } from '@/components/assets/VoiceFilters'
import dynamic from 'next/dynamic'
import type { UserPlan } from '@/components/assets/CloneVoiceModal'
import {
  getVoices, getPublicVoices, getVoiceFilters, toggleVoiceFavorite,
  type ClyroVoice,
} from '@/lib/api'
import { useUser } from '@/hooks/use-user'
import { useLanguage } from '@/lib/i18n'
import { cn } from '@/lib/utils'

// Modals are only needed on user interaction — code-split them out of the
// initial bundle so the voice list paints faster.
const VoicePreviewModal = dynamic(
  () => import('@/components/assets/VoicePreviewModal').then((m) => m.VoicePreviewModal),
  { ssr: false },
)
const CloneVoiceModal = dynamic(
  () => import('@/components/assets/CloneVoiceModal').then((m) => m.CloneVoiceModal),
  { ssr: false },
)

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

// ── Collection card (horizontal carousel) — editorial tile ────────────────────

function CollectionCard({ title, icon, folio }: { title: string; icon: React.ReactNode; folio: string }) {
  return (
    <div className="shrink-0 w-56 rounded-md bg-card border border-border p-4 cursor-pointer hover:border-foreground transition-colors">
      <div className="flex items-baseline justify-between mb-3">
        <span className="w-7 h-7 rounded bg-muted border border-border flex items-center justify-center">
          {icon}
        </span>
        <span className="folio">{folio}</span>
      </div>
      <p className="font-display text-base text-foreground leading-tight" style={{ letterSpacing: '-0.005em' }}>{title}</p>
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
  // Set when the primary voices fetch fails — drives the error UI instead
  // of a misleading empty state.
  const [loadError, setLoadError]   = useState(false)
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
    setLoadError(false)
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
      .catch((err) => {
        console.error('[assets/voices] failed to load voices:', err)
        setLoadError(true)
      })
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
      {/* Vague 2 — 23/06/26 — editorial sub-header (title comes from layout). */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-6">
        <div className="flex items-baseline gap-6">
          {TABS.map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={cn(
                'flex items-baseline gap-2 font-mono uppercase tracking-[0.14em] transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded',
                activeTab === key
                  ? 'text-foreground'
                  : 'text-[--text-muted] hover:text-foreground',
              )}
              style={{ fontSize: 11 }}
            >
              <span>{label}</span>
              {count !== undefined && (
                <span className="folio">{loading ? '—' : count.toString().padStart(2, '0')}</span>
              )}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setCloneOpen(true)}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-full',
            'bg-foreground text-background border border-foreground',
            'font-mono text-[10px] uppercase tracking-[0.14em]',
            'hover:bg-primary hover:border-primary transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          )}
        >
          <Plus size={12} />
          {t('createVoice')}
        </button>
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
      <div className="py-8 space-y-10">

        {/* Trending voices — only on Explore tab */}
        {activeTab === 'explore' && !loading && trendingVoices.length > 0 && !search && !category && (
          <section>
            <div className="divider-with-num mb-5">
              <span className="eyebrow">{t('trendingVoices')}</span>
              <hr />
              <span className="folio">{trendingVoices.length.toString().padStart(2, '0')}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div className="divider-with-num mb-5">
              <span className="eyebrow">{t('handpicked')}</span>
              <hr />
              <span className="folio">№ 05</span>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
              {[
                { title: t('bestVoicesV3'),         folio: 'COL.01', icon: <Sparkles size={13} className="text-primary" /> },
                { title: t('popularTikTok'),        folio: 'COL.02', icon: <TrendingUp size={13} className="text-foreground" /> },
                { title: t('studioConversational'), folio: 'COL.03', icon: <Sparkles size={13} className="text-foreground" /> },
                { title: t('narrationVoices'),      folio: 'COL.04', icon: <Sparkles size={13} className="text-foreground" /> },
                { title: t('podcastsYouTube'),      folio: 'COL.05', icon: <TrendingUp size={13} className="text-foreground" /> },
              ].map((col) => (
                <CollectionCard key={col.title} title={col.title} icon={col.icon} folio={col.folio} />
              ))}
            </div>
          </section>
        )}

        {/* All voices list */}
        <section>
          <div className="divider-with-num mb-5">
            <span className="eyebrow">
              {activeTab === 'my_voices' ? t('myVoices') : activeTab === 'default' ? t('defaultVoices') : t('allVoices')}
            </span>
            <hr />
            <span className="folio">{loading ? '—' : filtered.length.toString().padStart(2, '0')}</span>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => <VoiceSkeleton key={i} />)}
            </div>
          ) : loadError ? (
            <EmptyState
              icon={AlertCircle}
              title={t('err_loadTitle')}
              description={t('err_loadDesc')}
              accent="amber"
              size="lg"
              action={
                <Button variant="secondary" size="sm" onClick={reload}>
                  {t('retry')}
                </Button>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Mic2}
              title={activeTab === 'my_voices' ? t('noClonedVoices') : t('noVoicesMatch')}
              accent={activeTab === 'my_voices' ? 'emerald' : 'neutral'}
              size="lg"
            />
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
