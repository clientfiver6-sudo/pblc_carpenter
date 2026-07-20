"use client"

import { motion } from "motion/react"
import { staggerContainer, fadeUp, scaleIn, spring } from "@/lib/motion"

// ── PageTransition ─────────────────────────────────────────────────────────────
// Wraps the top-level content of a page with a stagger container.
// Direct children that use <FadeUp> or <ScaleIn> will animate in sequence.

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="h-full"
    >
      {children}
    </motion.div>
  )
}

// ── FadeUp ─────────────────────────────────────────────────────────────────────
// Fades and slides content up. Use inside a PageTransition for staggering,
// or standalone for one-off entrance animations.

interface FadeUpProps {
  children: React.ReactNode
  delay?: number
  className?: string
}

export function FadeUp({ children, delay = 0, className }: FadeUpProps) {
  return (
    <motion.div
      variants={fadeUp}
      transition={delay ? { delay } : undefined}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ── ScaleIn ────────────────────────────────────────────────────────────────────
// Scales and fades content in. Good for cards and modal-like elements.

interface ScaleInProps {
  children: React.ReactNode
  delay?: number
  className?: string
}

export function ScaleIn({ children, delay = 0, className }: ScaleInProps) {
  return (
    <motion.div
      variants={scaleIn}
      transition={delay ? { delay } : undefined}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ── AnimatedNumber ─────────────────────────────────────────────────────────────
// Spring-animated number counter for stat cards.

interface AnimatedNumberProps {
  value: number
  className?: string
  prefix?: string
  suffix?: string
  format?: (v: number) => string
}

export function AnimatedNumber({ value, className, prefix = "", suffix = "", format }: AnimatedNumberProps) {
  const display = format ? format(value) : String(value)
  return (
    <motion.span
      className={className}
      key={value}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.smooth}
    >
      {prefix}{display}{suffix}
    </motion.span>
  )
}
