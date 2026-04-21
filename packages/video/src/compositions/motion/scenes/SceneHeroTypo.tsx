import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion'
import type { SceneHeroTypoProps } from '../lib/motion-types'

export const SceneHeroTypo: React.FC<SceneHeroTypoProps> = ({
  text, subtext, mode, color, fontSize = 120, animation,
}) => {
  const frame    = useCurrentFrame()
  const { fps }  = useVideoConfig()
  const isDark   = mode === 'dark'
  const words    = text.split(' ')

  const subtextOpacity = interpolate(frame, [40, 55], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill
      style={{
        background: isDark
          ? '#0a0a0a'
          : 'radial-gradient(ellipse at 20% 20%, #ffe0e8 0%, #ffffff 50%)',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         '0 80px',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: '90%' }}>

        {/* word_by_word */}
        {(animation === 'word_by_word' || animation === 'split_reveal') && (
          <p style={{ margin: 0, lineHeight: 1.1 }}>
            {words.map((word, i) => {
              const delay    = i * 5
              const progress = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 12, stiffness: 150 } })
              return (
                <span
                  key={i}
                  style={{
                    display:     'inline-block',
                    fontSize,
                    fontWeight:  900,
                    color,
                    opacity:     progress,
                    transform:   `scale(${0.6 + progress * 0.4}) translateY(${(1 - progress) * 30}px)`,
                    marginRight: '0.25em',
                  }}
                >
                  {word}
                </span>
              )
            })}
          </p>
        )}

        {/* scale_bounce — full text at once */}
        {animation === 'scale_bounce' && (
          <p style={{
            margin:     0,
            fontSize,
            fontWeight: 900,
            color,
            lineHeight: 1.1,
            transform:  `scale(${spring({ frame, fps, config: { damping: 8, stiffness: 100 } })})`,
          }}>
            {text}
          </p>
        )}

        {/* 3d_rotate — rotates in on X axis */}
        {animation === '3d_rotate' && (
          <p style={{
            margin:      0,
            fontSize,
            fontWeight:  900,
            color,
            lineHeight:  1.1,
            perspective: '800px',
            transform:   `rotateX(${interpolate(frame, [0, 20], [90, 0], { extrapolateRight: 'clamp' })}deg)`,
            opacity:     interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' }),
          }}>
            {text}
          </p>
        )}

        {/* line_by_line — fallback: same as word_by_word per line */}
        {animation === 'line_by_line' && (
          <p style={{ margin: 0, lineHeight: 1.1 }}>
            {words.map((word, i) => {
              const delay    = i * 8
              const progress = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 14, stiffness: 100 } })
              return (
                <span
                  key={i}
                  style={{
                    display:      'inline-block',
                    fontSize,
                    fontWeight:   900,
                    color,
                    opacity:      progress,
                    transform:    `translateX(${(1 - progress) * -40}px)`,
                    marginRight:  '0.25em',
                  }}
                >
                  {word}
                </span>
              )
            })}
          </p>
        )}

        {subtext && (
          <p style={{
            fontSize:   Math.round(fontSize * 0.28),
            fontWeight: 500,
            color:      isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
            marginTop:  24,
            opacity:    subtextOpacity,
          }}>
            {subtext}
          </p>
        )}
      </div>
    </AbsoluteFill>
  )
}
