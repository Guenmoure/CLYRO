export default function DashboardLoading() {
  return (
    <div className="px-6 py-8 max-w-7xl mx-auto space-y-10">

      {/* Welcome header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-muted rounded-xl animate-shimmer" />
          <div className="h-4 w-64 bg-muted rounded-lg animate-shimmer" />
        </div>
        <div className="h-9 w-36 bg-muted rounded-xl animate-shimmer" />
      </div>

      {/* Plan banner skeleton */}
      <div className="h-16 w-full bg-muted rounded-2xl animate-shimmer" />

      {/* Three module sections */}
      {Array.from({ length: 3 }).map((_, si) => (
        <div key={si} className="space-y-4">
          {/* Section header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-muted rounded-xl animate-shimmer" />
              <div className="space-y-1.5">
                <div className="h-5 w-36 bg-muted rounded-lg animate-shimmer" />
                <div className="h-3 w-28 bg-muted rounded animate-shimmer" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-7 w-20 bg-muted rounded-lg animate-shimmer" />
              <div className="h-7 w-20 bg-muted rounded-lg animate-shimmer" />
            </div>
          </div>

          {/* Card grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, ci) => (
              <div key={ci} className="rounded-2xl bg-muted animate-shimmer overflow-hidden">
                <div className="aspect-video bg-border" />
                <div className="px-3 py-3 space-y-1.5">
                  <div className="h-4 w-3/4 bg-border rounded" />
                  <div className="h-3 w-1/2 bg-border rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
