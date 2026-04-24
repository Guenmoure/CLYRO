'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Play, Pause, Star, Check, Mic2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { ClyroVoice } from '@/lib/api'

export type { ClyroVoice }

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
  /** If provided, shows a "Clone a voice" CTA in the cloned tab */
  onRequestClone?: () => void
}

// ── Filter pills ───────────────────────────────────────────────────────────────

const GENDER_OPTIONS  = ['All', 'Male', 'Female', 'Neutral']
const ACCENT_OPTIONS  = ['All', 'FR', 'EN-US', 'EN-GB', 'ES', 'DE', 'PT', 'IT']
const USECASE_OPTIONS = ['All', 'Narration', 'Commercial', 'News', 'Social', 'Conversational']

// Maps short accent pill codes to ElevenLabs accent/language values.
// ElevenLabs voices may have accent='French', 'french', 'fr', or no accent
// but language='Français' — we match both fields.
const ACCENT_TO_EL: Record<string, { accents: string[]; language: string }> = {
  'FR':    { accents: ['french', 'fr'],                   language: 'français' },
  'EN-US': { accents: ['american', 'en-us'],              language: 'english' },
  'EN-GB': { accents: ['british', 'english', 'en-gb'],    language: 'english' },
  'ES':    { accents: ['spanish', 'es'],                  language: 'español' },
  'DE':    { accents: ['german', 'de'],                   language: 'deutsch' },
  'PT':    { accents: ['portuguese', 'brazilian', 'pt'],  language: 'português' },
  'IT':    { accents: ['italian', 'it'],                  language: 'italiano' },
}

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
        aria-label={playing ? 'Pause' : 'Listen'}
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
            <Badge variant="neutral" className="text-[11px] py-0">{voice.language}</Badge>
          )}
          {voice.gender && (
            <span className="font-mono text-[11px] text-[--text-muted] capitalize">{voice.gender}</span>
          )}
          {voice.useCase && (
            <span className="font-mono text-[11px] text-[--text-muted]">{voice.useCase}</span>
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
  onRequestClone,
}: VoicePickerModalProps) {
  const [tab,        setTab]        = useState<'library' | 'cloned'>('library')
  const [search,     setSearch]     = useState('')
  const [gender,     setGender]     = useState('All')
  const [accent,     setAccent]     = useState('All')
  const [useCase,    setUseCase]    = useState('All')
  const [localSel,   setLocalSel]   = useState(selectedVoiceId)

  useEffect(() => { setLocalSel(selectedVoiceId) }, [selectedVoiceId])

  const voices = tab === 'library' ? libraryVoices : clonedVoices

  const filtered = voices.filter(v => {
    if (search && !v.name.toLowerCase().includes(search.toLowerCase())) return false
    if (gender !== 'All' && v.gender?.toLowerCase() !== gender.toLowerCase()) return false
    if (accent !== 'All') {
      const mapping = ACCENT_TO_EL[accent]
      if (mapping) {
        const vAccent = v.accent?.toLowerCase() ?? ''
        const vLang = v.language?.toLowerCase() ?? ''
        const matchAccent = mapping.accents.some(a => vAccent.includes(a) || a.includes(vAccent) && vAccent.length >= 2)
        const matchLang = vLang.includes(mapping.language) || mapping.language.includes(vLang) && vLang.length >= 2
        if (!matchAccent && !matchLang) return false
      }
    }
    if (useCase !== 'All' && v.useCase?.toLowerCase() !== useCase.toLowerCase()) return false
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
      title="Choose a voice"
      size="xl"
    >
      <div className="space-y-4">

        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-xl p-1">
          {([['library', 'Public library'], ['cloned', 'My cloned voices']] as const).map(([key, label]) => (
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
                <span className="ml-1.5 text-[11px] text-blue-400">({clonedVoices.length})</span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--text-muted]" />
          <label htmlFor="voice-picker-search" className="sr-only">Rechercher une voix</label>
          <input
            id="voice-picker-search"
            name="voice-search"
            type="search"
            autoComplete="off"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search for a voice…"
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
            <div className="py-8 text-center">
              {tab === 'cloned' && onRequestClone ? (
                <>
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-3" aria-hidden="true">
                    <Mic2 size={16} className="text-blue-400" />
                  </div>
                  <p className="font-body text-sm text-foreground mb-1">No cloned voices yet</p>
                  <p className="font-mono text-xs text-[--text-muted] mb-4">
                    Upload a 30 s audio sample to create your own AI voice.
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Plus size={13} />}
                    onClick={onRequestClone}
                  >
                    Clone a voice
                  </Button>
                </>
              ) : (
                <p className="font-mono text-sm text-[--text-muted]">No voices found</p>
              )}
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
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!localSel} onClick={handleConfirm}>
            Confirm
          </Button>
        </div>

      </div>
    </Modal>
  )
}
