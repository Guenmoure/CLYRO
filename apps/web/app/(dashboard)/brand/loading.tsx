export default function BrandLoading() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto space-y-5 animate-pulse">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-4 w-20 rounded bg-muted/70" />
          <div className="h-7 w-40 rounded-lg bg-muted" />
          <div className="h-4 w-64 rounded bg-muted/50" />
        </div>
        <div className="h-10 w-32 rounded-xl bg-muted" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-48 rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  )
}
