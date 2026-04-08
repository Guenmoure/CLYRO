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
// These types are intentionally self-contained so that apps/web can import
// this package without depending on apps/api internals.

export interface BrandScene {
  id: string
  description_visuelle: string
  texte_voix: string
  duree_estimee: number     // seconds
  image_url?: string
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

// ── Scene frame ────────────────────────────────────────────────────────────────

const SceneFrame: React.FC<{ scene: BrandScene; brandConfig: BrandConfig }> = ({
  scene,
  brandConfig,
}) => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const tokens = getStyleTokens(brandConfig.style, brandConfig.primary_color)

  // Ken Burns
  const kenBurnsScale = brandConfig.style === 'dynamique' ? 1.12 : 1.06
  const scale = interpolate(frame, [0, durationInFrames], [1, kenBurnsScale], {
    extrapolateRight: 'clamp',
  })
  const panX = brandConfig.style === 'dynamique'
    ? interpolate(frame, [0, durationInFrames], [0, -3], { extrapolateRight: 'clamp' })
    : 0

  // Text spring
  const springConfig = brandConfig.style === 'fun'
    ? { damping: 120, stiffness: 100 }
    : brandConfig.style === 'dynamique'
    ? { damping: 250, stiffness: 160 }
    : { damping: 180, stiffness: 80 }

  const textSpring  = spring({ frame, fps, config: springConfig })
  const translateY  = interpolate(textSpring, [0, 1], [60, 0])
  const textOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' })
  const barOpacity  = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' })

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

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#000' }}>
      {scene.image_url ? (
        <AbsoluteFill style={{
          transform: `scale(${scale}) translateX(${panX}%)`,
          transformOrigin: 'center center',
        }}>
          <Img src={scene.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ background: tokens.backgroundFill }} />
      )}
      <AbsoluteFill style={{ background: tokens.vignette }} />
      <AbsoluteFill style={{ background: tokens.overlayGradient }} />
      {dynamiqueLines}
      {accentBar}
      {scene.texte_voix?.trim() && (
        <AbsoluteFill style={{
          display: 'flex',
          alignItems: 'flex-end',
          padding: brandConfig.style === 'luxe' ? '0 10% 9%' : '0 8% 8%',
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
          }}>
            {scene.texte_voix}
          </p>
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
}) => {
  const { fps } = useVideoConfig()

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
      {scenes.map((scene, i) => (
        <Sequence
          key={scene.id}
          from={frameOffsets[i]}
          durationInFrames={Math.max(1, Math.round(scene.duree_estimee * fps))}
        >
          <SceneFrame scene={scene} brandConfig={brandConfig} />
        </Sequence>
      ))}
      {brandConfig.logo_url && <LogoOverlay logoUrl={brandConfig.logo_url} />}
    </AbsoluteFill>
  )
}
