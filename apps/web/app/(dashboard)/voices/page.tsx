'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Mic2, Search, Star, Play, Pause, Plus, Trash2 } from 'lucide-react'
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

type Tab = 'public' | 'personal'

interface ClonedVoice {
  id: string
  name: string
  elevenlabs_voice_id: string
  created_at: string
}

// ── Filters bar ────────────────────────────────────────────────────────────────

function FiltersBar({
  filters, options, onFilter,
}: {
  filters: { gender: string; language: string; useCase: string; search: string }
  options: {
    genders: string[]
    languages: Array<{ value: string; label: string; flag: string }>
    useCases: string[]
  }
  onFilter: (key: string, value: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <div className="relative flex-1 min-w-48">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/25 pointer-events-none" />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => onFilter('search', e.target.value)}
          placeholder="Rechercher une voix…"
          aria-label="Rechercher une voix"
          className="w-full glass rounded-xl pl-9 pr-4 py-2.5 text-gray-700 dark:text-white/80 font-body text-sm placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none focus:border-clyro-primary/40 transition-all duration-200"
        />
      </div>

      <select
        value={filters.language}
        onChange={(e) => onFilter('language', e.target.value)}
        title="Filtrer par langue"
        aria-label="Filtrer par langue"
        className="bg-white dark:bg-navy-900 border border-gray-200 dark:border-white/[0.06] rounded-xl px-3 py-2.5 text-gray-700 dark:text-white/70 font-body text-sm focus:outline-none focus:border-clyro-primary/40 appearance-none transition-all"
      >
        <option value="">🌐 Toutes les langues</option>
        {options.languages.map((l) => (
          <option key={l.value} value={l.value}>{l.flag} {l.label}</option>
        ))}
      </select>

      <select
        value={filters.gender}
        onChange={(e) => onFilter('gender', e.target.value)}
        title="Filtrer par genre"
        aria-label="Filtrer par genre"
        className="bg-white dark:bg-navy-900 border border-gray-200 dark:border-white/[0.06] rounded-xl px-3 py-2.5 text-gray-700 dark:text-white/70 font-body text-sm focus:outline-none focus:border-clyro-primary/40 appearance-none transition-all"
      >
        <option value="">Genre</option>
        {options.genders.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>

      <select
        value={filters.useCase}
        onChange={(e) => onFilter('useCase', e.target.value)}
        title="Filtrer par utilisation"
        aria-label="Filtrer par utilisation"
        className="bg-white dark:bg-navy-900 border border-gray-200 dark:border-white/[0.06] rounded-xl px-3 py-2.5 text-gray-700 dark:text-white/70 font-body text-sm focus:outline-none focus:border-clyro-primary/40 appearance-none transition-all"
      >
        <option value="">Utilisation</option>
        {options.useCases.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

// ── Public voice card ──────────────────────────────────────────────────────────

function PublicVoiceCard({ voice, onToggleFavorite }: {
  voice: ClyroVoice
  onToggleFavorite: (id: string, current: boolean) => void
}) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  function handlePlay() {
    if (!voice.previewUrl) return
    if (playing) { audioRef.current?.pause(); setPlaying(false); return }
    if (!audioRef.current) {
      audioRef.current = new Audio(voice.previewUrl)
      audioRef.current.onended = () => setPlaying(false)
    }
    audioRef.current.play()
    setPlaying(true)
  }

  return (
    <div className="glass rounded-xl p-4 hover:border-clyro-primary/30 card-hover transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {voice.languageFlag && (
              <span className="text-base leading-none">{voice.languageFlag}</span>
            )}
            <p className="font-display font-semibold text-gray-900 dark:text-white text-sm truncate">{voice.name}</p>
          </div>
          <p className="font-mono text-xs text-gray-500 dark:text-white/40">
            {[voice.language, voice.gender, voice.useCase].filter(Boolean).join(' · ')}
          </p>
          {voice.description && (
            <p className="font-body text-xs text-gray-500 dark:text-white/40 mt-1 line-clamp-2">{voice.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {voice.previewUrl && (
            <button
              type="button"
              onClick={handlePlay}
              aria-label={playing ? 'Pause' : 'Écouter la voix'}
              className="w-8 h-8 rounded-full bg-clyro-primary/15 border border-clyro-primary/25 flex items-center justify-center text-clyro-primary hover:bg-clyro-primary hover:text-white transition-all duration-200"
            >
              {playing ? <Pause size={12} /> : <Play size={12} />}
            </button>
          )}
          <button
            type="button"
            onClick={() => onToggleFavorite(voice.id, voice.isFavorite ?? false)}
            aria-label={voice.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            className={cn(
              'w-8 h-8 rounded-full border flex items-center justify-center transition-all',
              voice.isFavorite
                ? 'bg-yellow-400/15 border-yellow-400/30 text-yellow-400'
                : 'glass text-white/30 hover:text-yellow-400'
            )}
          >
            <Star size={13} fill={voice.isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Clone voice modal ──────────────────────────────────────────────────────────

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
      if (!user) throw new Error('Non authentifié')
      const ext  = file.name.split('.').pop() ?? 'mp3'
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('voice-samples').upload(path, file, { contentType: file.type })
      if (uploadError) throw new Error(uploadError.message)
      const { data: urlData } = supabase.storage.from('voice-samples').getPublicUrl(path)
      await cloneVoice({ name: name.trim(), sample_url: urlData.publicUrl })
      toast.success('Voix clonée avec succès !')
      onCloned(); onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du clonage')
    } finally { setUploading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass glass-heavy rounded-2xl p-6 w-full max-w-md shadow-glow-primary">
        <h3 className="font-display text-lg font-semibold text-white mb-1">Cloner une voix</h3>
        <p className="text-white/50 text-sm font-body mb-5">Upload un extrait audio clair de 30–60 secondes (MP3, WAV, M4A).</p>
        <div className="space-y-4 mb-5">
          <div>
            <label htmlFor="voice-name" className="font-mono text-[11px] uppercase tracking-widest text-white/40 mb-2 block">Nom</label>
            <input
              id="voice-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ma voix principale"
              className="w-full glass rounded-xl px-4 py-3 text-white/80 font-body text-sm placeholder:text-white/25 focus:outline-none focus:border-clyro-primary/50 transition-all"
            />
          </div>
          <div>
            <label htmlFor="voice-file" className="font-mono text-[11px] uppercase tracking-widest text-white/40 mb-2 block">Fichier audio</label>
            <input
              id="voice-file"
              type="file"
              accept="audio/mp3,audio/mpeg,audio/wav,audio/m4a,audio/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full glass rounded-xl px-4 py-3 text-white/80 font-body text-sm file:mr-3 file:font-mono file:text-xs file:text-clyro-primary file:bg-transparent file:border-0 file:cursor-pointer focus:outline-none"
            />
          </div>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 glass glass-hover text-white/60 font-display font-semibold py-2.5 rounded-xl text-sm transition-all">
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim() || !file || uploading}
            className="flex-1 bg-grad-primary text-white font-display font-semibold py-2.5 rounded-xl hover:opacity-90 disabled:opacity-50 text-sm"
          >
            {uploading ? 'Upload…' : 'Cloner'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Personal voice card ────────────────────────────────────────────────────────

function PersonalVoiceCard({ voice, onDeleted }: { voice: ClonedVoice; onDeleted: (id: string) => void }) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [deleting, setDeleting]       = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteVoice(voice.id)
      toast.success('Voix supprimée')
      onDeleted(voice.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
      setDeleting(false); setShowConfirm(false)
    }
  }

  return (
    <div className="glass rounded-xl p-4 card-hover transition-all">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-clyro-primary/15 border border-clyro-primary/20 flex items-center justify-center">
            <Mic2 size={16} className="text-clyro-primary" />
          </div>
          <div>
            <p className="font-display font-semibold text-gray-900 dark:text-white text-sm">{voice.name}</p>
            <p className="font-mono text-xs text-gray-500 dark:text-white/40 mt-0.5">
              Clonée · {new Date(voice.created_at).toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!showConfirm ? (
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              aria-label="Supprimer la voix"
              className="w-8 h-8 rounded-full bg-error/10 border border-error/20 flex items-center justify-center text-error/70 hover:bg-error/20 hover:text-error transition-all"
            >
              <Trash2 size={13} />
            </button>
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="font-mono text-xs text-white px-3 py-1.5 bg-error rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">
                {deleting ? '…' : 'Confirmer'}
              </button>
              <button type="button" onClick={() => setShowConfirm(false)}
                className="font-mono text-xs text-white/50 px-3 py-1.5 glass rounded-lg transition-all">
                Annuler
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function VoicesPage() {
  const [tab, setTab] = useState<Tab>('public')

  const [publicVoices,  setPublicVoices]  = useState<ClyroVoice[]>([])
  const [loadingPublic, setLoadingPublic] = useState(true)
  const [filterOptions, setFilterOptions] = useState<{
    genders: string[]
    languages: Array<{ value: string; label: string; flag: string }>
    useCases: string[]
  }>({ genders: [], languages: [], useCases: [] })
  const [filters, setFilters] = useState({ gender: '', language: '', useCase: '', search: '' })

  const [personalVoices,  setPersonalVoices]  = useState<ClonedVoice[]>([])
  const [loadingPersonal, setLoadingPersonal] = useState(false)
  const [showCloneModal,  setShowCloneModal]  = useState(false)

  useEffect(() => { getVoiceFilters().then(setFilterOptions).catch(() => null) }, [])

  const fetchPublic = useCallback(async () => {
    setLoadingPublic(true)
    try {
      const { voices } = await getPublicVoices({
        gender:   filters.gender   || undefined,
        language: filters.language || undefined,
        useCase:  filters.useCase  || undefined,
        search:   filters.search   || undefined,
      })
      setPublicVoices(voices)
    } catch {
      toast.error('Impossible de charger les voix')
    } finally {
      setLoadingPublic(false)
    }
  }, [filters])

  useEffect(() => { if (tab === 'public') fetchPublic() }, [tab, fetchPublic])

  useEffect(() => {
    if (tab !== 'personal') return
    setLoadingPersonal(true)
    getVoices()
      .then(({ personal }) => setPersonalVoices(personal as ClonedVoice[]))
      .catch(() => toast.error('Impossible de charger les voix clonées'))
      .finally(() => setLoadingPersonal(false))
  }, [tab])

  async function handleToggleFavorite(voiceId: string, isFavorite: boolean) {
    try {
      await toggleVoiceFavorite(voiceId, isFavorite ? 'remove' : 'add')
      setPublicVoices((prev) => prev.map((v) => v.id === voiceId ? { ...v, isFavorite: !isFavorite } : v))
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erreur') }
  }

  const favoriteVoices = publicVoices.filter((v) => v.isFavorite)

  return (
    <div className="flex-1 overflow-y-auto px-8 py-8">
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">

        <div className="flex items-end justify-between">
          <div>
            <p className="font-mono text-xs text-gray-400 dark:text-white/40 uppercase tracking-widest mb-1">Audio</p>
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">Voice Library</h1>
          </div>
          {tab === 'personal' && (
            <button
              type="button"
              onClick={() => setShowCloneModal(true)}
              className="flex items-center gap-2 bg-grad-primary text-white font-display font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 text-sm"
            >
              <Plus size={14} /> Clone a voice
            </button>
          )}
        </div>

        <div className="flex gap-1 glass rounded-xl p-1 w-fit">
          {([['public', 'Public Library'], ['personal', 'My Voices']] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'font-display font-semibold text-sm px-4 py-2 rounded-lg transition-all duration-200',
                tab === id
                  ? 'glass-pill text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white/80'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'public' && (
          <div className="space-y-4">
            <FiltersBar
              filters={filters}
              options={filterOptions}
              onFilter={(k, v) => setFilters((p) => ({ ...p, [k]: v }))}
            />
            {favoriteVoices.length > 0 && (
              <div>
                <p className="font-mono text-xs text-yellow-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Star size={11} fill="currentColor" /> Favoris
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  {favoriteVoices.map((v) => (
                    <PublicVoiceCard key={v.id} voice={v} onToggleFavorite={handleToggleFavorite} />
                  ))}
                </div>
              </div>
            )}
            {loadingPublic ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-20 glass rounded-xl animate-pulse" />
                ))}
              </div>
            ) : publicVoices.length === 0 ? (
              <div className="glass rounded-xl p-10 text-center">
                <p className="text-gray-400 dark:text-white/40 font-body text-sm">Aucune voix trouvée pour ces filtres.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {publicVoices.map((v) => (
                  <PublicVoiceCard key={v.id} voice={v} onToggleFavorite={handleToggleFavorite} />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'personal' && (
          <div className="space-y-3">
            {loadingPersonal ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 glass rounded-xl animate-pulse" />
              ))
            ) : personalVoices.length === 0 ? (
              <div className="glass rounded-xl p-12 text-center">
                <Mic2 size={32} className="text-gray-300 dark:text-white/20 mx-auto mb-3" />
                <p className="font-display font-semibold text-gray-900 dark:text-white mb-1">Aucune voix clonée</p>
                <p className="font-body text-sm text-gray-500 dark:text-white/50 mb-4">Clone ta voix pour l&apos;utiliser dans tes vidéos.</p>
                <button
                  type="button"
                  onClick={() => setShowCloneModal(true)}
                  className="bg-grad-primary text-white font-display font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 text-sm"
                >
                  + Cloner ma voix
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
            setTab('personal')
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
