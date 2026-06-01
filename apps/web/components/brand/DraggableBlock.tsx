'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '@/lib/utils'
import type { BlockPosition } from '@clyro/shared'

interface DraggableBlockProps {
  /** Position du centre du bloc en pourcent du container (0..100). */
  position:    BlockPosition
  /** Container parent (le preview de la créative). */
  containerRef: React.RefObject<HTMLDivElement | null>
  /** Appelée pendant le drag (live, pas debouncé). */
  onMove:      (next: BlockPosition) => void
  /** Appelée quand le pointer est relâché — c'est là que le parent fait le
   *  save debouncé en base. */
  onCommit?:   (next: BlockPosition) => void
  /** Désactive le drag (mode read-only / preview gallery). */
  disabled?:   boolean
  className?:  string
  children:    React.ReactNode
}

/**
 * Bloc draggable pixel-precise. Centré sur position.x / position.y,
 * exprimé en % du container. Au début du drag, on capture la
 * différence entre la position du pointer et le centre du bloc pour
 * éviter le saut.
 */
export function DraggableBlock({
  position, containerRef, onMove, onCommit, disabled, className, children,
}: DraggableBlockProps) {
  const blockRef = useRef<HTMLDivElement | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragStateRef = useRef<{ offsetX: number; offsetY: number; pointerId: number } | null>(null)
  const [livePos, setLivePos] = useState<BlockPosition>(position)

  // Sync external position changes (e.g. version restore, autosave reply)
  useEffect(() => {
    if (!dragging) setLivePos(position)
  }, [position, dragging])

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (disabled) return
    const container = containerRef.current
    if (!container) return
    e.preventDefault()
    e.stopPropagation()

    const rect = container.getBoundingClientRect()
    // Position actuelle du centre du bloc en pixels
    const centerX = (livePos.x / 100) * rect.width
    const centerY = (livePos.y / 100) * rect.height
    // Différence avec la position du pointer → offset à conserver pendant le drag
    const pointerX = e.clientX - rect.left
    const pointerY = e.clientY - rect.top
    dragStateRef.current = {
      offsetX: pointerX - centerX,
      offsetY: pointerY - centerY,
      pointerId: e.pointerId,
    }
    setDragging(true)
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId) } catch { /* unsupported */ }
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return
    const state = dragStateRef.current
    if (!state || state.pointerId !== e.pointerId) return
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const px = e.clientX - rect.left - state.offsetX
    const py = e.clientY - rect.top  - state.offsetY
    const x = Math.max(0, Math.min(100, (px / rect.width)  * 100))
    const y = Math.max(0, Math.min(100, (py / rect.height) * 100))
    const next = { x, y }
    setLivePos(next)
    onMove(next)
  }

  function endDrag(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return
    setDragging(false)
    const final = livePos
    dragStateRef.current = null
    try { (e.currentTarget as Element).releasePointerCapture(e.pointerId) } catch { /* unsupported */ }
    if (onCommit) onCommit(final)
  }

  return (
    <div
      ref={blockRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{
        position:  'absolute',
        left:      `${livePos.x}%`,
        top:       `${livePos.y}%`,
        transform: 'translate(-50%, -50%)',
        // Largeur max raisonnable pour les blocs (taille du conteneur - marge)
        maxWidth:  '92%',
        touchAction: 'none',
      }}
      className={cn(
        'select-none',
        !disabled && (dragging ? 'cursor-grabbing' : 'cursor-grab'),
        className,
      )}
    >
      {children}
    </div>
  )
}
