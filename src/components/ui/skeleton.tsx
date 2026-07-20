import { cn } from "@/lib/utils"

function Skeleton({
  className,
  delay,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { delay?: number }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      style={{ animationDelay: delay ? `${delay}ms` : undefined }}
      {...props}
    />
  )
}

export { Skeleton }
