export default function CalendarLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 rounded-lg bg-surface-2 border border-border" />
        <div className="flex gap-2">
          <div className="h-9 w-24 rounded-lg bg-surface-2 border border-border" />
          <div className="h-9 w-24 rounded-lg bg-surface-2 border border-border" />
        </div>
      </div>
      <div className="h-[600px] rounded-xl bg-surface-2 border border-border" />
    </div>
  )
}
