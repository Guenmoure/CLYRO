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

export const TextHero: React.FC<SceneComponentProps> = ({ scene, brandConfig }) => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  const primary = brandConfig.primary_color
  const secondary = brandConfig.secondary_color ?? '#6366f1'
  const animType = scene.animation_type ?? 'slide-in'

  // animation_type routing: slide-in (default) | zoom | fade | typewriter | particle-burst→slide-in
  const slideSpring = spring({ frame, fps, config: { damping: 160, stiffness: 80 } })
  const zoomSpring  = spring({ frame, fps, config: { damping: 120, stiffness: 200 } })

  const translateY = animType === 'zoom' || animType === 'fade'
    ? 0
    : interpolate(slideSpring, [0, 1], [80, 0])

  const heroScale = animType === 'zoom'
    ? interpolate(zoomSpring, [0, 1], [0.75, 1])
    : 1

  const opacity = animType === 'fade'
    ? interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' })
    : interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' })

  // typewriter: reveal text progressively via clip-path width
  const heroText = scene.display_text ?? scene.texte_voix ?? ''
  const typewriterReveal = animType === 'typewriter'
    ? interpolate(frame, [0, Math.max(fps * 1.2, heroText.length * 3)], [0, 100], { extrapolateRight: 'clamp' })
    : 100

  const subOpacity = interpolate(frame, [fps * 0.3, fps * 0.7], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 10, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  const font = brandConfig.font_family ?? 'Arial, sans-serif'

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
        opacity: fadeOut,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        padding: '0 10%',
        gap: 32,
      }}
    >
      {/* Decorative background circle */}
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          right: '-10%',
          width: '60%',
          height: '60%',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-15%',
          left: '-5%',
          width: '45%',
          height: '45%',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)',
          pointerEvents: 'none',
        }}
      />

      {/* Hero text — animation_type aware */}
      <p
        style={{
          color: '#ffffff',
          fontSize: 96,
          fontFamily: font,
          fontWeight: 900,
          lineHeight: 1.1,
          margin: 0,
          textAlign: 'center',
          letterSpacing: '-0.02em',
          textShadow: '0 4px 32px rgba(0,0,0,0.3)',
          transform: `translateY(${translateY}px) scale(${heroScale})`,
          opacity,
          maxWidth: '100%',
          // typewriter: clip-path reveals text left→right
          clipPath: animType === 'typewriter' ? `inset(0 ${100 - typewriterReveal}% 0 0)` : undefined,
        }}
      >
        {heroText}
      </p>

      {/* Sub text */}
      {scene.display_text && scene.texte_voix && (
        <p
          style={{
            color: 'rgba(255,255,255,0.8)',
            fontSize: 36,
            fontFamily: font,
            fontWeight: 400,
            lineHeight: 1.4,
            margin: 0,
            textAlign: 'center',
            letterSpacing: '0.01em',
            opacity: subOpacity,
            maxWidth: '80%',
          }}
        >
          {scene.texte_voix}
        </p>
      )}
    </AbsoluteFill>
  )
}
