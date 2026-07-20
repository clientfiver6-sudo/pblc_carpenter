import type { Transition, Variants } from "motion/react"

// ── Spring presets ─────────────────────────────────────────────────────────────
// snappy  → buttons, badges, small interactive elements   (80–120ms feel)
// smooth  → cards, panels, modals                         (200–250ms feel)
// loose   → page transitions                              (300–400ms feel)
// drawer  → sidebars, sheets                              (320ms feel)

export const spring = {
  snappy: { type: "spring", stiffness: 400, damping: 28 } satisfies Transition,
  smooth: { type: "spring", stiffness: 280, damping: 28 } satisfies Transition,
  loose:  { type: "spring", stiffness: 200, damping: 26 } satisfies Transition,
  drawer: { type: "spring", stiffness: 340, damping: 34 } satisfies Transition,
} as const

// ── Reusable animation variants ────────────────────────────────────────────────

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  show:   { opacity: 1, y: 0, transition: spring.smooth },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.18, ease: "easeOut" } },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.93 },
  show:   { opacity: 1, scale: 1, transition: spring.smooth },
}

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: spring.loose },
  exit:   { opacity: 0, y: 12, transition: { duration: 0.15, ease: "easeIn" } },
}

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.055,
      delayChildren: 0.04,
    },
  },
}

// ── Modal / dialog ─────────────────────────────────────────────────────────────

export const dialogVariants: Variants = {
  hidden: { opacity: 0, scale: 0.94, y: 8 },
  show:   { opacity: 1, scale: 1, y: 0, transition: spring.smooth },
  exit:   { opacity: 0, scale: 0.97, y: -4, transition: { duration: 0.16, ease: "easeIn" } },
}

export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.18, ease: "easeOut" } },
  exit:   { opacity: 0, transition: { duration: 0.16, ease: "easeIn" } },
}

// ── Sidebar drawer ─────────────────────────────────────────────────────────────

export const sidebarVariants: Variants = {
  hidden: { x: -256, opacity: 0 },
  show:   { x: 0, opacity: 1, transition: spring.drawer },
  exit:   { x: -256, opacity: 0, transition: { duration: 0.2, ease: "easeIn" } },
}

export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.2 } },
  exit:   { opacity: 0, transition: { duration: 0.18 } },
}
