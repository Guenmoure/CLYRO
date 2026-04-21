import React from 'react'
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion'

interface CursorKeyframe {
  x:      number
  y:      number
  frame:  number
  click?: boolean
}

interface AnimatedCursorProps {
  path:   CursorKeyframe[]
  color?: string
}

export const AnimatedCursor: React.FC<AnimatedCursorProps> = ({
  path, color = '#ffffff',
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  if (path.length < 2) return null

  const frames = path.map((p) => p.frame)
  const xs     = path.map((p) => p.x)
  const ys     = path.map((p) => p.y)

  const x = interpolate(frame, frames, xs, {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  })
  const y = interpolate(frame, frames, ys, {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  })

  const currentClick = path.find((p) => p.click && Math.abs(frame - p.frame) < 8)

  const clickScale = currentClick
    ? 1 - spring({ frame: frame - currentClick.frame, fps, config: { damping: 8, stiffness: 200 } }) * 0.15
    : 1

  const rippleOpacity = currentClick
    ? interpolate(frame - currentClick.frame, [0, 15], [0.5, 0], { extrapolateRight: 'clamp' })
    : 0
  const rippleSize = currentClick
    ? interpolate(frame - currentClick.frame, [0, 15], [0, 40], { extrapolateRight: 'clamp' })
    : 0

  if (frame < frames[0]) return null

  return (
    <>
      {rippleOpacity > 0 && (
        <div style={{
          position:     'absolute',
          left:         x - rippleSize / 2,
          top:          y - rippleSize / 2,
          width:        rippleSize,
          height:       rippleSize,
          borderRadius: '50%',
          border:       `2px solid ${color}`,
          opacity:      rippleOpacity,
          pointerEvents: 'none',
        }} />
      )}
      <svg
        width={24}
        height={24}
        viewBox="0 0 24 24"
        style={{
          position:    'absolute',
          left:        x,
          top:         y,
          transform:   `scale(${clickScale})`,
          filter:      'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
          pointerEvents: 'none',
          zIndex:      9999,
        }}
      >
        <path
          d="M2 2 L2 18 L6 14 L10 22 L14 20 L10 12 L18 12 Z"
          fill={color}
          stroke={color === '#ffffff' ? '#000000' : '#ffffff'}
          strokeWidth={1}
        />
      </svg>
    </>
  )
}
