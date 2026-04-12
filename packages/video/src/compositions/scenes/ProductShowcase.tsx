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

export const ProductShowcase: React.FC<SceneComponentProps> = ({ scene, brandConfig }) => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  const primary = brandConfig.primary_color
  const font = brandConfig.font_family ?? 'Arial, sans-serif'

  // Image zoom-in animation
  const zoomSpring = spring({ frame, fps, config: { damping: 200, stiffness: 40 } })
  const imgScale = interpolate(zoomSpring, [0, 1], [1.15, 1.0])

  // Logo fade-in
  const logoOpacity = interpolate(frame, [0, 20], [0, 0.9], { extrapolateRight: 'clamp' })

  // Bottom overlay text slide-up
  const textSpring = spring({ frame: Math.max(0, frame - fps * 0.4), fps, config: { damping: 160, stiffness: 80 } })
  const textTranslateY = interpolate(textSpring, [0, 1], [50, 0])
  const textOpacity = interpolate(frame, [fps * 0.3, fps * 0.6], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Floating subtitle badge
  const badgeOpacity = interpolate(frame, [fps * 0.5, fps * 0.9], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const ctaOpacity = scene.cta_text
    ? interpolate(frame, [fps * 0.7, fps * 1.1], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0

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
        backgroundColor: '#000',
        opacity: fadeOut,
        overflow: 'hidden',
      }}
    >
      {/* Background image — 70% center */}
      {scene.image_url && (
        <AbsoluteFill>
          <Img
            src={scene.image_url}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `scale(${imgScale})`,
              transformOrigin: 'center center',
            }}
          />
        </AbsoluteFill>
      )}

      {/* Dark vignette overlay */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.55) 100%)',
        }}
      />

      {/* Bottom gradient for text legibility */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(to top, #000000ee 0%, #00000088 30%, transparent 60%)`,
        }}
      />

      {/* Top-left logo */}
      {brandConfig.logo_url && (
        <div
          style={{
            position: 'absolute',
            top: 40,
            left: 50,
            opacity: logoOpacity,
          }}
        >
          <Img
            src={brandConfig.logo_url}
            style={{ height: 60, maxWidth: 180, objectFit: 'contain' }}
          />
        </div>
      )}

      {/* Floating badge (subtitle) */}
      {scene.texte_voix && (
        <div
          style={{
            position: 'absolute',
            top: 40,
            right: 50,
            background: `${primary}cc`,
            color: '#fff',
            padding: '10px 22px',
            borderRadius: 24,
            fontFamily: font,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '0.01em',
            opacity: badgeOpacity,
            backdropFilter: 'blur(8px)',
          }}
        >
          {scene.texte_voix}
        </div>
      )}

      {/* Bottom: product name + CTA */}
      <AbsoluteFill
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-start',
          padding: '0 8% 8%',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {displayText && (
          <p
            style={{
              color: '#ffffff',
              fontSize: 64,
              fontFamily: font,
              fontWeight: 800,
              lineHeight: 1.15,
              margin: 0,
              letterSpacing: '-0.01em',
              textShadow: '0 2px 20px rgba(0,0,0,0.9)',
              transform: `translateY(${textTranslateY}px)`,
              opacity: textOpacity,
              alignSelf: 'flex-start',
            }}
          >
            {displayText}
          </p>
        )}

        {scene.cta_text && (
          <div
            style={{
              display: 'inline-block',
              background: primary,
              color: '#fff',
              padding: '16px 44px',
              borderRadius: 12,
              fontFamily: font,
              fontWeight: 700,
              fontSize: 30,
              letterSpacing: '0.02em',
              opacity: ctaOpacity,
              boxShadow: `0 4px 24px ${primary}66`,
              alignSelf: 'flex-start',
            }}
          >
            {scene.cta_text}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
