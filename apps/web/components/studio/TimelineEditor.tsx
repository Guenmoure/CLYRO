'use client'

import { Plus } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'
import { SceneBlock } from './SceneBlock'
import type { StudioScene } from '@/lib/studio-types'

interface TimelineEditorProps {
  scenes: StudioScene[]
  selectedSceneId: string | null
  onSelectScene: (id: string) => void
  onRegenerateScene?: (id: string) => void
  onAddScene?: (afterIndex: number) => void
  projectDuration: number   // total seconds
  musicTrackName?: string
}

export function TimelineEditor({
  scenes, selectedSceneId, onSelectScene, onRegenerateScene, onAddScene,
  projectDuration, musicTrackName,
}: TimelineEditorProps) {
  const { t } = useLanguage()
  const SCALE = 8  // pixels per second

  return (
    <div className="h-[180px] shrink-0 bg-card border-t border-border overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/60">
        <div className="flex items-center gap-3">
          <p className="font-mono text-xs text-[--text-muted] uppercase tracking-wider font-semibold">{t('te_timeline')}</p>
          <span className="font-mono text-xs text-[--text-secondary]">
            {formatDuration(projectDuration)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onAddScene?.(scenes.length - 1)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted hover:bg-border px-3 py-1 text-xs font-body text-foreground transition-colors"
        >
          <Plus size={12} /> {t('te_addScene')}
        </button>
      </div>

      {/* Scrollable track area */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="min-w-fit h-full">
          {/* Video track */}
          <Track label={t('te_video')}>
            {scenes.map((scene, i) => (
              <div key={scene.id} className="flex items-center gap-1">
                <SceneBlock
                  scene={scene}
                  selected={selectedSceneId === scene.id}
                  onClick={() => onSelectScene(scene.id)}
                  onRegenerate={onRegenerateScene ? () => onRegenerateScene(scene.id) : undefined}
                  scale={SCALE}
                />
                {/* Insert point between scenes */}
                {onAddScene && i < scenes.length - 1 && (
                  <button
                    type="button"
                    aria-label={t('te_addSceneHere')}
                    onClick={() => onAddScene(scene.index)}
                    className="opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity w-5 h-5 rounded-full bg-muted border border-border hover:border-brand hover:text-brand flex items-center justify-center text-[--text-muted]"
                  >
                    <Plus size={10} />
                  </button>
                )}
              </div>
            ))}
          </Track>

          {/* Audio track */}
          <Track label={t('te_audio')}>
            {scenes.map((scene) => {
              const duration = scene.duration_actual ?? scene.duration_est ?? 10
              const width = Math.max(64, duration * SCALE)
              const hasAudio = scene.audio_url || scene.video_url
              return (
                <div
                  key={scene.id}
                  className={`h-6 rounded-md border border-border shrink-0 flex items-center px-2 ${
                    hasAudio ? 'bg-emerald-500/20' : 'bg-muted'
                  }`}
                  style={{ width: `${width}px` }}
                >
                  <span className="font-mono text-[9px] text-[--text-secondary] truncate">
                    {hasAudio ? 'VO' : '—'}
                  </span>
                </div>
              )
            })}
          </Track>

          {/* Music track */}
          <Track label={t('te_music')}>
            <div
              className="h-6 rounded-md border border-border shrink-0 bg-brand/15 flex items-center px-3"
              style={{ width: `${Math.max(400, projectDuration * SCALE)}px` }}
            >
              <span className="font-mono text-[10px] text-[--text-secondary] truncate">
                {musicTrackName ?? t('te_noMusicTrack')}
              </span>
            </div>
          </Track>
        </div>
      </div>
    </div>
  )
}

// ── Track wrapper ───────────────────────────────────────────────────────

function Track({ label, children }: { label: string; children: React.ReactNode }) {
  const { t } = useLanguage()
  return (
    <div className="flex items-center gap-3 px-4 py-1.5 border-b border-border/30 last:border-b-0">
      <span
        className="font-mono text-[10px] uppercase tracking-widest text-[--text-muted] shrink-0 w-14"
        aria-label={t('te_trackAria').replace('{label}', label)}
      >
        {label}
      </span>
      <div className="flex items-end gap-1 flex-1">
        {children}
      </div>
    </div>
  )
}

// ── Utils ───────────────────────────────────────────────────────────────

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
