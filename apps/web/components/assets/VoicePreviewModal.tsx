'use client'

import { useRef, useState } from 'react'
import { Play, Square, Bookmark } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ClyroVoice } from '@/lib/api'

// ── Waveform bars ──────────────────────────────────────────────────────────────

function WaveformAnimated() {
  return (
    <div className="flex items-end gap-0.5 h-8">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div
          key={i}
          className="w-1 bg-blue-400 rounded-full animate-waveform"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  )
}

// ── VoicePreviewModal ──────────────────────────────────────────────────────────

interface VoicePreviewModalProps {
  voice:   ClyroVoice | null
  isOpen:  boolean
  onClose: () => void
  onUse?:  (voice: ClyroVoice) => void
}

export function VoicePreviewModal({ voice, isOpen, onClose, onUse }: VoicePreviewModalProps) {
  const audioRef    = useRef<HTMLAudioElement | null>(null)
  const [playing,   setPlaying]   = useState(false)
  const [progress,  setProgress]  = useState(0)

  function togglePlay() {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play()
      setPlaying(true)
    }
  }

  function handleTimeUpdate() {
    if (!audioRef.current) return
    const { currentTime, duration } = audioRef.current
    if (duration) setProgress((currentTime / duration) * 100)
  }

  function handleEnded() {
    setPlaying(false)
    setProgress(0)
  }

  if (!voice) return null

  const initials = voice.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" title={voice.name}>
      <div className="space-y-6">

        {/* Header row */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center shrink-0">
            <span className="font-display text-xl font-bold text-foreground">{initials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-2 mt-1">
              <Badge variant="neutral">{voice.category}</Badge>
              {voice.gender && <Badge variant="info">{voice.gender}</Badge>}
              {voice.languageFlag && (
                <Badge variant="neutral">
                  <span className="mr-1">{voice.languageFlag}</span>
                  {voice.language}
                </Badge>
              )}
            </div>
            <p className="font-body text-sm text-[--text-secondary] mt-1.5 line-clamp-2">
              {voice.description}
            </p>
          </div>
        </div>

        {/* Audio preview player */}
        {voice.previewUrl ? (
          <div className="bg-muted rounded-2xl border border-border p-4">
            <audio
              ref={audioRef}
              src={voice.previewUrl}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleEnded}
              preload="metadata"
            />

            <div className="flex items-center gap-4">
              {/* Play/Pause button */}
              <button
                type="button"
                onClick={togglePlay}
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all',
                  playing
                    ? 'bg-blue-500 text-white shadow-glow-blue'
                    : 'bg-border text-foreground hover:bg-muted',
                )}
              >
                {playing ? <Square size={13} /> : <Play size={13} />}
              </button>

              {/* Waveform or progress bar */}
              <div className="flex-1">
                {playing ? (
                  <WaveformAnimated />
                ) : (
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-100"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-muted rounded-2xl border border-border p-4 text-center">
            <p className="font-body text-sm text-[--text-muted]">Aucun aperçu audio disponible</p>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Catégorie',  value: voice.category  },
            { label: 'Langue',     value: voice.language ?? '—'  },
            { label: 'Style',      value: voice.useCase   },
          ].map(({ label, value }) => (
            <div key={label} className="bg-muted rounded-xl p-3 text-center">
              <p className="font-mono text-[10px] text-[--text-muted] uppercase tracking-widest">{label}</p>
              <p className="font-body text-sm text-foreground mt-1 truncate">{value}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => { onUse?.(voice); onClose() }}
          >
            Utiliser cette voix
          </Button>
          <Button
            variant="ghost"
            size="sm"
            fullWidth
            leftIcon={<Bookmark size={13} />}
          >
            Ajouter aux favoris
          </Button>
        </div>
      </div>
    </Modal>
  )
}
