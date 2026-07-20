"use client"

import { createContext, useContext } from "react"

export type SubscriptionStatus = "active" | "trialing" | "past_due" | "cancelled" | "paused"

interface SubscriptionContextValue {
  isActive: boolean       // active or trialing
  plan: "starter" | "pro" | "medical"
  status: SubscriptionStatus
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  isActive: true,
  plan: "starter",
  status: "trialing",
})

export function SubscriptionProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: SubscriptionContextValue
}) {
  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>
}

export function useSubscription(): SubscriptionContextValue {
  return useContext(SubscriptionContext)
}

export function isSubscriptionActive(status: string): boolean {
  return status === "active" || status === "trialing"
}
