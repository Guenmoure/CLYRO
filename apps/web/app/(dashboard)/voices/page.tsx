'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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

type Tab = 'public' | 'personal'

interface ClonedVoice {
  id: string
  name: string
  elevenlabs_voice_id: string
  created_at: string
}

// ── Filters bar ────────────────────────────────────────────────────────────

function FiltersBar({
  filters,
  options,
  onFilter,
}: {
  filters: { gender: string; accent: string; useCase: string; search: string }
  options: { genders: string[]; accents: string[]; useCases: string[] }
  onFilter: (key: string, value: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <input
        type="text"
        value={filters.search}
        onChange={(e) => onFilter('search', e.target.value)}
        placeholder="Rechercher une voix..."
        className="flex-1 min-w-48 bg-navy-800 border border-border rounded-xl px-4 py-2.5 text-foreground font-body text-sm placeholder:text-muted-foreground focus:outline-none focus:border-clyro-blue"
      />
      {[
        { key: 'gender',  label: 'Genre',      options: options.genders },
        { key: 'accent',  label: 'Accent',     options: options.accents },
        { key: 'useCase', label: 'Utilisation', options: options.useCases },
      ].map(({ key, label, options: opts }) => (
        <select
          key={key}
          value={filters[key as keyof typeof filters]}
          onChange={(e) => onFilter(key, e.target.value)}
          className="bg-navy-800 border border-border rounded-xl px-3 py-2.5 text-foreground font-body text-sm focus:outline-none focus:border-clyro-blue"
        >
          <option value="">{label}</option>
          {opts.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ))}
    </div>
  )
}

// ── Public voice card ──────────────────────────────────────────────────────

function PublicVoiceCard({
  voice,
  onToggleFavorite,
}: {
  voice: ClyroVoice
  onToggleFavorite: (id: string, current: boolean) => void
}) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  function handlePlay() {
    if (!voice.previewUrl) return
    if (playing) {
      audioRef.current?.pause()
      setPlaying(false)
      return
    }
    if (!audioRef.current) {
      audioRef.current = new Audio(voice.previewUrl)
      audioRef.current.onended = () => setPlaying(false)
    }
    audioRef.current.play()
    setPlaying(true)
  }

  return (
    <div className="bg-navy-900 border border-border rounded-xl p-4 hover:border-clyro-blue/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-foreground text-sm truncate">{voice.name}</p>
          <p className="font-mono text-xs text-muted-foreground mt-0.5">
            {voice.gender} · {voice.accent}
            {voice.useCase ? ` · ${voice.useCase}` : ''}
          </p>
          {voice.description && (
            <p className="font-body text-xs text-muted-foreground mt-1 line-clamp-2">{voice.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {voice.previewUrl && (
            <button
              onClick={handlePlay}
              className="w-8 h-8 rounded-full bg-clyro-blue/10 border border-clyro-blue/20 flex items-center justify-center text-clyro-blue hover:bg-clyro-blue/20 transition-colors text-xs"
            >
              {playing ? '⏸' : '▶'}
            </button>
          )}
          <button
            onClick={() => onToggleFavorite(voice.id, voice.isFavorite ?? false)}
            className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors text-sm ${
              voice.isFavorite
                ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                : 'bg-navy-800 border-border text-muted-foreground hover:text-yellow-400'
            }`}
          >
            ★
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Clone voice modal ──────────────────────────────────────────────────────

function CloneVoiceModal({ onClose, onCloned }: { onClose: () => void; onCloned: () => void }) {
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  async function handleSubmit() {
    if (!name.trim() || !file) return
    setUploading(true)
    try {
      const supabase = createBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non authentifié')

      // Upload audio to Supabase Storage
      const ext = file.name.split('.').pop() ?? 'mp3'
      const path = `${user.id}/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('voice-samples')
        .upload(path, file, { contentType: file.type })

      if (uploadError) throw new Error(uploadError.message)

      const { data: urlData } = supabase.storage
        .from('voice-samples')
        .getPublicUrl(path)

      await cloneVoice({ name: name.trim(), sample_url: urlData.publicUrl })
      toast.success('Voix clonée avec succès !')
      onCloned()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du clonage')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-navy-900 border border-border rounded-2xl p-6 w-full max-w-md">
        <h3 className="font-display text-lg font-semibold text-foreground mb-4">Cloner une voix</h3>
        <p className="text-muted-foreground text-sm font-body mb-4">
          Upload un extrait audio clair de 30–60 secondes (MP3, WAV, M4A).
        </p>
        <div className="mb-4">
          <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2 block">
            Nom de la voix
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex : Ma voix principale"
            className="w-full bg-navy-800 border border-border rounded-xl px-4 py-3 text-foreground font-body text-sm placeholder:text-muted-foreground focus:outline-none focus:border-clyro-blue"
          />
        </div>
        <div className="mb-5">
          <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2 block">
            Fichier audio
          </label>
          <input
            type="file"
            accept="audio/mp3,audio/mpeg,audio/wav,audio/m4a,audio/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full bg-navy-800 border border-border rounded-xl px-4 py-3 text-foreground font-body text-sm file:mr-3 file:font-mono file:text-xs file:text-clyro-blue file:bg-transparent file:border-0 file:cursor-pointer focus:outline-none"
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-navy-800 border border-border text-foreground font-display font-semibold py-2.5 rounded-xl hover:bg-navy-700 text-sm"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !file || uploading}
            className="flex-1 bg-grad-primary text-white font-display font-semibold py-2.5 rounded-xl hover:opacity-90 disabled:opacity-50 text-sm"
          >
            {uploading ? 'Upload...' : 'Cloner'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Personal voice card ────────────────────────────────────────────────────

function PersonalVoiceCard({ voice, onDeleted }: { voice: ClonedVoice; onDeleted: (id: string) => void }) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteVoice(voice.id)
      toast.success('Voix supprimée')
      onDeleted(voice.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression')
      setDeleting(false)
      setShowConfirm(false)
    }
  }

  return (
    <div className="bg-navy-900 border border-border rounded-xl p-4 hover:border-clyro-purple/30 transition-colors">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-display font-semibold text-foreground text-sm">{voice.name}</p>
          <p className="font-mono text-xs text-muted-foreground mt-0.5">
            Clonée · {new Date(voice.created_at).toLocaleDateString('fr-FR')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              className="font-mono text-xs text-red-400 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors"
            >
              Supprimer
            </button>
          ) : (
            <div className="flex gap-1">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="font-mono text-xs text-white px-3 py-1.5 bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? '...' : 'Confirmer'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="font-mono text-xs text-muted-foreground px-3 py-1.5 bg-navy-800 border border-border rounded-lg"
              >
                Annuler
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function VoicesPage() {
  const [tab, setTab] = useState<Tab>('public')

  // Public voices
  const [publicVoices, setPublicVoices] = useState<ClyroVoice[]>([])
  const [loadingPublic, setLoadingPublic] = useState(true)
  const [filterOptions, setFilterOptions] = useState({ genders: [] as string[], accents: [] as string[], useCases: [] as string[] })
  const [filters, setFilters] = useState({ gender: '', accent: '', useCase: '', search: '' })

  // Personal voices
  const [personalVoices, setPersonalVoices] = useState<ClonedVoice[]>([])
  const [loadingPersonal, setLoadingPersonal] = useState(false)
  const [showCloneModal, setShowCloneModal] = useState(false)

  // Load filter options once
  useEffect(() => {
    getVoiceFilters()
      .then(setFilterOptions)
      .catch(() => null)
  }, [])

  // Load public voices when filters change
  const fetchPublic = useCallback(async () => {
    setLoadingPublic(true)
    try {
      const { voices } = await getPublicVoices({
        gender:  filters.gender  || undefined,
        accent:  filters.accent  || undefined,
        useCase: filters.useCase || undefined,
        search:  filters.search  || undefined,
      })
      setPublicVoices(voices)
    } catch {
      toast.error('Impossible de charger les voix')
    } finally {
      setLoadingPublic(false)
    }
  }, [filters])

  useEffect(() => {
    if (tab === 'public') fetchPublic()
  }, [tab, fetchPublic])

  // Load personal voices when tab switches
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
      setPublicVoices((prev) =>
        prev.map((v) => v.id === voiceId ? { ...v, isFavorite: !isFavorite } : v)
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    }
  }

  function applyFilter(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const favoriteVoices = publicVoices.filter((v) => v.isFavorite)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <p className="label-mono mb-1">Voix</p>
          <h1 className="font-display text-2xl font-bold text-foreground">Bibliothèque de voix</h1>
        </div>
        {tab === 'personal' && (
          <button
            onClick={() => setShowCloneModal(true)}
            className="bg-grad-primary text-white font-display font-semibold px-4 py-2 rounded-xl hover:opacity-90 text-sm"
          >
            + Cloner une voix
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-navy-900 border border-border rounded-xl p-1 w-fit">
        {([['public', 'Bibliothèque publique'], ['personal', 'Mes voix clonées']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`font-display font-semibold text-sm px-4 py-2 rounded-lg transition-all ${
              tab === id
                ? 'bg-navy-800 text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Public tab */}
      {tab === 'public' && (
        <div className="space-y-4">
          <FiltersBar filters={filters} options={filterOptions} onFilter={applyFilter} />

          {/* Favorites section */}
          {favoriteVoices.length > 0 && (
            <div>
              <p className="font-mono text-xs text-yellow-400 uppercase tracking-widest mb-3">★ Favoris</p>
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
                <div key={i} className="h-20 bg-navy-900 border border-border rounded-xl animate-pulse" />
              ))}
            </div>
          ) : publicVoices.length === 0 ? (
            <div className="bg-navy-900 border border-border rounded-xl p-10 text-center">
              <p className="text-muted-foreground font-body text-sm">Aucune voix trouvée pour ces filtres.</p>
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

      {/* Personal tab */}
      {tab === 'personal' && (
        <div className="space-y-3">
          {loadingPersonal ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-navy-900 border border-border rounded-xl animate-pulse" />
            ))
          ) : personalVoices.length === 0 ? (
            <div className="bg-navy-900 border border-border rounded-xl p-12 text-center">
              <p className="font-display text-muted-foreground mb-2">Aucune voix clonée</p>
              <p className="font-body text-sm text-muted-foreground mb-4">
                Clone ta voix pour l&apos;utiliser dans tes vidéos Faceless et Motion.
              </p>
              <button
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

      {showCloneModal && (
        <CloneVoiceModal
          onClose={() => setShowCloneModal(false)}
          onCloned={() => {
            setTab('personal')
            // re-trigger personal load
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
