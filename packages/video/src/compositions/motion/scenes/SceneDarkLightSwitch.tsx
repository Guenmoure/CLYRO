import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion'
import type { SceneDarkLightProps } from '../lib/motion-types'

export const SceneDarkLightSwitch: React.FC<SceneDarkLightProps> = ({
  direction, style = 'flash',
}) => {
  const frame       = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const mid         = Math.floor(durationInFrames / 2)

  const fromColor   = direction === 'dark_to_light' ? '#000000' : '#ffffff'
  const toColor     = direction === 'dark_to_light' ? '#ffffff' : '#000000'

  if (style === 'flash') {
    // 6-frame brutal flash at the midpoint
    const flashProgress = interpolate(frame, [mid - 3, mid + 3], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    })
    const bg = flashProgress < 0.5 ? fromColor : toColor
    const flashBrightness = 1 + Math.sin(flashProgress * Math.PI) * 1.5

    return (
      <AbsoluteFill style={{ background: bg, filter: `brightness(${flashBrightness})` }}>
        {/* Flash white overlay */}
        <AbsoluteFill style={{
          background: '#ffffff',
          opacity:    Math.sin(flashProgress * Math.PI) * 0.9,
        }} />
      </AbsoluteFill>
    )
  }

  if (style === 'wipe') {
    const wipeX = interpolate(frame, [0, durationInFrames], [0, 1920], {
      extrapolateRight: 'clamp',
    })
    return (
      <AbsoluteFill style={{ background: fromColor }}>
        <div style={{
          position:   'absolute',
          top:        0,
          left:       0,
          width:      wipeX,
          height:     '100%',
          background: toColor,
        }} />
      </AbsoluteFill>
    )
  }

  // circle_reveal
  const prog   = spring({ frame, fps, config: { damping: 20, stiffness: 60 } })
  const radius = interpolate(prog, [0, 1], [0, 1600])

  return (
    <AbsoluteFill style={{ background: fromColor }}>
      <svg width="100%" height="100%" viewBox="0 0 1920 1080">
        <defs>
          <clipPath id="circle-reveal">
            <circle cx={960} cy={540} r={radius} />
          </clipPath>
        </defs>
        <rect
          x={0} y={0} width={1920} height={1080}
          fill={toColor}
          clipPath="url(#circle-reveal)"
        />
      </svg>
    </AbsoluteFill>
  )
}
