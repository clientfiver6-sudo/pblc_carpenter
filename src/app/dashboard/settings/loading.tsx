export default function SettingsLoading() {
  return (
    <div className="space-y-6 animate-pulse max-w-2xl">
      <div className="h-8 w-32 rounded-lg bg-surface-2 border border-border" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-surface-2 border border-border" />
        ))}
      </div>
    </div>
  )
}
