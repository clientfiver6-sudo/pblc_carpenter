export default function PaymentsLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-36 rounded-lg bg-surface-2 border border-border" />
        <div className="h-9 w-32 rounded-lg bg-surface-2 border border-border" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-8 w-24 rounded-lg bg-surface-2 border border-border" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-surface-2 border border-border" />
        ))}
      </div>
    </div>
  )
}
