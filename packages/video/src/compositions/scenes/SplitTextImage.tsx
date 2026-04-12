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

export const SplitTextImage: React.FC<SceneComponentProps> = ({ scene, brandConfig, frameOffset = 0 }) => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  const primary = brandConfig.primary_color
  const font = brandConfig.font_family ?? 'Arial, sans-serif'

  // Alternate left/right based on frameOffset (scene index proxy)
  const imageRight = (frameOffset % 2) === 0

  // Text slide-in from the left
  const slideSpring = spring({ frame, fps, config: { damping: 180, stiffness: 90 } })
  const textTranslateX = interpolate(slideSpring, [0, 1], [-80, 0])
  const textOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' })

  // Ken Burns on image
  const imgScale = interpolate(frame, [0, durationInFrames], [1, 1.07], { extrapolateRight: 'clamp' })
  const imgPanX = interpolate(frame, [0, durationInFrames], [0, imageRight ? 2 : -2], { extrapolateRight: 'clamp' })

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 10, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  const displayText = scene.display_text ?? scene.texte_voix

  const textBlock = (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 8%',
        gap: 24,
        transform: `translateX(${textTranslateX}px)`,
        opacity: textOpacity,
      }}
    >
      {/* Accent bar */}
      <div
        style={{
          width: 56,
          height: 4,
          background: primary,
          borderRadius: 2,
        }}
      />
      <p
        style={{
          color: '#ffffff',
          fontSize: 60,
          fontFamily: font,
          fontWeight: 800,
          lineHeight: 1.15,
          margin: 0,
          letterSpacing: '-0.01em',
          textShadow: '0 2px 16px rgba(0,0,0,0.5)',
        }}
      >
        {displayText}
      </p>
      {scene.display_text && (
        <p
          style={{
            color: 'rgba(255,255,255,0.75)',
            fontSize: 28,
            fontFamily: font,
            fontWeight: 400,
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          {scene.texte_voix}
        </p>
      )}
    </div>
  )

  const imageBlock = (
    <div
      style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {scene.image_url ? (
        <Img
          src={scene.image_url}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${imgScale}) translateX(${imgPanX}%)`,
            transformOrigin: 'center center',
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: `linear-gradient(135deg, ${primary}44, #000)`,
          }}
        />
      )}
      {/* Gradient edge blend */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          [imageRight ? 'left' : 'right']: 0,
          width: '30%',
          background: imageRight
            ? 'linear-gradient(to right, #111 0%, transparent 100%)'
            : 'linear-gradient(to left, #111 0%, transparent 100%)',
        }}
      />
    </div>
  )

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#111111',
        opacity: fadeOut,
        display: 'flex',
        flexDirection: 'row',
      }}
    >
      {imageRight ? textBlock : imageBlock}
      {imageRight ? imageBlock : textBlock}
    </AbsoluteFill>
  )
}
