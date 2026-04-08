'use client'

/**
 * BrandPreview — live Remotion Player preview for BrandOverlay composition.
 *
 * Uses @remotion/player to render an animated preview directly in the browser,
 * without a server-side render. Lazy-loaded (no SSR) to avoid hydration issues.
 *
 * Usage:
 *   import dynamic from 'next/dynamic'
 *   const BrandPreview = dynamic(() => import('@/components/video/brand-preview'), { ssr: false })
 *
 *   <BrandPreview scenes={scenes} brandConfig={brandConfig} format="9:16" />
 */

import { useMemo } from 'react'
import { Player } from '@remotion/player'
import { BrandOverlay } from '@clyro/video'
import type { BrandScene, BrandConfig } from '@clyro/video'
import type { ComponentType } from 'react'

// @remotion/player requires any-typed component
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BrandOverlayAny = BrandOverlay as ComponentType<any>

const FPS = 30

// ── Dimension helpers ──────────────────────────────────────────────────────────

const FORMAT_DIMS: Record<string, { width: number; height: number }> = {
  '9:16': { width: 1080, height: 1920 },
  '1:1':  { width: 1080, height: 1080 },
  '16:9': { width: 1920, height: 1080 },
}

// ── Props ──────────────────────────────────────────────────────────────────────

export interface BrandPreviewProps {
  scenes: BrandScene[]
  brandConfig: BrandConfig
  format?: '9:16' | '1:1' | '16:9'
  /** Preview container height in px (default: 420) */
  height?: number
  className?: string
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function BrandPreview({
  scenes,
  brandConfig,
  format = '9:16',
  height = 420,
  className,
}: BrandPreviewProps) {
  const { width: compWidth, height: compHeight } = FORMAT_DIMS[format] ?? FORMAT_DIMS['9:16']

  // Total duration in frames — sum of all scene durations
  const durationInFrames = useMemo(
    () => Math.max(FPS, scenes.reduce((sum, s) => sum + Math.max(1, Math.round(s.duree_estimee * FPS)), 0)),
    [scenes]
  )

  // Scale the preview to fit within the container height while keeping aspect ratio
  const aspectRatio = compWidth / compHeight
  const previewHeight = height
  const previewWidth = Math.round(previewHeight * aspectRatio)

  const inputProps = useMemo(
    () => ({ scenes, brandConfig, format }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(scenes), JSON.stringify(brandConfig), format]
  )

  if (!scenes.length) return null

  return (
    <div
      className={className}
      style={{ width: previewWidth, height: previewHeight, borderRadius: 12, overflow: 'hidden' }}
    >
      <Player
        component={BrandOverlayAny}
        compositionWidth={compWidth}
        compositionHeight={compHeight}
        durationInFrames={durationInFrames}
        fps={FPS}
        inputProps={inputProps}
        style={{ width: '100%', height: '100%' }}
        controls
        loop
        autoPlay
        clickToPlay={false}
        showVolumeControls={false}
      />
    </div>
  )
}
