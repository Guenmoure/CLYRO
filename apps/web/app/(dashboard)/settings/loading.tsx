export default function SettingsLoading() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-3xl mx-auto space-y-6 animate-pulse">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-3 w-16 rounded bg-muted/70" />
        <div className="h-8 w-32 rounded-lg bg-muted" />
        <div className="h-4 w-64 rounded bg-muted/50" />
      </div>

      {/* Profile card */}
      <div className="h-64 rounded-2xl bg-muted" />

      {/* Link cards */}
      <div className="h-20 rounded-2xl bg-muted" />
      <div className="h-20 rounded-2xl bg-muted" />

      {/* Security card */}
      <div className="h-40 rounded-2xl bg-muted" />
    </div>
  )
}
