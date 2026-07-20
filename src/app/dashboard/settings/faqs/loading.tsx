export default function FAQsSettingsLoading() {
  return (
    <div className="space-y-4 animate-pulse max-w-2xl">
      <div className="h-8 w-40 rounded-lg bg-surface-2 border border-border" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-surface-2 border border-border" />
        ))}
      </div>
    </div>
  )
}
