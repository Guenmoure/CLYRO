import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion'
import { Particles } from '../primitives/Particles'
import type { SceneLogoRevealProps } from '../lib/motion-types'

export const SceneLogoReveal: React.FC<SceneLogoRevealProps> = ({
  logoUrl, tagline, brandColor, style = 'scale_bounce', mode,
}) => {
  const frame   = useCurrentFrame()
  const { fps } = useVideoConfig()
  const isDark  = mode === 'dark'

  const scaleBounce = spring({ frame, fps, config: { damping: 8, stiffness: 80, mass: 0.9 } })
  const assemble    = spring({ frame, fps, config: { damping: 14, stiffness: 120 } })
  const taglineOp   = interpolate(frame, [35, 50], [0, 1], { extrapolateRight: 'clamp' })

  const logoScale = style === 'scale_bounce'
    ? scaleBounce
    : style === 'assemble'
    ? assemble
    : scaleBounce  // particles_in: same entrance, particles add flair

  const logoOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill
      style={{
        background: isDark
          ? '#0a0a0a'
          : 'radial-gradient(ellipse at 50% 50%, #f0f0f8 0%, #ffffff 70%)',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            32,
      }}
    >
      {/* Particles (always active for particles_in; subtle for others) */}
      <Particles
        mode={mode}
        count={style === 'particles_in' ? 60 : 20}
        color={brandColor}
        maxRadius={style === 'particles_in' ? 4 : 2}
      />

      {/* Glow ring behind logo */}
      <div style={{
        position:     'absolute',
        width:        320,
        height:       320,
        borderRadius: '50%',
        background:   `radial-gradient(circle, ${brandColor}22 0%, transparent 70%)`,
        transform:    `scale(${logoScale * 1.4})`,
      }} />

      {/* Logo */}
      <div style={{
        transform: `scale(${logoScale})`,
        opacity:   logoOpacity,
        zIndex:    10,
      }}>
        <img
          src={logoUrl}
          alt="logo"
          style={{
            maxWidth:  320,
            maxHeight: 200,
            objectFit: 'contain',
            filter:    style === 'assemble' && frame < 15
              ? `blur(${interpolate(frame, [0, 15], [8, 0], { extrapolateRight: 'clamp' })}px)`
              : undefined,
          }}
        />
      </div>

      {/* Divider line */}
      <div style={{
        width:        interpolate(frame, [20, 45], [0, 280], { extrapolateRight: 'clamp' }),
        height:       2,
        background:   `linear-gradient(to right, transparent, ${brandColor}, transparent)`,
        borderRadius: 1,
      }} />

      {/* Tagline */}
      {tagline && (
        <p style={{
          margin:      0,
          fontSize:    28,
          fontWeight:  500,
          color:       isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          opacity:     taglineOp,
        }}>
          {tagline}
        </p>
      )}
    </AbsoluteFill>
  )
}
