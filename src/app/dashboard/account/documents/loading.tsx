export default function DocumentsLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-36 rounded-lg bg-surface-2 border border-border" />
      <div className="h-32 rounded-xl bg-surface-2 border border-border" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-surface-2 border border-border" />
        ))}
      </div>
    </div>
  )
}
