import React from 'react'
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion'
import { AnimatedCursor } from '../primitives/AnimatedCursor'
import type { SceneMockupZoomProps } from '../lib/motion-types'

export const SceneMockupZoom: React.FC<SceneMockupZoomProps> = ({
  screenshotUrl, focusArea, annotation, cursorPath, mode,
}) => {
  const frame  = useCurrentFrame()
  const isDark = mode === 'dark'

  // Pan + zoom toward focusArea over the first 40 frames
  const zoomProgress = interpolate(frame, [0, 40], [0, 1], { extrapolateRight: 'clamp' })

  const startScale = 1
  const endScale   = 1.6
  const scale      = startScale + (endScale - startScale) * zoomProgress

  // Pan so that focusArea centre is at screen centre
  const focalX = focusArea.x + focusArea.w / 2
  const focalY = focusArea.y + focusArea.h / 2
  const panX   = (0.5 - focalX) * 1920 * zoomProgress
  const panY   = (0.5 - focalY) * 1080 * zoomProgress

  // Annotation fade-in after zoom settles
  const annotOpacity = interpolate(frame, [50, 65], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill
      style={{
        background: isDark ? '#0a0a0a' : '#f5f5f5',
        overflow:   'hidden',
      }}
    >
      {/* Screenshot */}
      <div style={{
        position:  'absolute',
        inset:     0,
        transform: `scale(${scale}) translate(${panX}px, ${panY}px)`,
        transformOrigin: 'center center',
      }}>
        <img
          src={screenshotUrl}
          alt="mockup"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      {/* Focus highlight box */}
      {zoomProgress > 0.5 && (
        <div style={{
          position:     'absolute',
          left:         `${focusArea.x * 100}%`,
          top:          `${focusArea.y * 100}%`,
          width:        `${focusArea.w * 100}%`,
          height:       `${focusArea.h * 100}%`,
          border:       '3px solid #667EEA',
          borderRadius: 8,
          boxShadow:    '0 0 0 4px rgba(102,126,234,0.25)',
          opacity:      interpolate(frame, [40, 55], [0, 1], { extrapolateRight: 'clamp' }),
        }} />
      )}

      {/* Annotation label */}
      <div style={{
        position:   'absolute',
        bottom:     80,
        left:       '50%',
        transform:  'translateX(-50%)',
        padding:    '12px 28px',
        borderRadius: 12,
        background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        backdropFilter: 'blur(12px)',
        fontSize:   20,
        fontWeight: 600,
        color:      isDark ? '#ffffff' : '#1a1a1a',
        opacity:    annotOpacity,
        whiteSpace: 'nowrap',
      }}>
        {annotation}
      </div>

      {/* Animated cursor */}
      <AnimatedCursor path={cursorPath} color={isDark ? '#ffffff' : '#1a1a1a'} />
    </AbsoluteFill>
  )
}
