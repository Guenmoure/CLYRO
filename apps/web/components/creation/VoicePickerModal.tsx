'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Play, Pause, Star, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ClyroVoice {
  id: string
  name: string
  previewUrl?: string
  category?: string
  gender?: 'male' | 'female' | 'neutral'
  accent?: string
  language?: string
  age?: string
  useCase?: string
  description?: string
  isFavorite?: boolean
}

interface VoicePickerModalProps {
  isOpen: boolean
  onClose: () => void
  selectedVoiceId?: string
  onSelect: (voice: ClyroVoice) => void
  /** If provided, a "Mes voix clonées" tab is shown */
  clonedVoices?: ClyroVoice[]
  /** Library voices (public) */
  libraryVoices?: ClyroVoice[]
  /** Loading state for the library */
  loading?: boolean
}

// ── Filter pills ───────────────────────────────────────────────────────────────

const GENDER_OPTIONS  = ['Tous', 'Male', 'Female', 'Neutral']
const ACCENT_OPTIONS  = ['Tous', 'FR', 'EN-US', 'EN-GB', 'ES', 'DE', 'PT', 'IT']
const USECASE_OPTIONS = ['Tous', 'Narration', 'Commercial', 'News', 'Social', 'Conversational']

function FilterPills({
  options,
  selected,
  onChange,
}: {
  options: string[]
  selected: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            'px-2.5 py-1 rounded-lg font-mono text-xs transition-all duration-150',
            selected === opt
              ? 'bg-blue-500/15 border border-blue-500/40 text-blue-400'
              : 'bg-muted border border-border text-[--text-muted] hover:border-border hover:text-foreground',
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

// ── VoiceRow ───────────────────────────────────────────────────────────────────

function VoiceRow({
  voice,
  selected,
  onSelect,
}: {
  voice: ClyroVoice
  selected: boolean
  onSelect: () => void
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)

  function togglePlay(e: React.MouseEvent) {
    e.stopPropagation()
    if (!voice.previewUrl) return
    if (playing) {
      audioRef.current?.pause()
      setPlaying(false)
    } else {
      // Pause all other audio elements on the page
      document.querySelectorAll('audio').forEach(a => a.pause())
      audioRef.current?.play().catch(() => {})
      setPlaying(true)
    }
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150 text-left',
        selected
          ? 'bg-blue-500/10 border border-blue-500/30'
          : 'bg-muted/50 border border-border/50 hover:bg-muted hover:border-border',
      )}
    >
      {/* Play/pause */}
      <button
        type="button"
        onClick={togglePlay}
        disabled={!voice.previewUrl}
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
          'bg-border hover:bg-border transition-colors',
          'disabled:opacity-30 disabled:pointer-events-none',
        )}
        aria-label={playing ? 'Pause' : 'Écouter'}
      >
        {playing
          ? <Pause size={13} className="text-blue-400" />
          : <Play  size={13} className="text-[--text-secondary]" />
        }
      </button>

      {/* Hidden audio */}
      {voice.previewUrl && (
        <audio
          ref={audioRef}
          src={voice.previewUrl}
          onEnded={() => setPlaying(false)}
          onPause={() => setPlaying(false)}
        />
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-display text-sm text-foreground truncate">{voice.name}</p>
          {voice.isFavorite && <Star size={11} className="text-warning fill-warning shrink-0" />}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {voice.language && (
            <Badge variant="neutral" className="text-[10px] py-0">{voice.language}</Badge>
          )}
          {voice.gender && (
            <span className="font-mono text-[10px] text-[--text-muted] capitalize">{voice.gender}</span>
          )}
          {voice.useCase && (
            <span className="font-mono text-[10px] text-[--text-muted]">{voice.useCase}</span>
          )}
        </div>
      </div>

      {/* Selected check */}
      {selected && (
        <span className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
          <Check size={11} className="text-white" />
        </span>
      )}
    </button>
  )
}

// ── VoicePickerModal ───────────────────────────────────────────────────────────

export function VoicePickerModal({
  isOpen,
  onClose,
  selectedVoiceId,
  onSelect,
  clonedVoices = [],
  libraryVoices = [],
  loading = false,
}: VoicePickerModalProps) {
  const [tab,        setTab]        = useState<'library' | 'cloned'>('library')
  const [search,     setSearch]     = useState('')
  const [gender,     setGender]     = useState('Tous')
  const [accent,     setAccent]     = useState('Tous')
  const [useCase,    setUseCase]    = useState('Tous')
  const [localSel,   setLocalSel]   = useState(selectedVoiceId)

  useEffect(() => { setLocalSel(selectedVoiceId) }, [selectedVoiceId])

  const voices = tab === 'library' ? libraryVoices : clonedVoices

  const filtered = voices.filter(v => {
    if (search && !v.name.toLowerCase().includes(search.toLowerCase())) return false
    if (gender  !== 'Tous' && v.gender?.toLowerCase() !== gender.toLowerCase())  return false
    if (accent  !== 'Tous' && v.accent?.toUpperCase()  !== accent)               return false
    if (useCase !== 'Tous' && v.useCase !== useCase)                              return false
    return true
  })

  function handleConfirm() {
    const voice = voices.find(v => v.id === localSel)
    if (voice) {
      onSelect(voice)
      onClose()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Choisir une voix"
      size="xl"
    >
      <div className="space-y-4">

        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-xl p-1">
          {([['library', 'Bibliothèque publique'], ['cloned', 'Mes voix clonées']] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                'flex-1 rounded-lg py-1.5 font-mono text-xs transition-all duration-150',
                tab === key
                  ? 'bg-border text-foreground shadow-sm'
                  : 'text-[--text-muted] hover:text-foreground',
              )}
            >
              {label}
              {key === 'cloned' && clonedVoices.length > 0 && (
                <span className="ml-1.5 text-[10px] text-blue-400">({clonedVoices.length})</span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--text-muted]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une voix…"
            className="w-full bg-muted border border-border rounded-xl pl-9 pr-4 py-2 font-body text-sm text-foreground placeholder-[--text-muted] focus:outline-none focus:border-blue-500/60 transition-colors"
          />
        </div>

        {/* Filters */}
        <div className="space-y-2">
          <FilterPills options={GENDER_OPTIONS}  selected={gender}  onChange={setGender} />
          <FilterPills options={ACCENT_OPTIONS}  selected={accent}  onChange={setAccent} />
          <FilterPills options={USECASE_OPTIONS} selected={useCase} onChange={setUseCase} />
        </div>

        {/* Voice list */}
        <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 no-scrollbar">
          {loading && (
            <div className="space-y-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-muted animate-shimmer" />
              ))}
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="py-10 text-center">
              <p className="font-mono text-sm text-[--text-muted]">Aucune voix trouvée</p>
            </div>
          )}

          {!loading && filtered.map(voice => (
            <VoiceRow
              key={voice.id}
              voice={voice}
              selected={localSel === voice.id}
              onSelect={() => setLocalSel(voice.id)}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/50">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" disabled={!localSel} onClick={handleConfirm}>
            Confirmer
          </Button>
        </div>

      </div>
    </Modal>
  )
}
