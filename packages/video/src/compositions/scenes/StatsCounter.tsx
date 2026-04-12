import React from 'react'
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion'
import type { BrandScene, BrandConfig } from '../BrandOverlay'

interface SceneComponentProps {
  scene: BrandScene
  brandConfig: BrandConfig
  frameOffset?: number
}

/**
 * Parses a numeric value from strings like "87%", "10 000", "+3x", "2h"
 * Returns { prefix, value, suffix } for animated display.
 */
function parseStatValue(text: string): { prefix: string; value: number; suffix: string } {
  if (!text) return { prefix: '', value: 0, suffix: '' }

  // Match optional leading sign/text, then digits (with optional spaces/dots), then suffix
  const match = text.match(/^([^0-9]*)([0-9][0-9\s.,]*)(.*)$/)
  if (!match) return { prefix: '', value: 0, suffix: text }

  const prefix = match[1] ?? ''
  const rawNum = (match[2] ?? '0').replace(/[\s,]/g, '')
  const value = parseFloat(rawNum) || 0
  const suffix = (match[3] ?? '').trim()

  return { prefix, value, suffix }
}

export const StatsCounter: React.FC<SceneComponentProps> = ({ scene, brandConfig }) => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  const primary = brandConfig.primary_color
  const font = brandConfig.font_family ?? 'Arial, sans-serif'

  const displayText = scene.display_text ?? ''
  const { prefix, value, suffix } = parseStatValue(displayText)

  // Counter animates over 80% of the scene
  const countEnd = durationInFrames * 0.8
  const currentValue = interpolate(frame, [0, countEnd], [0, value], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Format the animated number (no decimals if integer)
  const isInteger = Number.isInteger(value)
  const displayNum = isInteger
    ? Math.round(currentValue).toLocaleString('fr-FR')
    : currentValue.toFixed(1)

  // Label slide-up
  const labelSpring = spring({ frame: Math.max(0, frame - fps * 0.2), fps, config: { damping: 160, stiffness: 80 } })
  const labelTranslateY = interpolate(labelSpring, [0, 1], [40, 0])
  const labelOpacity = interpolate(frame, [fps * 0.15, fps * 0.5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Number scale pop
  const numSpring = spring({ frame, fps, config: { damping: 120, stiffness: 60 } })
  const numScale = interpolate(numSpring, [0, 1], [0.6, 1])
  const numOpacity = interpolate(frame, [0, fps * 0.2], [0, 1], { extrapolateRight: 'clamp' })

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 10, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
        opacity: fadeOut,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 32,
      }}
    >
      {/* Background decorative ring */}
      <div
        style={{
          position: 'absolute',
          width: 480,
          height: 480,
          borderRadius: '50%',
          border: `2px solid ${primary}22`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 340,
          height: 340,
          borderRadius: '50%',
          border: `1px solid ${primary}33`,
          pointerEvents: 'none',
        }}
      />

      {/* Animated number */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          transform: `scale(${numScale})`,
          opacity: numOpacity,
        }}
      >
        {prefix && (
          <span
            style={{
              color: primary,
              fontSize: 72,
              fontFamily: font,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            {prefix}
          </span>
        )}
        <span
          style={{
            color: '#ffffff',
            fontSize: 144,
            fontFamily: font,
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: '-0.03em',
            textShadow: `0 0 60px ${primary}66`,
          }}
        >
          {displayNum}
        </span>
        {suffix && (
          <span
            style={{
              color: primary,
              fontSize: 72,
              fontFamily: font,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            {suffix}
          </span>
        )}
      </div>

      {/* Label below */}
      {scene.texte_voix && (
        <p
          style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: 36,
            fontFamily: font,
            fontWeight: 400,
            lineHeight: 1.4,
            margin: 0,
            textAlign: 'center',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            transform: `translateY(${labelTranslateY}px)`,
            opacity: labelOpacity,
            maxWidth: '70%',
          }}
        >
          {scene.texte_voix}
        </p>
      )}

      {/* Accent line */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 4,
          background: `linear-gradient(to right, transparent, ${primary}, transparent)`,
        }}
      />
    </AbsoluteFill>
  )
}
