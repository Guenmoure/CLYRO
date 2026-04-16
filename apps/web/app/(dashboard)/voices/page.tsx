'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Mic2, Search, Star, Play, Pause, Plus, Trash2, X,
  SlidersHorizontal, Globe, MessageCircle, BookOpen,
  Users, Video, GraduationCap, TrendingUp, ChevronRight,
} from 'lucide-react'
import {
  getPublicVoices,
  getVoiceFilters,
  toggleVoiceFavorite,
  cloneVoice,
  deleteVoice,
  getVoices,
  type ClyroVoice,
} from '@/lib/api'
import { createBrowserClient } from '@/lib/supabase'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

type Tab = 'explore' | 'my-voices' | 'default'

interface ClonedVoice {
  id: string
  name: string
  elevenlabs_voice_id: string
  created_at: string
}

// ── Use-case category chips ──────────────────────────────────────────────────

const USE_CASE_CATEGORIES = [
  { key: '',                label: 'All',             icon: null },
  { key: 'conversational',  label: 'Conversational',  icon: MessageCircle },
  { key: 'narration',       label: 'Narration',       icon: BookOpen },
  { key: 'characters',      label: 'Characters',      icon: Users },
  { key: 'social media',    label: 'Social Media',    icon: Video },
  { key: 'educational',     label: 'Educational',     icon: GraduationCap },
  { key: 'news',            label: 'News',            icon: TrendingUp },
] as const

// ── Voice card (compact row style like ElevenLabs) ───────────────────────────

function VoiceCard({ voice, onToggleFavorite, compact }: {
  voice: ClyroVoice
  onToggleFavorite?: (id: string, current: boolean) => void
  compact?: boolean
}) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  function handlePlay(e: React.MouseEvent) {
    e.stopPropagation()
    if (!voice.previewUrl) return
    if (playing) { audioRef.current?.pause(); setPlaying(false); return }
    if (!audioRef.current) {
      audioRef.current = new Audio(voice.previewUrl)
      audioRef.current.onended = () => setPlaying(false)
    }
    audioRef.current.play()
    setPlaying(true)
  }

  if (compact) {
    // Trending-style compact card (horizontal row)
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/50 transition-all cursor-pointer group">
        {/* Avatar circle */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-border flex items-center justify-center shrink-0">
          {voice.previewUrl ? (
            <button type="button" onClick={handlePlay} aria-label={playing ? 'Pause' : 'Play'}>
              {playing ? <Pause size={14} className="text-blue-500" /> : <Play size={14} className="text-blue-500" />}
            </button>
          ) : (
            <Mic2 size={14} className="text-[--text-muted]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-body text-sm font-medium text-foreground truncate">{voice.name}</p>
          <p className="font-body text-xs text-[--text-muted] truncate">
            {voice.useCase || 'General'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {voice.languageFlag && <span className="text-sm">{voice.languageFlag}</span>}
          <span className="font-body text-xs text-[--text-muted]">{voice.language || voice.accent || ''}</span>
        </div>
      </div>
    )
  }

  // Full card style
  return (
    <div className="rounded-xl border border-border bg-card p-4 hover:border-blue-500/30 hover:bg-muted/30 transition-all group">
      <div className="flex items-start gap-3">
        {/* Play avatar */}
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500/15 to-purple-500/15 border border-border flex items-center justify-center shrink-0">
          {voice.previewUrl ? (
            <button type="button" onClick={handlePlay} aria-label={playing ? 'Pause' : 'Play'}
              className="w-full h-full rounded-full flex items-center justify-center hover:bg-blue-500/10 transition-colors"
            >
              {playing
                ? <Pause size={14} className="text-blue-500" />
                : <Play size={14} className="text-blue-500 ml-0.5" />
              }
            </button>
          ) : (
            <Mic2 size={14} className="text-[--text-muted]" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-body text-sm font-semibold text-foreground truncate">{voice.name}</p>
          </div>
          <p className="font-body text-xs text-[--text-muted] mt-0.5">
            {voice.useCase || 'General'}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            {voice.languageFlag && <span className="text-xs">{voice.languageFlag}</span>}
            <span className="font-body text-xs text-[--text-muted]">{voice.language || voice.accent || ''}</span>
            {voice.gender && (
              <>
                <span className="text-[--text-muted]">&middot;</span>
                <span className="font-body text-xs text-[--text-muted] capitalize">{voice.gender}</span>
              </>
            )}
          </div>
          {voice.description && (
            <p className="font-body text-xs text-[--text-secondary] mt-1.5 line-clamp-2">{voice.description}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onToggleFavorite && (
            <button
              type="button"
              onClick={() => onToggleFavorite(voice.id, voice.isFavorite ?? false)}
              aria-label={voice.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              className={cn(
                'w-8 h-8 rounded-full border flex items-center justify-center transition-all',
                voice.isFavorite
                  ? 'bg-yellow-400/15 border-yellow-400/30 text-yellow-400'
                  : 'border-border text-[--text-muted] hover:text-yellow-400 hover:border-yellow-400/30'
              )}
            >
              <Star size={13} fill={voice.isFavorite ? 'currentColor' : 'none'} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Clone voice modal ────────────────────────────────────────────────────────

function CloneVoiceModal({ onClose, onCloned }: { onClose: () => void; onCloned: () => void }) {
  const [name, setName]           = useState('')
  const [file, setFile]           = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  async function handleSubmit() {
    if (!name.trim() || !file) return
    setUploading(true)
    try {
      const supabase = createBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const ext  = file.name.split('.').pop() ?? 'mp3'
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('voice-samples').upload(path, file, { contentType: file.type })
      if (uploadError) throw new Error(uploadError.message)
      const { data: urlData } = supabase.storage.from('voice-samples').getPublicUrl(path)
      await cloneVoice({ name: name.trim(), sample_url: urlData.publicUrl })
      toast.success('Voice cloned successfully!')
      onCloned(); onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error cloning voice')
    } finally { setUploading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="rounded-2xl border border-border bg-card p-6 w-full max-w-md shadow-xl">
        <h3 className="font-body text-lg font-semibold text-foreground mb-1">Clone a voice</h3>
        <p className="text-[--text-muted] text-sm font-body mb-5">Upload a clear 30-60 second audio sample (MP3, WAV, M4A).</p>
        <div className="space-y-4 mb-5">
          <div>
            <label htmlFor="voice-name" className="font-body text-xs font-medium text-[--text-secondary] mb-2 block">Name</label>
            <input id="voice-name" type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="My main voice"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground font-body text-sm placeholder:text-[--text-muted] focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>
          <div>
            <label htmlFor="voice-file" className="font-body text-xs font-medium text-[--text-secondary] mb-2 block">Audio file</label>
            <input id="voice-file" type="file" accept="audio/mp3,audio/mpeg,audio/wav,audio/m4a,audio/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground font-body text-sm file:mr-3 file:text-xs file:text-blue-500 file:bg-transparent file:border-0 file:cursor-pointer focus:outline-none"
            />
          </div>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 border border-border bg-card text-foreground font-body font-medium py-2.5 rounded-xl text-sm hover:bg-muted transition-all">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={!name.trim() || !file || uploading}
            className="flex-1 bg-blue-500 text-white font-body font-medium py-2.5 rounded-xl hover:bg-blue-600 disabled:opacity-50 text-sm transition-colors"
          >
            {uploading ? 'Uploading...' : 'Clone'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Personal voice card ──────────────────────────────────────────────────────

function PersonalVoiceCard({ voice, onDeleted }: { voice: ClonedVoice; onDeleted: (id: string) => void }) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [deleting, setDeleting]       = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteVoice(voice.id)
      toast.success('Voice deleted')
      onDeleted(voice.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
      setDeleting(false); setShowConfirm(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 hover:bg-muted/30 transition-all">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/15 to-blue-500/15 border border-border flex items-center justify-center">
            <Mic2 size={16} className="text-emerald-500" />
          </div>
          <div>
            <p className="font-body text-sm font-semibold text-foreground">{voice.name}</p>
            <p className="font-body text-xs text-[--text-muted] mt-0.5">
              Cloned &middot; {new Date(voice.created_at).toLocaleDateString('en-US')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!showConfirm ? (
            <button type="button" onClick={() => setShowConfirm(true)} aria-label="Delete voice"
              className="w-8 h-8 rounded-full border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/10 transition-all"
            >
              <Trash2 size={13} />
            </button>
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="font-body text-xs text-white px-3 py-1.5 bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">
                {deleting ? '...' : 'Confirm'}
              </button>
              <button type="button" onClick={() => setShowConfirm(false)}
                className="font-body text-xs text-[--text-muted] px-3 py-1.5 border border-border rounded-lg hover:bg-muted transition-all">
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Trending voices section ──────────────────────────────────────────────────

function TrendingSection({ voices, onToggleFavorite }: {
  voices: ClyroVoice[]
  onToggleFavorite: (id: string, current: boolean) => void
}) {
  // Pick first 6 voices that have a preview URL as "trending"
  const trending = useMemo(
    () => voices.filter((v) => v.previewUrl).slice(0, 6),
    [voices],
  )

  if (trending.length === 0) return null

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={16} className="text-blue-500" />
        <h2 className="font-body text-base font-semibold text-foreground">Trending voices</h2>
        <ChevronRight size={16} className="text-[--text-muted]" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {trending.map((v) => (
          <VoiceCard key={v.id} voice={v} compact onToggleFavorite={onToggleFavorite} />
        ))}
      </div>
    </section>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function VoicesPage() {
  const [tab, setTab] = useState<Tab>('explore')

  // Explore tab state
  const [publicVoices, setPublicVoices]   = useState<ClyroVoice[]>([])
  const [loadingPublic, setLoadingPublic] = useState(true)
  const [filterOptions, setFilterOptions] = useState<{
    genders: string[]
    languages: Array<{ value: string; label: string; flag: string }>
    useCases: string[]
  }>({ genders: [], languages: [], useCases: [] })
  const [filters, setFilters] = useState({ gender: '', language: '', useCase: '', search: '' })
  const [activeCategory, setActiveCategory] = useState('')

  // My voices tab state
  const [personalVoices, setPersonalVoices]   = useState<ClonedVoice[]>([])
  const [loadingPersonal, setLoadingPersonal] = useState(false)
  const [showCloneModal, setShowCloneModal]   = useState(false)

  // Fetch filter options once
  useEffect(() => { getVoiceFilters().then(setFilterOptions).catch(() => null) }, [])

  // Fetch public voices
  const fetchPublic = useCallback(async () => {
    setLoadingPublic(true)
    try {
      const { voices } = await getPublicVoices({
        gender:   filters.gender   || undefined,
        language: filters.language || undefined,
        useCase:  activeCategory   || filters.useCase || undefined,
        search:   filters.search   || undefined,
      })
      setPublicVoices(voices)
    } catch (err) {
      console.error('[voices/public]', err)
      toast.error(err instanceof Error ? err.message : 'Failed to load voices')
    } finally { setLoadingPublic(false) }
  }, [filters, activeCategory])

  useEffect(() => { if (tab === 'explore' || tab === 'default') fetchPublic() }, [tab, fetchPublic])

  // Fetch personal voices
  useEffect(() => {
    if (tab !== 'my-voices') return
    setLoadingPersonal(true)
    getVoices()
      .then(({ personal }) => setPersonalVoices(personal as ClonedVoice[]))
      .catch((err) => {
        console.error('[voices/personal]', err)
        toast.error(err instanceof Error ? err.message : 'Failed to load cloned voices')
      })
      .finally(() => setLoadingPersonal(false))
  }, [tab])

  // Filtered voices for display
  const displayVoices = useMemo(() => {
    if (tab === 'default') {
      // "Default voices" = premade voices, no cloned/custom
      return publicVoices.filter((v) => v.category === 'public')
    }
    return publicVoices
  }, [publicVoices, tab])

  // Favorites
  const favoriteVoices = useMemo(
    () => displayVoices.filter((v) => v.isFavorite),
    [displayVoices],
  )

  async function handleToggleFavorite(voiceId: string, isFavorite: boolean) {
    try {
      await toggleVoiceFavorite(voiceId, isFavorite ? 'remove' : 'add')
      setPublicVoices((prev) => prev.map((v) => v.id === voiceId ? { ...v, isFavorite: !isFavorite } : v))
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error') }
  }

  const TABS = [
    { key: 'explore' as Tab,   label: 'Explore' },
    { key: 'my-voices' as Tab, label: 'My Voices' },
    { key: 'default' as Tab,   label: 'Default Voices' },
  ]

  return (
    <div className="flex-1 overflow-y-auto bg-background px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <h1 className="font-body text-2xl font-bold text-foreground">Voices</h1>
            {/* Tabs */}
            <div className="flex gap-1 border border-border rounded-xl p-1 bg-card">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'font-body font-medium text-sm px-4 py-2 rounded-lg transition-all duration-200',
                    tab === t.key
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-[--text-muted] hover:text-foreground'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Create voice button */}
          {tab === 'my-voices' && (
            <button type="button" onClick={() => setShowCloneModal(true)}
              className="flex items-center gap-2 bg-blue-500 text-white font-body font-medium px-4 py-2.5 rounded-xl hover:bg-blue-600 text-sm transition-colors"
            >
              <Plus size={14} /> Create Voice
            </button>
          )}
        </div>

        {/* ── Explore / Default tab content ─────────────────────────────── */}
        {(tab === 'explore' || tab === 'default') && (
          <div className="space-y-6">

            {/* Search + Filters row */}
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[240px]">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[--text-muted] pointer-events-none" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
                  placeholder="Search library voices..."
                  aria-label="Search voices"
                  className="w-full pl-10 pr-9 py-2.5 border border-border bg-card rounded-xl text-sm font-body text-foreground placeholder:text-[--text-muted] focus:outline-none focus:border-blue-500 transition-all"
                />
                {filters.search && (
                  <button type="button" onClick={() => setFilters((p) => ({ ...p, search: '' }))} aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[--text-muted] hover:text-foreground"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Language dropdown */}
              <div className="flex items-center gap-1.5 border border-border bg-card rounded-xl px-3 py-2.5">
                <Globe size={14} className="text-[--text-muted]" />
                <select
                  value={filters.language}
                  onChange={(e) => setFilters((p) => ({ ...p, language: e.target.value }))}
                  aria-label="Filter by language"
                  className="bg-transparent text-sm font-body text-foreground focus:outline-none appearance-none cursor-pointer pr-2"
                >
                  <option value="">Language</option>
                  {filterOptions.languages.map((l) => (
                    <option key={l.value} value={l.value}>{l.flag} {l.label}</option>
                  ))}
                </select>
              </div>

              {/* Gender dropdown */}
              <select
                value={filters.gender}
                onChange={(e) => setFilters((p) => ({ ...p, gender: e.target.value }))}
                aria-label="Filter by gender"
                className="border border-border bg-card rounded-xl px-3 py-2.5 text-sm font-body text-foreground focus:outline-none appearance-none cursor-pointer"
              >
                <option value="">Accent</option>
                {filterOptions.genders.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            {/* Category chips (horizontal scroll) */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {USE_CASE_CATEGORIES.map((cat) => {
                const Icon = cat.icon
                const isActive = activeCategory === cat.key
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setActiveCategory(cat.key)}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-body font-medium border whitespace-nowrap transition-all shrink-0',
                      isActive
                        ? 'bg-foreground text-background border-foreground'
                        : 'bg-card text-foreground border-border hover:border-blue-500/40'
                    )}
                  >
                    {Icon && <Icon size={14} />}
                    {cat.label}
                  </button>
                )
              })}
            </div>

            {/* Trending section (only on Explore tab, no active category/search) */}
            {tab === 'explore' && !activeCategory && !filters.search && !filters.language && !filters.gender && (
              <TrendingSection voices={publicVoices} onToggleFavorite={handleToggleFavorite} />
            )}

            {/* Favorites section */}
            {favoriteVoices.length > 0 && !filters.search && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Star size={14} className="text-yellow-400" fill="currentColor" />
                  <h2 className="font-body text-base font-semibold text-foreground">Favorites</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {favoriteVoices.map((v) => (
                    <VoiceCard key={v.id} voice={v} onToggleFavorite={handleToggleFavorite} />
                  ))}
                </div>
              </section>
            )}

            {/* All voices grid */}
            <section>
              {!filters.search && !activeCategory && (
                <h2 className="font-body text-base font-semibold text-foreground mb-3">
                  {tab === 'default' ? 'Default voices' : 'All voices'}
                </h2>
              )}
              {loadingPublic ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-24 rounded-xl border border-border bg-card animate-pulse" />
                  ))}
                </div>
              ) : displayVoices.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-10 text-center">
                  <Mic2 size={24} className="text-[--text-muted] mx-auto mb-2" />
                  <p className="text-[--text-muted] font-body text-sm">No voices match these filters.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {displayVoices.map((v) => (
                    <VoiceCard key={v.id} voice={v} onToggleFavorite={handleToggleFavorite} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ── My Voices tab ────────────────────────────────────────────── */}
        {tab === 'my-voices' && (
          <div className="space-y-3">
            {loadingPersonal ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl border border-border bg-card animate-pulse" />
              ))
            ) : personalVoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-8 text-center rounded-2xl border border-dashed border-border bg-muted/30">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/15 to-blue-500/15 border border-border flex items-center justify-center mb-5">
                  <Mic2 size={28} className="text-emerald-500" />
                </div>
                <p className="font-body text-lg font-bold text-foreground mb-2">No cloned voices yet</p>
                <p className="font-body text-sm text-[--text-muted] mb-5 max-w-sm">
                  Record or upload 30 seconds of your voice. We clone it via ElevenLabs so you can use it in all your videos.
                </p>
                <button type="button" onClick={() => setShowCloneModal(true)}
                  className="inline-flex items-center gap-2 bg-blue-500 text-white font-body font-medium px-5 py-2.5 rounded-xl hover:bg-blue-600 text-sm transition-colors"
                >
                  <Plus size={14} /> Create Voice
                </button>
              </div>
            ) : (
              personalVoices.map((v) => (
                <PersonalVoiceCard
                  key={v.id}
                  voice={v}
                  onDeleted={(id) => setPersonalVoices((prev) => prev.filter((pv) => pv.id !== id))}
                />
              ))
            )}
          </div>
        )}
      </div>

      {showCloneModal && (
        <CloneVoiceModal
          onClose={() => setShowCloneModal(false)}
          onCloned={() => {
            setTab('my-voices')
            setLoadingPersonal(true)
            getVoices()
              .then(({ personal }) => setPersonalVoices(personal as ClonedVoice[]))
              .finally(() => setLoadingPersonal(false))
          }}
        />
      )}
    </div>
  )
}
