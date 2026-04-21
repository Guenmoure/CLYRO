import React from 'react'
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion'
import { GlassCard } from '../primitives/GlassCard'
import { Particles } from '../primitives/Particles'
import { PerspectiveGrid } from '../primitives/PerspectiveGrid'
import type { Scene3DCardsProps } from '../lib/motion-types'

const CARD_POSITIONS = [
  { x: 80,   y: 120, rX: -8,  rY: 12,  rZ: -3, tZ: -100 },
  { x: 450,  y: 60,  rX: -5,  rY: -8,  rZ:  2, tZ: -50  },
  { x: 820,  y: 140, rX: -6,  rY: 10,  rZ: -1, tZ: -80  },
  { x: 1200, y: 80,  rX: -4,  rY: -12, rZ:  3, tZ: -120 },
  { x: 200,  y: 500, rX: -7,  rY:  6,  rZ: -2, tZ: -60  },
  { x: 900,  y: 480, rX: -5,  rY: -10, rZ:  1, tZ: -90  },
]

interface Props extends Scene3DCardsProps {
  width?:  number
  height?: number
}

export const Scene3DCards: React.FC<Props> = ({ cards, headline, mode }) => {
  const frame  = useCurrentFrame()
  const isDark = mode === 'dark'

  const headlineOpacity = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: 'clamp' })
  const words = headline.split(' ')

  return (
    <AbsoluteFill
      style={{
        background: isDark
          ? 'radial-gradient(ellipse at 50% 120%, #1a0800 0%, #0a0a0a 60%, #000000 100%)'
          : 'radial-gradient(ellipse at 50% 0%, #fff0f0 0%, #ffffff 60%)',
      }}
    >
      {isDark && <PerspectiveGrid mode="dark" color="#ff6b00" opacity={0.12} />}
      <Particles mode={mode} count={30} />

      {cards.slice(0, 6).map((card, i) => {
        const pos = CARD_POSITIONS[i] ?? CARD_POSITIONS[0]
        return (
          <GlassCard
            key={i}
            index={i}
            x={pos.x}
            y={pos.y}
            width={320}
            height={180}
            rotateX={pos.rX}
            rotateY={pos.rY}
            rotateZ={pos.rZ}
            translateZ={pos.tZ}
            mode={mode}
            delay={10}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              {card.avatar && (
                <img
                  src={card.avatar}
                  style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover' }}
                  alt=""
                />
              )}
              <span style={{ fontSize: 15, fontWeight: 600, color: isDark ? '#fff' : '#1a1a1a' }}>
                {card.name}
              </span>
            </div>
            <p style={{
              fontSize: 13, lineHeight: 1.5, margin: 0,
              color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
            }}>
              {card.content}
            </p>
            {card.metrics && (
              <div style={{
                marginTop: 12, display: 'flex', gap: 16, fontSize: 12,
                color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)',
              }}>
                {card.metrics.likes    && <span>❤ {card.metrics.likes}</span>}
                {card.metrics.comments && <span>💬 {card.metrics.comments}</span>}
              </div>
            )}
          </GlassCard>
        )
      })}

      {/* Headline word-by-word */}
      <div style={{
        position:  'absolute',
        top:       '50%',
        left:      '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        opacity:   headlineOpacity,
        zIndex:    100,
      }}>
        <h1 style={{
          fontSize:   56,
          fontWeight: 800,
          color:      isDark ? '#ffffff' : '#1a1a1a',
          lineHeight: 1.2,
          textShadow: isDark ? '0 4px 20px rgba(0,0,0,0.8)' : 'none',
          maxWidth:   800,
          margin:     0,
        }}>
          {words.map((word, i) => {
            const d = 30 + i * 4
            return (
              <span
                key={i}
                style={{
                  display:     'inline-block',
                  opacity:     interpolate(frame, [d, d + 8], [0, 1], { extrapolateRight: 'clamp' }),
                  transform:   `translateY(${interpolate(frame, [d, d + 10], [20, 0], { extrapolateRight: 'clamp' })}px)`,
                  marginRight: '0.3em',
                }}
              >
                {word}
              </span>
            )
          })}
        </h1>
      </div>
    </AbsoluteFill>
  )
}
