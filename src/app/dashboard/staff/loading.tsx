export default function StaffLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-36 rounded-lg bg-surface-2 border border-border" />
        <div className="h-9 w-32 rounded-lg bg-surface-2 border border-border" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-36 rounded-xl bg-surface-2 border border-border" />
        ))}
      </div>
    </div>
  )
}
