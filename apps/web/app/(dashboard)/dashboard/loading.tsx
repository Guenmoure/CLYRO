/**
 * Dashboard loading skeleton — matches the new dashboard structure:
 *   1. Greeting row + "New" button
 *   2. PromoBanner (48px strip)
 *   3. CreditsBanner (54px strip)
 *   4. QuickActions (4 cards × 1 row)
 *   5. Project grid (8 cards)
 */
export default function DashboardLoading() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto space-y-8">

      {/* ── Greeting row ──────────────────────────────────────── */}
      <div className="flex items-center justify-between h-9">
        <div className="h-4 w-44 bg-muted rounded-lg animate-shimmer" />
        <div className="h-9 w-24 bg-muted rounded-xl animate-shimmer" />
      </div>

      {/* ── PromoBanner strip ─────────────────────────────────── */}
      <div className="h-12 w-full bg-muted rounded-2xl animate-shimmer" />

      {/* ── CreditsBanner strip ───────────────────────────────── */}
      <div className="h-14 w-full bg-muted rounded-2xl animate-shimmer" />

      {/* ── QuickActions — 4 cards ────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-muted animate-shimmer overflow-hidden h-36" />
        ))}
      </div>

      {/* ── Project grid ─────────────────────────────────────── */}
      <div className="space-y-4">
        {/* Section header */}
        <div className="flex items-center justify-between">
          <div className="h-5 w-32 bg-muted rounded-lg animate-shimmer" />
          <div className="h-7 w-20 bg-muted rounded-lg animate-shimmer" />
        </div>

        {/* Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-muted animate-shimmer overflow-hidden">
              <div className="aspect-video bg-border/60" />
              <div className="px-3 py-3 space-y-1.5">
                <div className="h-4 w-3/4 bg-border/60 rounded" />
                <div className="h-3 w-1/2 bg-border/60 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
