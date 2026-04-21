import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion'
import type { SceneStatsCounterProps } from '../lib/motion-types'

export const SceneStatsCounter: React.FC<SceneStatsCounterProps> = ({
  stats, headline, mode,
}) => {
  const frame   = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const isDark  = mode === 'dark'
  const countEnd = durationInFrames * 0.8

  const headlineOpacity = interpolate(frame, [20, 36], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill
      style={{
        background: isDark
          ? 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)'
          : 'linear-gradient(135deg, #f8f9ff 0%, #ffffff 100%)',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            48,
        padding:        '0 80px',
      }}
    >
      {headline && (
        <h2 style={{
          fontSize:   52,
          fontWeight: 800,
          color:      isDark ? '#ffffff' : '#1a1a1a',
          margin:     0,
          textAlign:  'center',
          opacity:    headlineOpacity,
        }}>
          {headline}
        </h2>
      )}

      <div style={{ display: 'flex', gap: 80, flexWrap: 'wrap', justifyContent: 'center' }}>
        {stats.map((stat, i) => {
          const delay   = i * 8
          const prog    = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 120, stiffness: 60 } })
          const current = interpolate(frame, [delay, countEnd], [0, stat.value], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          })
          const displayNum = Number.isInteger(stat.value)
            ? Math.round(current).toLocaleString('fr-FR')
            : current.toFixed(1)

          return (
            <div
              key={i}
              style={{
                textAlign:  'center',
                opacity:    prog,
                transform:  `scale(${0.6 + prog * 0.4})`,
              }}
            >
              <div style={{
                display:    'flex',
                alignItems: 'baseline',
                gap:        4,
                justifyContent: 'center',
              }}>
                <span style={{
                  fontSize:   96,
                  fontWeight: 900,
                  color:      stat.color,
                  lineHeight: 1,
                  letterSpacing: '-0.03em',
                  textShadow: `0 0 40px ${stat.color}44`,
                }}>
                  {displayNum}
                </span>
                <span style={{ fontSize: 48, fontWeight: 700, color: stat.color }}>
                  {stat.unit}
                </span>
              </div>
              <p style={{
                margin:         '8px 0 0',
                fontSize:       20,
                fontWeight:     500,
                color:          isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)',
                textTransform:  'uppercase',
                letterSpacing:  '0.05em',
              }}>
                {stat.label}
              </p>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}
