import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion'

/**
 * Single datum for the chart — label + numeric value. If you want a percentage
 * display, set `suffix: '%'`. Values don't need to be normalized; the component
 * scales bars against the max in the list.
 */
export interface ChartBar {
  label: string
  value: number
  color?: string       // optional per-bar colour; otherwise palette rotates
  suffix?: string      // e.g. "%", "€", "M"
}

export interface InfographicChartProps {
  title?: string
  subtitle?: string
  bars: ChartBar[]
  /** durationFrames: total scene duration — bars stagger across the first 60%. */
  durationFrames?: number
  /** Palette for bars that didn't specify a colour. Falls back to a clean set. */
  palette?: string[]
  background?: string
  textColor?: string
  axisColor?: string
}

const DEFAULT_PALETTE = ['#3B8EF0', '#A855F7', '#22C55E', '#F59E0B', '#EF4444', '#06B6D4']

/**
 * Clean animated horizontal bar chart for faceless/infographie scenes.
 *
 * Rendered entirely in React/SVG via Remotion so the numbers are PIXEL-PERFECT
 * — no diffusion model, no OCR issues. Intended to be dropped into a Remotion
 * render (`renderMedia({ composition: 'InfographicChart-16-9', inputProps })`)
 * to produce a clip that can be concatenated alongside Kling/Ken Burns scenes.
 *
 * Animation:
 *   - title fades in over 15 frames
 *   - each bar width springs in with a staggered delay (per-bar)
 *   - value counts up in sync with the bar's width
 */
export const InfographicChart: React.FC<InfographicChartProps> = ({
  title,
  subtitle,
  bars,
  durationFrames = 150,
  palette = DEFAULT_PALETTE,
  background = '#0B1020',
  textColor = '#F5F7FA',
  axisColor = 'rgba(245,247,250,0.18)',
}) => {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()

  const maxValue = Math.max(1, ...bars.map((b) => b.value))
  const barCount = bars.length
  const staggerPerBar = Math.max(4, Math.round((durationFrames * 0.35) / Math.max(1, barCount)))

  // Layout constants — percentages of the frame so it works across 16:9/9:16/1:1.
  const padX    = Math.round(width * 0.08)
  const padTop  = Math.round(height * (title ? 0.15 : 0.08))
  const padBot  = Math.round(height * 0.08)
  const titleH  = title ? Math.round(height * 0.12) : 0
  const chartY  = padTop + titleH
  const chartH  = height - chartY - padBot
  const chartW  = width - padX * 2
  const barGap  = Math.round(chartH * 0.04)
  const barH    = Math.max(24, (chartH - barGap * (barCount - 1)) / Math.max(1, barCount))
  const labelW  = Math.round(chartW * 0.28)   // left column reserved for labels
  const trackW  = chartW - labelW - Math.round(chartW * 0.08) // right gutter for value

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' })
  const titleY = interpolate(frame, [0, 15], [-20, 0], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{ backgroundColor: background, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
        {/* Title + subtitle */}
        {title && (
          <g transform={`translate(${padX}, ${padTop + titleY})`} opacity={titleOpacity}>
            <text
              x={0}
              y={0}
              dominantBaseline="hanging"
              fontSize={Math.round(height * 0.055)}
              fontWeight={700}
              fill={textColor}
            >
              {title}
            </text>
            {subtitle && (
              <text
                x={0}
                y={Math.round(height * 0.065)}
                dominantBaseline="hanging"
                fontSize={Math.round(height * 0.028)}
                fontWeight={400}
                fill={textColor}
                opacity={0.6}
              >
                {subtitle}
              </text>
            )}
          </g>
        )}

        {/* Axis guide */}
        <line
          x1={padX + labelW}
          x2={padX + labelW}
          y1={chartY}
          y2={chartY + chartH}
          stroke={axisColor}
          strokeWidth={2}
        />

        {/* Bars */}
        {bars.map((bar, i) => {
          const y = chartY + i * (barH + barGap)
          const barDelay = i * staggerPerBar
          const t = spring({
            frame: frame - barDelay,
            fps,
            config: { damping: 14, mass: 0.8, stiffness: 90 },
          })
          const ratio = Math.max(0, Math.min(1, bar.value / maxValue))
          const barW = trackW * ratio * t
          const animatedValue = Math.round(bar.value * t * 100) / 100
          const color = bar.color ?? palette[i % palette.length]

          return (
            <g key={`${bar.label}-${i}`}>
              {/* Label (left) */}
              <text
                x={padX + labelW - 16}
                y={y + barH / 2}
                dominantBaseline="central"
                textAnchor="end"
                fontSize={Math.round(barH * 0.42)}
                fontWeight={600}
                fill={textColor}
              >
                {bar.label}
              </text>

              {/* Track background */}
              <rect
                x={padX + labelW}
                y={y}
                width={trackW}
                height={barH}
                rx={Math.round(barH * 0.18)}
                fill={axisColor}
                opacity={0.5}
              />

              {/* Animated bar */}
              <rect
                x={padX + labelW}
                y={y}
                width={barW}
                height={barH}
                rx={Math.round(barH * 0.18)}
                fill={color}
              />

              {/* Value (right of bar, moves with the bar head) */}
              <text
                x={padX + labelW + barW + 12}
                y={y + barH / 2}
                dominantBaseline="central"
                textAnchor="start"
                fontSize={Math.round(barH * 0.46)}
                fontWeight={700}
                fill={textColor}
                opacity={t}
              >
                {`${animatedValue}${bar.suffix ?? ''}`}
              </text>
            </g>
          )
        })}
      </svg>
    </AbsoluteFill>
  )
}

export default InfographicChart
