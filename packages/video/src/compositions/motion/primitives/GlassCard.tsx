import React from 'react'
import { spring, useCurrentFrame, useVideoConfig, interpolate } from 'remotion'

interface GlassCardProps {
  children:    React.ReactNode
  index:       number
  rotateX?:    number
  rotateY?:    number
  rotateZ?:    number
  translateZ?: number
  x:           number
  y:           number
  width:       number
  height:      number
  mode:        'dark' | 'light'
  delay?:      number  // frames
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children, index, rotateX = -5, rotateY = 8, rotateZ = -2,
  translateZ = 0, x, y, width, height, mode, delay = 0,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const isDark = mode === 'dark'

  const entryDelay = delay + index * 6
  const progress = spring({
    frame: Math.max(0, frame - entryDelay),
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
  })

  const floatY  = Math.sin((frame + index * 30) * 0.025) * 6
  const floatRot = Math.sin((frame + index * 20) * 0.02) * 1.5

  const opacity = interpolate(progress, [0, 1], [0, 1])
  const scale   = 0.7 + progress * 0.3

  return (
    <div
      style={{
        position:    'absolute',
        left:        x,
        top:         y + floatY,
        width,
        height,
        perspective: '1200px',
        opacity,
        transform:   `scale(${scale}) translateZ(${translateZ * progress}px)`,
      }}
    >
      <div
        style={{
          width:              '100%',
          height:             '100%',
          borderRadius:       20,
          transform: `
            rotateX(${(rotateX + floatRot) * progress}deg)
            rotateY(${rotateY * progress}deg)
            rotateZ(${rotateZ + floatRot * 0.5}deg)
          `,
          background:         isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.85)',
          backdropFilter:     'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border:             isDark
            ? '1px solid rgba(255,255,255,0.1)'
            : '1px solid rgba(0,0,0,0.08)',
          boxShadow:          isDark
            ? '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05) inset'
            : '0 8px 32px rgba(0,0,0,0.08), 0 0 0 1px rgba(255,255,255,0.5) inset',
          padding:            24,
          overflow:           'hidden',
          boxSizing:          'border-box',
        }}
      >
        {children}
      </div>
    </div>
  )
}
