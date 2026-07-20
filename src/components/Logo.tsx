import { BrandMark } from "@/components/BrandMark"
import type { CSSProperties } from "react"

type Variant = "default" | "mono-ink" | "mono-white" | "outline"

interface LogoProps {
  size?: number
  variant?: Variant
  /** Set true when rendering on brand-gradient or dark backgrounds */
  onDark?: boolean
}

export function Logo({ size = 34, variant = "default", onDark = false }: LogoProps) {
  const gap = Math.round(size * 0.32)
  const fontSize = size * 0.56

  const tileVariant: Variant = onDark ? "mono-white" : variant

  const wordStyle: CSSProperties = {
    fontWeight: 700,
    fontSize,
    lineHeight: 1,
    letterSpacing: "-0.025em",
    color: onDark ? "#fff" : "var(--ink)",
    whiteSpace: "nowrap",
  }

  const dotStyle: CSSProperties = {
    fontStyle: "normal",
    color: onDark ? "rgba(255,255,255,0.72)" : "var(--brand)",
  }

  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", gap }}
      aria-label="retorn.ai"
    >
      <BrandMark size={size} variant={tileVariant} />
      <span style={wordStyle}>
        retorn<em style={dotStyle}>.ai</em>
      </span>
    </span>
  )
}
