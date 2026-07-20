export default function CustomerDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-surface-2 border border-border" />
        <div className="space-y-2">
          <div className="h-6 w-40 rounded-lg bg-surface-2 border border-border" />
          <div className="h-4 w-28 rounded-lg bg-surface-2 border border-border" />
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-surface-2 border border-border" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-surface-2 border border-border" />
    </div>
  )
}
