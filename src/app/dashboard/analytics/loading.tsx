export default function AnalyticsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="h-8 w-32 rounded-lg bg-surface-2 border border-border" />
      {/* 4 metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-surface-2 border border-border" />
        ))}
      </div>
      {/* 2 chart placeholders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-72 rounded-xl bg-surface-2 border border-border" />
        <div className="h-72 rounded-xl bg-surface-2 border border-border" />
      </div>
    </div>
  )
}
