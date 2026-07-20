export default function CustomersLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-36 rounded-lg bg-surface-2 border border-border" />
        <div className="h-9 w-36 rounded-lg bg-surface-2 border border-border" />
      </div>
      {/* Search bar skeleton */}
      <div className="h-10 w-full max-w-sm rounded-lg bg-surface-2 border border-border" />
      {/* Row skeletons */}
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-20 rounded-xl bg-surface-2 border border-border"
          />
        ))}
      </div>
    </div>
  )
}
