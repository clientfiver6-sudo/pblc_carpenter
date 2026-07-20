export default function SubscriptionSettingsLoading() {
  return (
    <div className="space-y-6 animate-pulse max-w-2xl">
      <div className="h-8 w-40 rounded-lg bg-surface-2 border border-border" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="h-64 rounded-xl bg-surface-2 border border-border" />
        <div className="h-64 rounded-xl bg-surface-2 border border-border" />
      </div>
    </div>
  )
}
