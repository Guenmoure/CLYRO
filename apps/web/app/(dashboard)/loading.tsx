/**
 * Shared loading skeleton for every route inside the (dashboard) group.
 * Individual routes can still provide a more specific loading.tsx; when
 * absent, this generic skeleton is shown during streaming / data fetches.
 */

export default function DashboardGroupLoading() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto space-y-5 animate-pulse">
      {/* Greeting row */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-6 w-48 rounded-lg bg-muted" />
          <div className="h-4 w-32 rounded bg-muted/70" />
        </div>
        <div className="h-9 w-32 rounded-xl bg-muted" />
      </div>

      {/* Credits banner */}
      <div className="h-14 rounded-xl bg-muted" />

      {/* Quick actions row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="h-20 rounded-2xl bg-muted" />
        <div className="h-20 rounded-2xl bg-muted" />
        <div className="h-20 rounded-2xl bg-muted" />
        <div className="h-20 rounded-2xl bg-muted" />
      </div>

      {/* Projects grid */}
      <div className="space-y-3">
        <div className="h-5 w-40 rounded bg-muted" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-video rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    </div>
  )
}
