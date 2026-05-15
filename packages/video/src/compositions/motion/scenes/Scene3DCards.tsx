import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion'
import { GlassCard } from '../primitives/GlassCard'
import { Particles } from '../primitives/Particles'
import { PerspectiveGrid } from '../primitives/PerspectiveGrid'
import { useBrand, TOKENS } from '../lib/brand-context'
import type { Scene3DCardsProps } from '../lib/motion-types'

// Card positions are expressed as PERCENTAGES of the composition size so
// the same layout works for 16:9, 9:16 and 1:1 outputs. The previous
// hardcoded pixel positions (x up to 1200, y up to 500) put cards 4-6
// completely offscreen in vertical 1080×1920 renders.
const CARD_POSITIONS_PCT = [
  { xPct: 0.05, yPct: 0.12, rX: -8, rY:  12, rZ: -3, tZ: -100 },
  { xPct: 0.30, yPct: 0.06, rX: -5, rY:  -8, rZ:  2, tZ:  -50 },
  { xPct: 0.55, yPct: 0.14, rX: -6, rY:  10, rZ: -1, tZ:  -80 },
  { xPct: 0.78, yPct: 0.08, rX: -4, rY: -12, rZ:  3, tZ: -120 },
  { xPct: 0.12, yPct: 0.55, rX: -7, rY:   6, rZ: -2, tZ:  -60 },
  { xPct: 0.58, yPct: 0.53, rX: -5, rY: -10, rZ:  1, tZ:  -90 },
]

interface Props extends Scene3DCardsProps {
  width?:  number
  height?: number
}

export const Scene3DCards: React.FC<Props> = ({ cards, headline, mode }) => {
  const frame  = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const brand  = useBrand()
  const isDark = mode === 'dark'

  // Card size scales with the smaller composition dimension so it stays
  // legible on every format (square, landscape, portrait).
  const cardW = Math.round(Math.min(width, height) * 0.30)   // ≈ 324 on 1080
  const cardH = Math.round(cardW * 0.56)                      // ≈ 180

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
      {/* Perspective grid + particles now use the brand primary — no more
          hardcoded #ff6b00 that ignored the customer's palette. */}
      {isDark && <PerspectiveGrid mode="dark" color={brand.primary} opacity={0.12} />}
      <Particles mode={mode} count={30} />

      {cards.slice(0, 6).map((card, i) => {
        const pos = CARD_POSITIONS_PCT[i] ?? CARD_POSITIONS_PCT[0]!
        // Convert percentages → pixels for the current composition size,
        // then clamp so the card right/bottom edge never goes off-frame.
        const xRaw = Math.round(pos.xPct * width)
        const yRaw = Math.round(pos.yPct * height)
        const x = Math.max(8, Math.min(xRaw, width  - cardW - 8))
        const y = Math.max(8, Math.min(yRaw, height - cardH - 8))
        return (
          <GlassCard
            key={i}
            index={i}
            x={x}
            y={y}
            width={cardW}
            height={cardH}
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
          fontSize:   TOKENS.fontScale.headingL,
          fontWeight: 800,
          color:      isDark ? '#ffffff' : '#1a1a1a',
          fontFamily: brand.fontFamily,
          lineHeight: 1.2,
          textShadow: isDark ? '0 4px 20px rgba(0,0,0,0.8)' : 'none',
          maxWidth:   Math.min(width * 0.65, 800),
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
