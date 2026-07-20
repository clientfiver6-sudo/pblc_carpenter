export default function WorkItemDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-surface-2 border border-border" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-48 rounded-xl bg-surface-2 border border-border" />
          <div className="h-48 rounded-xl bg-surface-2 border border-border" />
        </div>
        <div className="h-64 rounded-xl bg-surface-2 border border-border" />
      </div>
    </div>
  )
}
