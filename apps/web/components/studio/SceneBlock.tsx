'use client'

import { Loader2, AlertCircle, RefreshCw, MoreVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  type StudioScene, SCENE_TYPE_COLORS, SCENE_TYPE_LABELS,
} from '@/lib/studio-types'

interface SceneBlockProps {
  scene: StudioScene
  selected: boolean
  onClick: () => void
  onRegenerate?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  /** Pixel-per-second ratio for the timeline (default 8) */
  scale?: number
}

export function SceneBlock({
  scene, selected, onClick, onRegenerate, onContextMenu, scale = 8,
}: SceneBlockProps) {
  const duration = scene.duration_actual ?? scene.duration_est ?? 10
  const width = Math.max(64, duration * scale)
  const bg = SCENE_TYPE_COLORS[scene.type]

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative rounded-lg flex flex-col justify-between',
        'border border-white/10 cursor-pointer select-none',
        'transition-all duration-150 shrink-0 group text-left',
        selected && 'ring-2 ring-blue-500 ring-offset-2 ring-offset-card',
      )}
      style={{ width: `${width}px`, height: '80px', background: bg, minWidth: '64px' }}
      aria-pressed={selected}
      aria-label={`Scene ${scene.index + 1} — ${SCENE_TYPE_LABELS[scene.type]}`}
    >
      {/* Thumbnail as background */}
      {scene.thumbnail_url && (
        <div
          className="absolute inset-0 rounded-lg overflow-hidden opacity-30 bg-cover bg-center"
          style={{ backgroundImage: `url(${scene.thumbnail_url})` }}
        />
      )}

      {/* Status overlay */}
      {(scene.status === 'generating' || scene.status === 'regenerating') && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
          <Loader2 size={14} className="text-white animate-spin" />
        </div>
      )}
      {scene.status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900/50 rounded-lg">
          <AlertCircle size={14} className="text-red-300" />
        </div>
      )}

      {/* Header row */}
      <div className="relative px-2 pt-1.5 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-white/85">
          {SCENE_TYPE_LABELS[scene.type]}
        </span>
        <span className="font-mono text-[10px] text-white/55">{duration}s</span>
      </div>

      {/* Script preview */}
      <p className="relative px-2 pb-1.5 text-[11px] text-white/75 line-clamp-2 leading-tight font-body">
        {scene.script.slice(0, 80)}{scene.script.length > 80 ? '…' : ''}
      </p>

      {/* Hover actions */}
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        {onRegenerate && (
          <button
            type="button"
            aria-label="Regenerate scene"
            className="bg-black/60 rounded p-1 hover:bg-black/80"
            onClick={(e) => { e.stopPropagation(); onRegenerate() }}
          >
            <RefreshCw size={10} className="text-white" />
          </button>
        )}
        {onContextMenu && (
          <button
            type="button"
            aria-label="More actions"
            className="bg-black/60 rounded p-1 hover:bg-black/80"
            onClick={(e) => { e.stopPropagation(); onContextMenu(e) }}
          >
            <MoreVertical size={10} className="text-white" />
          </button>
        )}
      </div>
    </button>
  )
}
