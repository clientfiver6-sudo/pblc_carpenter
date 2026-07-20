import type { CSSProperties } from "react"

type Variant = "default" | "mono-ink" | "mono-white" | "outline"

interface BrandMarkProps {
  size?: number
  variant?: Variant
  className?: string
}

function tileStyle(size: number, variant: Variant): CSSProperties {
  const radius = size <= 40 ? Math.round(size * 0.32) : Math.round(size * 0.30)
  const base: CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius,
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  }
  if (variant === "default") return {
    ...base,
    background: "var(--brand-grad)",
    color: "#fff",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.30), 0 6px 16px -6px rgba(232,93,31,.55)",
  }
  if (variant === "mono-ink") return { ...base, background: "#181613", color: "#fff" }
  if (variant === "mono-white") return {
    ...base,
    background: "#fff",
    color: "#181613",
    boxShadow: "inset 0 0 0 1px rgba(0,0,0,.06)",
  }
  // outline
  return { ...base, background: "transparent", color: "var(--brand)", boxShadow: "inset 0 0 0 1.5px currentColor" }
}

export function BrandMark({ size = 34, variant = "default", className }: BrandMarkProps) {
  const inner = Math.round(size * 0.53)
  const sw = size <= 20 ? 3.0 : size >= 80 ? 2.4 : 2.6

  return (
    <span style={tileStyle(size, variant)} className={className} aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        width={inner}
        height={inner}
      >
        <path d="M5 12c0-4 3-7 7-7s7 3 7 7" />
        <path d="M19 12c0 4-3 7-7 7M14.5 16.5L12 19L14.5 21.5" />
        <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
      </svg>
    </span>
  )
}
