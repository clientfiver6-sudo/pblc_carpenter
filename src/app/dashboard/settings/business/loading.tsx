export default function BusinessSettingsLoading() {
  return (
    <div className="space-y-6 animate-pulse max-w-2xl">
      <div className="h-8 w-40 rounded-lg bg-surface-2 border border-border" />
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-surface-2 border border-border" />
        ))}
      </div>
    </div>
  )
}
