export default function CanvasLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-36 rounded-lg bg-surface-2 border border-border" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-72 rounded-xl bg-surface-2 border border-border" />
        <div className="h-72 rounded-xl bg-surface-2 border border-border" />
      </div>
      <div className="h-72 rounded-xl bg-surface-2 border border-border" />
    </div>
  )
}
