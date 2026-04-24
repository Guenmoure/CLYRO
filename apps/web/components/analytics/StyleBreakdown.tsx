interface Entry {
  style: string
  count: number
}

/**
 * Horizontal "bar row" breakdown. Server-safe (no hooks).
 * Progress bar width encodes share of the top-max style, so the
 * most-used style always fills the row.
 */
export function StyleBreakdown({ entries, total }: { entries: Entry[]; total: number }) {
  const max = Math.max(1, ...entries.map(e => e.count))
  return (
    <ul className="space-y-2.5">
      {entries.map(e => {
        const pct = Math.round((e.count / max) * 100)
        const share = total > 0 ? Math.round((e.count / total) * 100) : 0
        return (
          <li key={e.style} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-body text-xs text-foreground capitalize truncate">
                {e.style.replace(/[-_]/g, ' ')}
              </span>
              <span className="font-mono text-[11px] text-[--text-muted] shrink-0">
                {e.count} · {share}%
              </span>
            </div>
            <div
              className="h-1.5 rounded-full bg-muted overflow-hidden"
              role="progressbar"
              aria-valuenow={share}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${e.style}: ${e.count} videos, ${share} percent of total`}
            >
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-[width]"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
