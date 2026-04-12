import React, { useMemo } from 'react'
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  Img,
  Audio,
  interpolate,
  spring,
} from 'remotion'

// ── Types ──────────────────────────────────────────────────────────────────────

export type AnimationType = 'slide-in' | 'zoom' | 'fade' | 'particle-burst' | 'typewriter'

export type SceneType = 'text_hero' | 'split_text_image' | 'product_showcase' | 'stats_counter' | 'cta_end' | 'image_full'

export interface BrandScene {
  id: string
  description_visuelle: string
  texte_voix: string
  duree_estimee: number     // seconds
  image_url?: string
  // Motion Design fields
  display_text?: string
  animation_type?: AnimationType
  needs_background?: boolean
  cta_text?: string
  scene_type?: SceneType
}

export interface BrandConfig {
  logo_url?: string
  primary_color: string
  secondary_color?: string
  font_family?: string
  style?: 'corporate' | 'dynamique' | 'luxe' | 'fun' | string
}

export interface BrandOverlayProps {
  scenes: BrandScene[]
  brandConfig: BrandConfig
  format: '9:16' | '1:1' | '16:9'
  audioSrc?: string
  musicSrc?: string
}

// ── Style tokens ───────────────────────────────────────────────────────────────

interface StyleTokens {
  overlayGradient: string
  textColor: string
  accentColor: string
  fontWeight: number
  textSize: number
  letterSpacing: string
  accentBarHeight: number
  accentBarPosition: 'top' | 'bottom'
  backgroundFill: string
  vignette: string
}

function getStyleTokens(style: string | undefined, primaryColor: string): StyleTokens {
  switch (style) {
    case 'corporate':
      return {
        overlayGradient:   `linear-gradient(to top, #1a2b5edd 0%, #1a2b5e88 30%, transparent 65%)`,
        textColor:         '#ffffff',
        accentColor:       primaryColor,
        fontWeight:        600,
        textSize:          52,
        letterSpacing:     '0.01em',
        accentBarHeight:   5,
        accentBarPosition: 'top',
        backgroundFill:    `linear-gradient(135deg, #1a2b5e 0%, #0d1a3a 100%)`,
        vignette:          'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)',
      }
    case 'dynamique':
      return {
        overlayGradient:   `linear-gradient(160deg, transparent 30%, ${primaryColor}cc 100%)`,
        textColor:         '#ffffff',
        accentColor:       primaryColor,
        fontWeight:        800,
        textSize:          58,
        letterSpacing:     '-0.01em',
        accentBarHeight:   6,
        accentBarPosition: 'bottom',
        backgroundFill:    `linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 100%)`,
        vignette:          'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)',
      }
    case 'luxe':
      return {
        overlayGradient:   `linear-gradient(to top, #0d0a06ee 0%, #1a140aaa 40%, transparent 70%)`,
        textColor:         '#f5e6c8',
        accentColor:       '#c9a227',
        fontWeight:        300,
        textSize:          50,
        letterSpacing:     '0.06em',
        accentBarHeight:   1,
        accentBarPosition: 'top',
        backgroundFill:    `linear-gradient(135deg, #0d0a06 0%, #1a1008 100%)`,
        vignette:          'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.5) 100%)',
      }
    case 'fun':
      return {
        overlayGradient:   `linear-gradient(to top, ${primaryColor}dd 0%, ${primaryColor}66 30%, transparent 60%)`,
        textColor:         '#ffffff',
        accentColor:       primaryColor,
        fontWeight:        800,
        textSize:          56,
        letterSpacing:     '0.02em',
        accentBarHeight:   8,
        accentBarPosition: 'bottom',
        backgroundFill:    `linear-gradient(135deg, ${primaryColor} 0%, #ff6b9d 100%)`,
        vignette:          'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.25) 100%)',
      }
    default:
      return {
        overlayGradient:   `linear-gradient(to top, ${primaryColor}dd 0%, ${primaryColor}55 30%, transparent 65%)`,
        textColor:         '#ffffff',
        accentColor:       primaryColor,
        fontWeight:        700,
        textSize:          52,
        letterSpacing:     '0em',
        accentBarHeight:   4,
        accentBarPosition: 'bottom',
        backgroundFill:    `linear-gradient(135deg, ${primaryColor}44, #000)`,
        vignette:          'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.35) 100%)',
      }
  }
}

// ── Particle burst effect ───────────────────────────────────────────────────────

const PARTICLE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]

const ParticleBurst: React.FC<{ color: string; progress: number }> = ({ color, progress }) => (
  <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
    {PARTICLE_ANGLES.map((angle) => {
      const rad = (angle * Math.PI) / 180
      const radius = progress * 280
      const x = Math.cos(rad) * radius
      const y = Math.sin(rad) * radius
      const opacity = interpolate(progress, [0, 0.25, 0.75, 1], [0, 1, 0.6, 0])
      const size = interpolate(progress, [0, 0.5, 1], [10, 16, 6])
      return (
        <div
          key={angle}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: size,
            height: size,
            borderRadius: '50%',
            background: color,
            opacity,
            transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
          }}
        />
      )
    })}
  </AbsoluteFill>
)

// ── CTA overlay ────────────────────────────────────────────────────────────────

const CtaButton: React.FC<{ text: string; accentColor: string; textColor: string; opacity: number }> = ({
  text, accentColor, textColor, opacity,
}) => (
  <div style={{
    display: 'inline-block',
    background: accentColor,
    color: textColor,
    padding: '18px 48px',
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 32,
    letterSpacing: '0.02em',
    opacity,
    boxShadow: `0 4px 24px ${accentColor}66`,
  }}>
    {text}
  </div>
)

// ── Scene frame ────────────────────────────────────────────────────────────────

const CROSSFADE_FRAMES = 10

const SceneFrame: React.FC<{
  scene: BrandScene
  brandConfig: BrandConfig
  isCrossFadeStart?: boolean
}> = ({ scene, brandConfig, isCrossFadeStart = false }) => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const tokens = getStyleTokens(brandConfig.style, brandConfig.primary_color)
  const animationType = scene.animation_type ?? 'slide-in'
  const displayText = scene.display_text ?? scene.texte_voix

  // ── Cross-dissolve opacity ──
  const fadeIn = isCrossFadeStart
    ? interpolate(frame, [0, CROSSFADE_FRAMES], [0, 1], { extrapolateRight: 'clamp' })
    : 1
  const fadeOut = interpolate(
    frame,
    [durationInFrames - CROSSFADE_FRAMES, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )
  const crossFadeOpacity = Math.min(fadeIn, fadeOut)

  // ── Background/image animation ──
  let imgScale = 1
  let imgPanX = 0

  if (animationType === 'zoom') {
    imgScale = interpolate(frame, [0, durationInFrames], [1.25, 1.0], { extrapolateRight: 'clamp' })
  } else if (brandConfig.style === 'dynamique') {
    imgScale = interpolate(frame, [0, durationInFrames], [1, 1.12], { extrapolateRight: 'clamp' })
    imgPanX = interpolate(frame, [0, durationInFrames], [0, -3], { extrapolateRight: 'clamp' })
  } else {
    // Ken Burns for slide-in, fade, particle-burst, typewriter
    imgScale = interpolate(frame, [0, durationInFrames], [1, 1.06], { extrapolateRight: 'clamp' })
  }

  // ── Text animations by type ──
  let textOpacity = 1
  let translateY = 0
  let textContent = displayText

  const springConfig = brandConfig.style === 'fun'
    ? { damping: 120, stiffness: 100 }
    : brandConfig.style === 'dynamique'
    ? { damping: 250, stiffness: 160 }
    : { damping: 180, stiffness: 80 }

  if (animationType === 'slide-in') {
    const textSpring = spring({ frame, fps, config: springConfig })
    translateY = interpolate(textSpring, [0, 1], [60, 0])
    textOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' })
  } else if (animationType === 'zoom') {
    const textSpring = spring({ frame, fps, config: { damping: 200, stiffness: 60 } })
    textOpacity = interpolate(textSpring, [0, 1], [0, 1])
  } else if (animationType === 'fade') {
    textOpacity = interpolate(frame, [0, fps * 0.8], [0, 1], { extrapolateRight: 'clamp' })
  } else if (animationType === 'particle-burst') {
    textOpacity = interpolate(frame, [fps * 0.4, fps * 0.9], [0, 1], { extrapolateRight: 'clamp' })
  } else if (animationType === 'typewriter') {
    const fullText = displayText ?? ''
    const charsToShow = Math.floor(
      interpolate(frame, [fps * 0.2, Math.min(fps * 1.8, durationInFrames - fps * 0.3)], [0, fullText.length], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    )
    textContent = fullText.slice(0, charsToShow)
    textOpacity = 1
  }

  // Particle progress for particle-burst
  const particleProgress = animationType === 'particle-burst'
    ? interpolate(frame, [0, fps * 0.8], [0, 1], { extrapolateRight: 'clamp' })
    : 0

  // CTA button opacity
  const ctaOpacity = scene.cta_text
    ? interpolate(frame, [fps * 0.6, fps * 1.0], [0, 1], { extrapolateRight: 'clamp' })
    : 0

  const barOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' })

  const accentBar = tokens.accentBarHeight > 0 && (
    <div style={{
      position: 'absolute',
      [tokens.accentBarPosition]: 0,
      left: 0, right: 0,
      height: tokens.accentBarHeight,
      background: tokens.accentColor,
      opacity: barOpacity,
    }} />
  )

  const dynamiqueLines = brandConfig.style === 'dynamique' && (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden', opacity: 0.18 }}>
      {[-2, -1, 0, 1, 2].map((i) => (
        <div key={i} style={{
          position: 'absolute',
          top: 0, bottom: 0,
          left: `${50 + i * 18}%`,
          width: 2,
          background: tokens.accentColor,
          transform: 'skewX(-20deg)',
          transformOrigin: 'top',
        }} />
      ))}
    </AbsoluteFill>
  )

  // Use solid background when needs_background is false
  const hasBackground = scene.needs_background !== false

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#000', opacity: crossFadeOpacity }}>
      {/* Background */}
      {hasBackground && scene.image_url ? (
        <AbsoluteFill style={{
          transform: `scale(${imgScale}) translateX(${imgPanX}%)`,
          transformOrigin: 'center center',
        }}>
          <Img src={scene.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ background: tokens.backgroundFill }} />
      )}

      {/* Overlays */}
      <AbsoluteFill style={{ background: tokens.vignette }} />
      <AbsoluteFill style={{ background: tokens.overlayGradient }} />
      {dynamiqueLines}

      {/* Particle burst */}
      {animationType === 'particle-burst' && particleProgress > 0 && (
        <ParticleBurst color={tokens.accentColor} progress={particleProgress} />
      )}

      {accentBar}

      {/* Main text */}
      {textContent?.trim() && (
        <AbsoluteFill style={{
          display: 'flex',
          alignItems: scene.cta_text ? 'center' : 'flex-end',
          flexDirection: 'column',
          justifyContent: scene.cta_text ? 'center' : 'flex-end',
          padding: brandConfig.style === 'luxe' ? '0 10% 9%' : '0 8% 8%',
          gap: 32,
        }}>
          <p style={{
            color: tokens.textColor,
            fontSize: tokens.textSize,
            fontFamily: brandConfig.font_family ?? 'Arial, sans-serif',
            fontWeight: tokens.fontWeight,
            lineHeight: 1.3,
            margin: 0,
            letterSpacing: tokens.letterSpacing,
            textShadow: brandConfig.style === 'luxe'
              ? '0 2px 20px rgba(0,0,0,0.9)'
              : '0 2px 12px rgba(0,0,0,0.85)',
            transform: `translateY(${translateY}px)`,
            opacity: textOpacity,
            maxWidth: '88%',
            textTransform: brandConfig.style === 'luxe' ? 'uppercase' : 'none',
            textAlign: scene.cta_text ? 'center' : 'left',
          }}>
            {textContent}
            {animationType === 'typewriter' && frame % (fps / 2) < fps / 4 && (
              <span style={{ opacity: 0.7 }}>|</span>
            )}
          </p>

          {/* CTA button on last scene */}
          {scene.cta_text && (
            <CtaButton
              text={scene.cta_text}
              accentColor={tokens.accentColor}
              textColor={tokens.textColor}
              opacity={ctaOpacity}
            />
          )}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  )
}

// ── Logo watermark ─────────────────────────────────────────────────────────────

const LogoOverlay: React.FC<{ logoUrl: string }> = ({ logoUrl }) => {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [0, 15], [0, 0.9], { extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: 40, right: 50, opacity }}>
        <Img src={logoUrl} style={{ height: 56, maxWidth: 160, objectFit: 'contain' }} />
      </div>
    </AbsoluteFill>
  )
}

// ── Main composition ───────────────────────────────────────────────────────────

export const BrandOverlay: React.FC<BrandOverlayProps> = ({
  scenes,
  brandConfig,
  audioSrc,
  musicSrc,
}) => {
  const { fps } = useVideoConfig()

  // Frame offsets: each scene starts after the previous (no overlap in Sequence timing)
  // Cross-dissolve is handled inside SceneFrame via frame-level opacity
  const frameOffsets = useMemo(() => {
    const offsets: number[] = []
    let current = 0
    for (const scene of scenes) {
      offsets.push(current)
      current += Math.max(1, Math.round(scene.duree_estimee * fps))
    }
    return offsets
  }, [scenes, fps])

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {audioSrc && <Audio src={audioSrc} />}
      {musicSrc && <Audio src={musicSrc} volume={0.12} />}
      {scenes.map((scene, i) => (
        <Sequence
          key={scene.id}
          from={Math.max(0, frameOffsets[i] - (i > 0 ? CROSSFADE_FRAMES : 0))}
          durationInFrames={Math.max(1, Math.round(scene.duree_estimee * fps)) + (i > 0 ? CROSSFADE_FRAMES : 0)}
        >
          <SceneFrame
            scene={scene}
            brandConfig={brandConfig}
            isCrossFadeStart={i > 0}
          />
        </Sequence>
      ))}
      {brandConfig.logo_url && <LogoOverlay logoUrl={brandConfig.logo_url} />}
    </AbsoluteFill>
  )
}
