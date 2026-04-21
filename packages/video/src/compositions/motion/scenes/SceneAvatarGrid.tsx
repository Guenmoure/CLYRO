import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion'
import type { SceneAvatarGridProps } from '../lib/motion-types'

export const SceneAvatarGrid: React.FC<SceneAvatarGridProps> = ({
  avatars, headline, mode, zoomIndex,
}) => {
  const frame   = useCurrentFrame()
  const { fps } = useVideoConfig()
  const isDark  = mode === 'dark'

  const cols    = Math.min(4, avatars.length)
  const rows    = Math.ceil(avatars.length / cols)
  const cellW   = 220
  const cellH   = 240
  const startX  = (1920 - cols * cellW) / 2
  const startY  = (1080 - rows * cellH) / 2 - 60

  const headlineOpacity = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill
      style={{
        background: isDark
          ? 'linear-gradient(160deg, #0a0a0a 0%, #111827 100%)'
          : 'linear-gradient(160deg, #f8f8f8 0%, #ffffff 100%)',
      }}
    >
      {avatars.map((av, i) => {
        const col    = i % cols
        const row    = Math.floor(i / cols)
        const x      = startX + col * cellW
        const y      = startY + row * cellH
        const delay  = i * 4
        const prog   = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 12, stiffness: 120 } })
        const floatY = Math.sin((frame + i * 20) * 0.025) * 4
        const isZoom = zoomIndex === i

        const scale = isZoom
          ? 1 + interpolate(frame, [40, 70], [0, 0.25], { extrapolateRight: 'clamp' })
          : 1

        return (
          <div
            key={i}
            style={{
              position:    'absolute',
              left:        x + 10,
              top:         y + floatY,
              width:       200,
              height:      200,
              opacity:     prog,
              transform:   `scale(${(0.7 + prog * 0.3) * scale})`,
              transformOrigin: 'center center',
              zIndex:      isZoom ? 10 : 1,
            }}
          >
            <div style={{
              width:        '100%',
              height:       160,
              borderRadius: 20,
              overflow:     'hidden',
              boxShadow:    isDark
                ? '0 8px 32px rgba(0,0,0,0.5)'
                : '0 4px 24px rgba(0,0,0,0.1)',
              border:       isZoom
                ? '3px solid #667EEA'
                : `2px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
            }}>
              <img
                src={av.url}
                alt={av.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <p style={{
              margin:     '8px 0 0',
              textAlign:  'center',
              fontSize:   14,
              fontWeight: 600,
              color:      isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
            }}>
              {av.name}
            </p>
          </div>
        )
      })}

      {/* Headline below grid */}
      <div style={{
        position:  'absolute',
        bottom:    80,
        left:      0,
        right:     0,
        textAlign: 'center',
        opacity:   headlineOpacity,
      }}>
        <h2 style={{
          fontSize:   52,
          fontWeight: 800,
          color:      isDark ? '#ffffff' : '#1a1a1a',
          margin:     0,
        }}>
          {headline}
        </h2>
      </div>
    </AbsoluteFill>
  )
}
