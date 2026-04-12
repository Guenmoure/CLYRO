import React from 'react'
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Img,
  interpolate,
  spring,
} from 'remotion'
import type { BrandScene, BrandConfig } from '../BrandOverlay'

interface SceneComponentProps {
  scene: BrandScene
  brandConfig: BrandConfig
  frameOffset?: number
}

export const CtaEnd: React.FC<SceneComponentProps> = ({ scene, brandConfig }) => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  const primary = brandConfig.primary_color
  const secondary = brandConfig.secondary_color ?? '#6366f1'
  const font = brandConfig.font_family ?? 'Arial, sans-serif'

  // Logo scale-up spring
  const logoSpring = spring({ frame, fps, config: { damping: 140, stiffness: 60 } })
  const logoScale = interpolate(logoSpring, [0, 1], [0.4, 1])
  const logoOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' })

  // Tagline slide-up
  const taglineSpring = spring({ frame: Math.max(0, frame - fps * 0.3), fps, config: { damping: 160, stiffness: 80 } })
  const taglineTranslateY = interpolate(taglineSpring, [0, 1], [50, 0])
  const taglineOpacity = interpolate(frame, [fps * 0.25, fps * 0.55], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // CTA button fade-in
  const ctaOpacity = interpolate(frame, [fps * 0.55, fps * 0.9], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const ctaScale = spring({ frame: Math.max(0, frame - Math.round(fps * 0.55)), fps, config: { damping: 120, stiffness: 80 } })
  const ctaScaleValue = interpolate(ctaScale, [0, 1], [0.8, 1])

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 10, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  const displayText = scene.display_text ?? ''

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
        opacity: fadeOut,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 40,
      }}
    >
      {/* Radial glow behind logo */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />

      {/* Logo (large, centered) */}
      {brandConfig.logo_url ? (
        <div
          style={{
            transform: `scale(${logoScale})`,
            opacity: logoOpacity,
          }}
        >
          <Img
            src={brandConfig.logo_url}
            style={{
              height: 120,
              maxWidth: 320,
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 32px rgba(0,0,0,0.4))',
            }}
          />
        </div>
      ) : (
        /* Placeholder brand circle if no logo */
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            border: '3px solid rgba(255,255,255,0.5)',
            transform: `scale(${logoScale})`,
            opacity: logoOpacity,
          }}
        />
      )}

      {/* Tagline */}
      {displayText && (
        <p
          style={{
            color: '#ffffff',
            fontSize: 56,
            fontFamily: font,
            fontWeight: 700,
            lineHeight: 1.2,
            margin: 0,
            textAlign: 'center',
            letterSpacing: '-0.01em',
            textShadow: '0 2px 20px rgba(0,0,0,0.3)',
            transform: `translateY(${taglineTranslateY}px)`,
            opacity: taglineOpacity,
            maxWidth: '80%',
          }}
        >
          {displayText}
        </p>
      )}

      {/* CTA button */}
      {scene.cta_text && (
        <div
          style={{
            display: 'inline-block',
            background: '#ffffff',
            color: primary,
            padding: '20px 60px',
            borderRadius: 16,
            fontFamily: font,
            fontWeight: 800,
            fontSize: 34,
            letterSpacing: '0.01em',
            opacity: ctaOpacity,
            transform: `scale(${ctaScaleValue})`,
            boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
          }}
        >
          {scene.cta_text}
        </div>
      )}
    </AbsoluteFill>
  )
}
