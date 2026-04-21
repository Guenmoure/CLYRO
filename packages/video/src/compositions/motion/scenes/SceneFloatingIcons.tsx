import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion'
import type { SceneFloatingIconsProps } from '../lib/motion-types'

export const SceneFloatingIcons: React.FC<SceneFloatingIconsProps> = ({
  icons, headline, notification, mode,
}) => {
  const frame   = useCurrentFrame()
  const { fps } = useVideoConfig()
  const isDark  = mode === 'dark'

  const centerX = 960
  const centerY = 420
  const radius  = 220

  return (
    <AbsoluteFill
      style={{
        background: isDark
          ? '#0a0a0a'
          : 'radial-gradient(ellipse at 20% 20%, #ffe0e8 0%, #ffffff 50%)',
      }}
    >
      {/* Icons in a circle */}
      {icons.map((icon, i) => {
        const angle  = (i / icons.length) * Math.PI * 2 - Math.PI / 2
        const ix     = centerX + Math.cos(angle) * radius
        const iy     = centerY + Math.sin(angle) * radius
        const floatY = Math.sin((frame + i * 25) * 0.03) * 8
        const delay  = 10 + i * 8
        const prog   = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 10, stiffness: 100, mass: 0.6 } })

        return (
          <div
            key={i}
            style={{
              position:      'absolute',
              left:          ix - 36,
              top:           iy - 36 + floatY,
              width:         72,
              height:        72,
              borderRadius:  18,
              background:    isDark ? 'rgba(255,255,255,0.08)' : '#ffffff',
              boxShadow:     isDark ? '0 8px 24px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.08)',
              display:       'flex',
              alignItems:    'center',
              justifyContent:'center',
              fontSize:      32,
              opacity:       prog,
              transform:     `scale(${prog})`,
            }}
          >
            {icon.emoji}
          </div>
        )
      })}

      {/* Centre avatar */}
      {notification && (
        <div
          style={{
            position:     'absolute',
            left:         centerX - 40,
            top:          centerY - 40,
            width:        80,
            height:       80,
            borderRadius: '50%',
            overflow:     'hidden',
            border:       `3px solid ${isDark ? '#333' : '#fff'}`,
            boxShadow:    '0 4px 16px rgba(0,0,0,0.15)',
            opacity:      spring({ frame: Math.max(0, frame - 5), fps, config: { damping: 14 } }),
          }}
        >
          <img src={notification.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
        </div>
      )}

      {/* Notification bubble */}
      {notification && (
        <div
          style={{
            position:      'absolute',
            left:          centerX - 120,
            top:           centerY + 55,
            padding:       '8px 16px',
            borderRadius:  12,
            background:    isDark ? 'rgba(255,255,255,0.1)' : '#ffffff',
            boxShadow:     '0 4px 16px rgba(0,0,0,0.1)',
            fontSize:      14,
            color:         isDark ? '#fff' : '#333',
            display:       'flex',
            alignItems:    'center',
            gap:           8,
            opacity:       interpolate(frame, [50, 65], [0, 1], { extrapolateRight: 'clamp' }),
            transform:     `translateX(${interpolate(frame, [50, 65], [30, 0], { extrapolateRight: 'clamp' })}px)`,
          }}
        >
          <span style={{ fontSize: 16 }}>💬</span>
          {notification.text}
        </div>
      )}

      {/* Headline */}
      <div
        style={{
          position:  'absolute',
          bottom:    120,
          left:      0,
          right:     0,
          textAlign: 'center',
          opacity:   interpolate(frame, [40, 55], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        <h2 style={{
          fontSize:   48,
          fontWeight: 800,
          color:      isDark ? '#ffffff' : '#1a1a1a',
          maxWidth:   800,
          margin:     '0 auto',
        }}>
          {headline}
        </h2>
      </div>
    </AbsoluteFill>
  )
}
