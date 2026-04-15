'use client'

import { Loader2, AlertCircle, Play, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  type StudioScene, SCENE_TYPE_LABELS, SCENE_TYPE_COLORS,
} from '@/lib/studio-types'

interface PreviewPlayerProps {
  scene: StudioScene | null
  format: '16_9' | '9_16' | 'both'
  onRetry?: (sceneId: string) => void
}

export function PreviewPlayer({ scene, format, onRetry }: PreviewPlayerProps) {
  const aspect = format === '9_16' ? 'aspect-[9/16] max-h-full' : 'aspect-video max-w-full'

  if (!scene) {
    return (
      <div className="flex-1 bg-background flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-muted border border-border mx-auto flex items-center justify-center">
            <Play size={20} className="text-[--text-muted] opacity-60" />
          </div>
          <p className="font-body text-sm text-[--text-secondary]">
            Select a scene from the timeline to preview it
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-background p-6 flex flex-col items-center justify-center gap-3 min-h-0 overflow-hidden">
      <div className="relative w-full h-full flex items-center justify-center">
        <div className={`${aspect} relative bg-black rounded-xl overflow-hidden border border-border shadow-2xl w-auto`}
             style={format === '9_16' ? { height: '100%' } : { width: '100%', maxWidth: '900px' }}>

          {/* Video */}
          {scene.video_url && scene.status === 'done' && (
            <video
              src={scene.video_url}
              controls
              className="w-full h-full object-contain bg-black"
            />
          )}

          {/* Loading overlay */}
          {(scene.status === 'generating' || scene.status === 'regenerating' || scene.status === 'pending') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black">
              {scene.thumbnail_url && (
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-30 blur-sm"
                  style={{ backgroundImage: `url(${scene.thumbnail_url})` }}
                />
              )}
              <Loader2 size={32} className="relative text-blue-400 animate-spin" />
              <p className="relative font-body text-sm text-white/80">
                {scene.status === 'pending' ? 'Waiting to generate…' : 'Generating…'}
              </p>
            </div>
          )}

          {/* Error overlay */}
          {scene.status === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 p-6">
              <AlertCircle size={32} className="text-red-400" />
              <p className="font-display text-sm text-white text-center">Generation failed</p>
              {scene.error_message && (
                <p className="font-mono text-[11px] text-white/60 text-center max-w-sm line-clamp-3">
                  {scene.error_message}
                </p>
              )}
              {onRetry && (
                <button
                  type="button"
                  onClick={() => onRetry(scene.id)}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 border border-white/20 px-4 py-2 text-sm font-body text-white hover:bg-white/20 transition-colors"
                >
                  <RefreshCw size={13} /> Retry
                </button>
              )}
            </div>
          )}

          {/* Scene type badge */}
          <div className="absolute top-3 right-3">
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-white shadow"
              style={{ backgroundColor: SCENE_TYPE_COLORS[scene.type] }}
            >
              {SCENE_TYPE_LABELS[scene.type]}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom info strip */}
      <div className="flex items-center gap-3 text-[11px] font-mono text-[--text-muted]">
        <span>Scene {scene.index + 1}</span>
        <span>·</span>
        <span>{scene.duration_actual ?? scene.duration_est ?? 10}s</span>
        {scene.status === 'done' && <><span>·</span><Badge variant="success">Ready</Badge></>}
      </div>
    </div>
  )
}
