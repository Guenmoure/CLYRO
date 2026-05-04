export default function AssetsLoading() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto space-y-5 animate-pulse">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-4 w-16 rounded bg-muted/70" />
          <div className="h-7 w-36 rounded-lg bg-muted" />
        </div>
        <div className="h-9 w-28 rounded-xl bg-muted" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/50 w-fit">
        <div className="h-8 w-20 rounded-lg bg-muted" />
        <div className="h-8 w-20 rounded-lg bg-muted/50" />
        <div className="h-8 w-20 rounded-lg bg-muted/50" />
      </div>

      {/* Asset grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  )
}
