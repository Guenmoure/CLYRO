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

/**
 * Full-bleed image with gradient overlay + display_text at bottom.
 * Mirrors the SceneFrame behavior from BrandOverlay (slide-in animation type).
 */
export const ImageFull: React.FC<SceneComponentProps> = ({ scene, brandConfig }) => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  const primary = brandConfig.primary_color
  const font = brandConfig.font_family ?? 'Arial, sans-serif'
  const animType = scene.animation_type ?? 'slide-in'

  // Ken Burns — more dramatic for zoom type
  const kbEnd = animType === 'zoom' ? 1.14 : 1.06
  const imgScale = interpolate(frame, [0, durationInFrames], [1, kbEnd], { extrapolateRight: 'clamp' })

  // Text animation routing
  const textSpring = spring({ frame, fps, config: { damping: 180, stiffness: 80 } })
  const zoomSpring  = spring({ frame, fps, config: { damping: 120, stiffness: 200 } })

  const translateY = animType === 'fade' || animType === 'zoom'
    ? 0
    : interpolate(textSpring, [0, 1], [60, 0])

  const textScale = animType === 'zoom'
    ? interpolate(zoomSpring, [0, 1], [0.8, 1])
    : 1

  const textOpacity = animType === 'fade'
    ? interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' })
    : interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' })

  // CTA
  const ctaOpacity = scene.cta_text
    ? interpolate(frame, [fps * 0.6, fps * 1.0], [0, 1], { extrapolateRight: 'clamp' })
    : 0

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 10, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  const displayText = scene.display_text ?? scene.texte_voix

  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        backgroundColor: '#000',
        opacity: fadeOut,
      }}
    >
      {/* Background image */}
      {scene.image_url ? (
        <AbsoluteFill
          style={{
            transform: `scale(${imgScale})`,
            transformOrigin: 'center center',
          }}
        >
          <Img
            src={scene.image_url}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill
          style={{
            background: `linear-gradient(135deg, ${primary}44, #000)`,
          }}
        />
      )}

      {/* Vignette */}
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.35) 100%)',
        }}
      />

      {/* Bottom gradient */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(to top, ${primary}dd 0%, ${primary}55 30%, transparent 65%)`,
        }}
      />

      {/* Accent bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 4,
          background: primary,
          opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      />

      {/* Text block */}
      {displayText?.trim() && (
        <AbsoluteFill
          style={{
            display: 'flex',
            alignItems: scene.cta_text ? 'center' : 'flex-end',
            flexDirection: 'column',
            justifyContent: scene.cta_text ? 'center' : 'flex-end',
            padding: '0 8% 8%',
            gap: 32,
          }}
        >
          <p
            style={{
              color: '#ffffff',
              fontSize: 52,
              fontFamily: font,
              fontWeight: 700,
              lineHeight: 1.3,
              margin: 0,
              letterSpacing: '0em',
              textShadow: '0 2px 12px rgba(0,0,0,0.85)',
              transform: `translateY(${translateY}px) scale(${textScale})`,
              opacity: textOpacity,
              maxWidth: '88%',
              textAlign: scene.cta_text ? 'center' : 'left',
            }}
          >
            {displayText}
          </p>

          {scene.cta_text && (
            <div
              style={{
                display: 'inline-block',
                background: primary,
                color: '#ffffff',
                padding: '18px 48px',
                borderRadius: 12,
                fontFamily: font,
                fontWeight: 700,
                fontSize: 32,
                letterSpacing: '0.02em',
                opacity: ctaOpacity,
                boxShadow: `0 4px 24px ${primary}66`,
              }}
            >
              {scene.cta_text}
            </div>
          )}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  )
}
