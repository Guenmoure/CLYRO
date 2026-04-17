/**
 * Dashboard loading skeleton — matches new layout:
 *   1. Promo strip
 *   2. Greeting + button
 *   3. Credits strip
 *   4. Quick actions (4 cards)
 *   5. Projects section header + grid
 *
 * Total above-fold height: ~274px → projects start in viewport on first render.
 */
export default function DashboardLoading() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto space-y-5 animate-pulse">

      {/* Promo strip */}
      <div className="h-11 rounded-xl bg-muted" />

      {/* Greeting + button */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-44 rounded-lg bg-muted" />
          <div className="h-4 w-28 rounded bg-muted/60" />
        </div>
        <div className="h-9 w-32 rounded-xl bg-muted" />
      </div>

      {/* Credits strip */}
      <div className="h-14 rounded-xl bg-muted" />

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="h-28 rounded-2xl bg-muted"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>

      {/* Projects section */}
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-5 w-28 rounded-lg bg-muted" />
          <div className="h-7 w-32 rounded-xl bg-muted/70" />
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div
              key={i}
              className="rounded-2xl overflow-hidden"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="aspect-video bg-muted" />
              <div className="p-3 space-y-2">
                <div className="h-4 w-3/4 rounded bg-muted/80" />
                <div className="h-3 w-1/2 rounded bg-muted/50" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
