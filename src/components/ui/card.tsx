"use client"

import * as React from "react"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"
import { spring } from "@/lib/motion"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border border-border bg-surface text-card-foreground shadow-1",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

// Interactive card — uses spring physics for hover lift and press feedback.
// Use in place of Card whenever the card is clickable or meaningfully interactive.
interface MotionCardProps {
  className?: string
  children?: React.ReactNode
  onClick?: React.MouseEventHandler<HTMLDivElement>
  style?: React.CSSProperties
  id?: string
  "aria-label"?: string
}

function MotionCard({ className, children, ...props }: MotionCardProps) {
  return (
    <motion.div
      className={cn(
        "rounded-lg border border-border bg-surface text-card-foreground shadow-1 cursor-pointer",
        className
      )}
      whileHover={{ y: -2, boxShadow: "var(--shadow-hover)" }}
      whileTap={{ y: 0, scale: 0.99, boxShadow: "var(--shadow-press)" }}
      transition={spring.smooth}
      {...props}
    >
      {children}
    </motion.div>
  )
}
MotionCard.displayName = "MotionCard"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-2xl font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-4 pt-0 sm:p-6 sm:pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, MotionCard, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
