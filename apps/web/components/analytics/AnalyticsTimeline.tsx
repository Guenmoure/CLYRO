'use client'

import { useMemo } from 'react'

interface Point {
  date: string  // YYYY-MM-DD
  count: number
}

/**
 * Lightweight 30-day activity bar chart. Pure CSS grid — no chart dep.
 * Accessible: exposes a hidden <table> summary so screen readers can read
 * the underlying data.
 */
export function AnalyticsTimeline({ points }: { points: Point[] }) {
  const max = useMemo(() => Math.max(1, ...points.map(p => p.count)), [points])

  return (
    <div>
      <div
        role="img"
        aria-label={`Activity over the last ${points.length} days, ranging from 0 to ${max} videos per day`}
        className="flex items-end gap-1 h-24"
      >
        {points.map(p => {
          const pct = (p.count / max) * 100
          const heightStyle = p.count === 0
            ? { height: '2px' }
            : { height: `${Math.max(6, pct)}%` }
          return (
            <div
              key={p.date}
              className="flex-1 rounded-t-sm bg-blue-500/60 hover:bg-blue-400 transition-colors relative group"
              style={heightStyle}
            >
              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 whitespace-nowrap font-mono text-[10px] text-foreground bg-card border border-border rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {p.count} · {p.date.slice(5)}
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-[--text-muted]">
        <span>{points[0]?.date.slice(5) ?? ''}</span>
        <span>{points[points.length - 1]?.date.slice(5) ?? ''}</span>
      </div>
      {/* Screen-reader table */}
      <table className="sr-only">
        <caption>Videos generated per day, last {points.length} days</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Videos</th>
          </tr>
        </thead>
        <tbody>
          {points.map(p => (
            <tr key={p.date}>
              <th scope="row">{p.date}</th>
              <td>{p.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
