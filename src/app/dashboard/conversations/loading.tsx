export default function ConversationsLoading() {
  return (
    <div className="flex h-full gap-0 animate-pulse overflow-hidden rounded-xl border border-border">
      {/* Left panel — conversation list */}
      <div className="w-80 shrink-0 border-r border-border bg-surface space-y-3 p-3">
        {/* Search bar */}
        <div className="h-9 rounded-lg bg-surface-2 border border-border" />
        {/* Conversation items */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-surface-2 border border-border" />
        ))}
      </div>
      {/* Right panel — message thread */}
      <div className="flex-1 bg-surface flex flex-col">
        {/* Header */}
        <div className="h-14 border-b border-border m-4 rounded-lg bg-surface-2" />
        {/* Messages */}
        <div className="flex-1 space-y-3 px-4 pb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`h-12 w-2/3 rounded-xl bg-surface-2 border border-border ${
                i % 2 === 0 ? "ml-0" : "ml-auto"
              }`}
            />
          ))}
        </div>
        {/* Input */}
        <div className="h-14 mx-4 mb-4 rounded-lg bg-surface-2 border border-border" />
      </div>
    </div>
  )
}
