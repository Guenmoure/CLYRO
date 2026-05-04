export default function ProjectsLoading() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto space-y-5 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-4 w-20 rounded bg-muted/70" />
          <div className="h-7 w-48 rounded-lg bg-muted" />
        </div>
        <div className="h-9 w-28 rounded-xl bg-muted" />
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="h-8 w-20 rounded-lg bg-muted" />
        <div className="h-8 w-24 rounded-lg bg-muted" />
        <div className="h-8 w-16 rounded-lg bg-muted" />
        <div className="flex-1" />
        <div className="h-8 w-48 rounded-lg bg-muted" />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="aspect-video rounded-2xl bg-muted" />
            <div className="h-4 w-3/4 rounded bg-muted/70" />
            <div className="h-3 w-1/2 rounded bg-muted/50" />
          </div>
        ))}
      </div>
    </div>
  )
}
