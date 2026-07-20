export default function TeamTasksLoading() {
  return (
    <div className="h-[calc(100vh-56px)] flex flex-col">
      <div className="flex items-center justify-between px-8 py-5 border-b border-border">
        <div className="h-7 w-48 bg-surface-2 rounded animate-pulse" />
        <div className="h-6 w-32 bg-surface-2 rounded-full animate-pulse" />
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="w-full md:w-[380px] border-r border-border p-4 space-y-3 overflow-y-auto">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface p-4 space-y-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-surface-2" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-32 bg-surface-2 rounded" />
                  <div className="h-3 w-20 bg-surface-2 rounded" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-6 w-20 bg-surface-2 rounded-full" />
                <div className="h-6 w-20 bg-surface-2 rounded-full" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex-1 hidden md:flex items-center justify-center text-ink-4 text-sm">
          Selecione um colaborador
        </div>
      </div>
    </div>
  )
}
