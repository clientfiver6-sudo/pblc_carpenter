export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-surface-2 border border-border" />
        ))}
      </div>
      {/* Content blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-64 rounded-xl bg-surface-2 border border-border" />
        <div className="h-64 rounded-xl bg-surface-2 border border-border" />
      </div>
    </div>
  )
}
