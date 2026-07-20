import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-ink text-white hover:bg-ink/90",
        secondary: "border-border bg-surface-2 text-ink-2",
        destructive: "border-transparent bg-danger/10 text-danger",
        outline: "border-border text-ink-2",
        moss: "border-transparent bg-moss/10 text-moss-2",
        amber: "border-transparent bg-warning/10 text-warning",
        warm: "border-brand/20 bg-tint text-brand-2",
        info: "border-transparent bg-info/10 text-info",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "moss" | "amber" | "warm" | "info";
}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
