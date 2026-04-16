import React from 'react'
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'

export interface KenBurnsClipProps {
  imageUrl: string
  zoomFrom?: number    // scale at frame 0 — default 1.0 (100%)
  zoomTo?: number      // scale at last frame — default 1.15 (15% zoom-in)
  panXFrom?: number    // translateX % at frame 0
  panXTo?: number      // translateX % at last frame
  panYFrom?: number    // translateY % at frame 0
  panYTo?: number      // translateY % at last frame
}

/**
 * Ken Burns effect: smooth zoom + pan on a static image.
 * Costs $0 GPU — pure Remotion/CSS interpolation.
 * Drop-in replacement for Kling i2v clips on illustration/whiteboard styles.
 */
export const KenBurnsClip: React.FC<KenBurnsClipProps> = ({
  imageUrl,
  zoomFrom = 1.0,
  zoomTo   = 1.15,
  panXFrom = 0,
  panXTo   = -3,
  panYFrom = 0,
  panYTo   = -2,
}) => {
  const frame            = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const progress = frame / Math.max(1, durationInFrames - 1)

  const scale      = interpolate(progress, [0, 1], [zoomFrom, zoomTo])
  const translateX = interpolate(progress, [0, 1], [panXFrom, panXTo])
  const translateY = interpolate(progress, [0, 1], [panYFrom, panYTo])

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
      <Img
        src={imageUrl}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale}) translateX(${translateX}%) translateY(${translateY}%)`,
          transformOrigin: 'center center',
          willChange: 'transform',
        }}
      />
    </AbsoluteFill>
  )
}
