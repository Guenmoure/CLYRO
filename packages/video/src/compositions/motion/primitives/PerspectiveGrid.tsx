import React from 'react'
import { useCurrentFrame, AbsoluteFill } from 'remotion'

interface PerspectiveGridProps {
  color?:      string
  opacity?:    number
  lineCount?:  number
  mode:        'dark' | 'light'
}

export const PerspectiveGrid: React.FC<PerspectiveGridProps> = ({
  color, opacity = 0.15, lineCount = 12, mode,
}) => {
  const frame = useCurrentFrame()
  const lineColor = color ?? (mode === 'dark' ? '#ff6b00' : '#e0e0e0')
  const scrollOffset = (frame * 0.5) % 100

  return (
    <AbsoluteFill style={{ perspective: '800px', perspectiveOrigin: '50% 30%', pointerEvents: 'none' }}>
      <div
        style={{
          position:        'absolute',
          bottom:          0,
          left:            '-20%',
          right:           '-20%',
          height:          '55%',
          transform:       'rotateX(65deg)',
          transformOrigin: 'bottom center',
        }}
      >
        <svg width="100%" height="100%" style={{ opacity }}>
          {Array.from({ length: lineCount }, (_, i) => {
            const rowSize = 100 / lineCount
            const y = i * rowSize + (scrollOffset % rowSize)
            return (
              <line
                key={`h-${i}`}
                x1="0%"
                y1={`${y}%`}
                x2="100%"
                y2={`${y}%`}
                stroke={lineColor}
                strokeWidth={0.5}
              />
            )
          })}
          {Array.from({ length: lineCount + 4 }, (_, i) => {
            const x = (i / (lineCount + 4)) * 100
            return (
              <line
                key={`v-${i}`}
                x1={`${x}%`}
                y1="0%"
                x2={`${x}%`}
                y2="100%"
                stroke={lineColor}
                strokeWidth={0.5}
              />
            )
          })}
        </svg>
      </div>
    </AbsoluteFill>
  )
}
