import React from 'react'
import { useCurrentFrame, AbsoluteFill, interpolate } from 'remotion'

interface ParticlesDef {
  x:     number
  baseY: number
  r:     number
  speed: number
  phase: number
}

function generateParticles(count: number, width: number, height: number): ParticlesDef[] {
  const out: ParticlesDef[] = []
  for (let i = 0; i < count; i++) {
    const h1 = Math.sin(i * 12.9898 + 78.233) * 43758.5453
    const r1 = h1 - Math.floor(h1)
    const h2 = Math.sin(i * 45.164 + 34.756) * 28573.2846
    const r2 = h2 - Math.floor(h2)
    out.push({
      x:     r1 * width,
      baseY: r2 * height,
      r:     1 + r1 * 2.5,
      speed: 0.01 + r2 * 0.025,
      phase: i * 40,
    })
  }
  return out
}

interface ParticlesProps {
  count?:     number
  color?:     string
  maxRadius?: number
  mode:       'dark' | 'light'
  width?:     number
  height?:    number
}

export const Particles: React.FC<ParticlesProps> = ({
  count = 40, color, maxRadius = 3, mode, width = 1920, height = 1080,
}) => {
  const frame    = useCurrentFrame()
  const fillColor = color ?? (mode === 'dark' ? '#ffffff' : '#000000')
  const particles = generateParticles(count, width, height)

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
        {particles.map((p, i) => {
          const cy      = p.baseY + Math.sin((frame + p.phase) * p.speed) * 20
          const opacity = interpolate(
            Math.sin((frame + i * 15) * 0.012),
            [-1, 1],
            [0.05, 0.4],
          )
          return (
            <circle
              key={i}
              cx={p.x}
              cy={cy}
              r={Math.min(p.r, maxRadius)}
              fill={fillColor}
              opacity={opacity}
            />
          )
        })}
      </svg>
    </AbsoluteFill>
  )
}
