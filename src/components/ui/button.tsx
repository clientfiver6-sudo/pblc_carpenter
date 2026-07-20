"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"
import { spring } from "@/lib/motion"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-[13.5px] font-semibold ring-offset-background transition-[color,background-color] duration-150 ease-brand-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border",
  {
    variants: {
      variant: {
        default:     "bg-ink text-white hover:bg-ink/90 border-transparent",
        destructive: "bg-danger/10 text-danger hover:bg-danger/20 border-transparent",
        outline:     "border border-border bg-surface text-ink hover:bg-surface-2 hover:text-ink",
        secondary:   "bg-surface-2 text-ink-2 border-border hover:bg-border",
        ghost:       "text-ink-2 hover:bg-surface-2 hover:text-ink border-transparent",
        link:        "text-brand underline-offset-4 hover:underline border-transparent",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm:      "h-8 rounded-md px-3 text-xs",
        lg:      "h-11 rounded-md px-6 text-base",
        icon:    "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        />
      )
    }
    return (
      <motion.button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        whileHover={{ scale: 1.018 }}
        whileTap={{ scale: 0.964 }}
        transition={spring.snappy}
        {...(props as React.ComponentProps<typeof motion.button>)}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
