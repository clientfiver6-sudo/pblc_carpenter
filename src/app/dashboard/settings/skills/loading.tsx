export default function SkillsSettingsLoading() {
  return (
    <div className="space-y-4 animate-pulse max-w-2xl">
      <div className="h-8 w-36 rounded-lg bg-surface-2 border border-border" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-surface-2 border border-border" />
        ))}
      </div>
    </div>
  )
}
