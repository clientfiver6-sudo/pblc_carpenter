export default function AutomationsLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 rounded-lg bg-surface-2 border border-border" />
        <div className="h-9 w-36 rounded-lg bg-surface-2 border border-border" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-surface-2 border border-border" />
        ))}
      </div>
    </div>
  )
}
