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
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted pointer-events-none" />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => onFilter('search', e.target.value)}
          placeholder="Rechercher une voix…"
          aria-label="Rechercher une voix"
          className="w-full bg-brand-bg border border-brand-border rounded-xl pl-9 pr-4 py-2.5 text-brand-text font-body text-sm placeholder:text-brand-muted focus:outline-none focus:border-brand-primary"
        />
      </div>

      <select
        value={filters.language}
        onChange={(e) => onFilter('language', e.target.value)}
        title="Filtrer par langue"
        aria-label="Filtrer par langue"
        className="bg-brand-bg border border-brand-border rounded-xl px-3 py-2.5 text-brand-text font-body text-sm focus:outline-none focus:border-brand-primary appearance-none"
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
        className="bg-brand-bg border border-brand-border rounded-xl px-3 py-2.5 text-brand-text font-body text-sm focus:outline-none focus:border-brand-primary appearance-none"
      >
        <option value="">Genre</option>
        {options.genders.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>

      <select
        value={filters.useCase}
        onChange={(e) => onFilter('useCase', e.target.value)}
        title="Filtrer par utilisation"
        aria-label="Filtrer par utilisation"
        className="bg-brand-bg border border-brand-border rounded-xl px-3 py-2.5 text-brand-text font-body text-sm focus:outline-none focus:border-brand-primary appearance-none"
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
    <div className="bg-brand-surface border border-brand-border rounded-xl p-4 hover:border-brand-primary/30 hover:shadow-brand-sm transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {voice.languageFlag && (
              <span className="text-base leading-none">{voice.languageFlag}</span>
            )}
            <p className="font-display font-semibold text-brand-text text-sm truncate">{voice.name}</p>
          </div>
          <p className="font-mono text-xs text-brand-muted">
            {[voice.language, voice.gender, voice.useCase].filter(Boolean).join(' · ')}
          </p>
          {voice.description && (
            <p className="font-body text-xs text-brand-muted mt-1 line-clamp-2">{voice.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {voice.previewUrl && (
            <button
              type="button"
              onClick={handlePlay}
              aria-label={playing ? 'Pause' : 'Écouter la voix'}
              className="w-8 h-8 rounded-full bg-brand-primary-light border border-brand-primary/20 flex items-center justify-center text-brand-primary hover:bg-brand-primary hover:text-white transition-all"
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
                ? 'bg-yellow-50 border-yellow-300 text-yellow-500'
                : 'bg-brand-bg border-brand-border text-brand-muted hover:text-yellow-500'
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
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 w-full max-w-md shadow-brand-lg">
        <h3 className="font-display text-lg font-semibold text-brand-text mb-1">Cloner une voix</h3>
        <p className="text-brand-muted text-sm font-body mb-5">Upload un extrait audio clair de 30–60 secondes (MP3, WAV, M4A).</p>
        <div className="space-y-4 mb-5">
          <div>
            <label htmlFor="voice-name" className="font-mono text-[11px] uppercase tracking-widest text-brand-muted mb-2 block">Nom</label>
            <input
              id="voice-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ma voix principale"
              className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-3 text-brand-text font-body text-sm placeholder:text-brand-muted focus:outline-none focus:border-brand-primary"
            />
          </div>
          <div>
            <label htmlFor="voice-file" className="font-mono text-[11px] uppercase tracking-widest text-brand-muted mb-2 block">Fichier audio</label>
            <input
              id="voice-file"
              type="file"
              accept="audio/mp3,audio/mpeg,audio/wav,audio/m4a,audio/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-3 text-brand-text font-body text-sm file:mr-3 file:font-mono file:text-xs file:text-brand-primary file:bg-transparent file:border-0 file:cursor-pointer focus:outline-none"
            />
          </div>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 bg-brand-bg border border-brand-border text-brand-text font-display font-semibold py-2.5 rounded-xl text-sm">
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
    <div className="bg-brand-surface border border-brand-border rounded-xl p-4 hover:shadow-brand-sm transition-all">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-brand-primary-light flex items-center justify-center">
            <Mic2 size={16} className="text-brand-primary" />
          </div>
          <div>
            <p className="font-display font-semibold text-brand-text text-sm">{voice.name}</p>
            <p className="font-mono text-xs text-brand-muted mt-0.5">
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
              className="w-8 h-8 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-400 hover:bg-red-100 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="font-mono text-xs text-white px-3 py-1.5 bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50">
                {deleting ? '…' : 'Confirmer'}
              </button>
              <button type="button" onClick={() => setShowConfirm(false)}
                className="font-mono text-xs text-brand-muted px-3 py-1.5 bg-brand-bg border border-brand-border rounded-lg">
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
            <p className="font-mono text-xs text-brand-muted uppercase tracking-widest mb-1">Audio</p>
            <h1 className="font-display text-2xl font-bold text-brand-text">Voice Library</h1>
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

        <div className="flex gap-1 bg-brand-bg border border-brand-border rounded-xl p-1 w-fit">
          {([['public', 'Public Library'], ['personal', 'My Voices']] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'font-display font-semibold text-sm px-4 py-2 rounded-lg transition-all',
                tab === id
                  ? 'bg-brand-surface text-brand-text shadow-brand-sm border border-brand-border'
                  : 'text-brand-muted hover:text-brand-text'
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
                <p className="font-mono text-xs text-yellow-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
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
                  <div key={i} className="h-20 bg-brand-bg border border-brand-border rounded-xl animate-pulse" />
                ))}
              </div>
            ) : publicVoices.length === 0 ? (
              <div className="bg-brand-surface border border-brand-border rounded-xl p-10 text-center">
                <p className="text-brand-muted font-body text-sm">Aucune voix trouvée pour ces filtres.</p>
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
                <div key={i} className="h-16 bg-brand-bg border border-brand-border rounded-xl animate-pulse" />
              ))
            ) : personalVoices.length === 0 ? (
              <div className="bg-brand-surface border border-brand-border rounded-xl p-12 text-center">
                <Mic2 size={32} className="text-brand-border mx-auto mb-3" />
                <p className="font-display font-semibold text-brand-text mb-1">Aucune voix clonée</p>
                <p className="font-body text-sm text-brand-muted mb-4">Clone ta voix pour l&apos;utiliser dans tes vidéos.</p>
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
