'use client'

import { Play, Square, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { ClyroVoice } from '@/lib/api'

// ── Waveform bars ──────────────────────────────────────────────────────────────

function WaveformAnimated() {
  return (
    <div className="flex items-center gap-0.5 h-6 px-0.5">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="w-0.5 bg-blue-400 rounded-full animate-waveform"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </div>
  )
}

// ── VoiceCard ──────────────────────────────────────────────────────────────────

interface VoiceCardProps {
  voice:   ClyroVoice
  playing: boolean
  onPlay:  (id: string | null) => void
  onClick: () => void
  onUse?:  (voice: ClyroVoice) => void
}

export function VoiceCard({ voice, playing, onPlay, onClick, onUse }: VoiceCardProps) {
  function togglePlay(e: React.MouseEvent) {
    e.stopPropagation()
    onPlay(playing ? null : voice.id)
  }

  const initials = voice.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <div
      className={cn(
        'flex items-center gap-4 p-4 rounded-xl border cursor-pointer',
        'transition-all duration-150 group',
        playing
          ? 'border-blue-500/50 bg-blue-500/8'
          : 'border-border bg-card hover:border-border hover:bg-muted/40',
      )}
      onClick={onClick}
    >
      {/* Avatar circle */}
      <div className="relative w-12 h-12 rounded-full overflow-hidden shrink-0 bg-muted">
        {playing ? (
          <div className="w-full h-full bg-blue-500/20 flex items-center justify-center">
            <WaveformAnimated />
          </div>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center">
            <span className="font-display text-sm font-bold text-foreground">
              {initials}
            </span>
          </div>
        )}

        {/* Verified badge */}
        {voice.isFavorite && (
          <div className="absolute -bottom-0.5 -right-0.5 bg-blue-500 rounded-full w-4 h-4 flex items-center justify-center">
            <Check size={8} className="text-white" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-display text-sm text-foreground truncate">
          {voice.name}
        </p>
        <p className="font-body text-xs text-[--text-secondary] mt-0.5 truncate">
          {voice.category} · {voice.useCase}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {voice.languageFlag && (
            <span className="text-xs">{voice.languageFlag}</span>
          )}
          {voice.language && (
            <span className="font-mono text-xs text-[--text-muted]">{voice.language}</span>
          )}
          {voice.accent && voice.accent !== voice.language && (
            <span className="font-mono text-xs text-[--text-muted]">· {voice.accent}</span>
          )}
        </div>
      </div>

      {/* Play button */}
      <button
        type="button"
        className={cn(
          'w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-150',
          playing
            ? 'bg-blue-500 text-white shadow-glow-blue'
            : 'bg-muted text-[--text-secondary] hover:bg-border',
        )}
        onClick={togglePlay}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? <Square size={11} /> : <Play size={11} />}
      </button>

      {/* Use button (hover) */}
      {onUse && (
        <Button
          variant="secondary"
          size="sm"
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); onUse(voice) }}
        >
          Utiliser
        </Button>
      )}
    </div>
  )
}
