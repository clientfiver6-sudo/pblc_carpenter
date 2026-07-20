export type TrajectoryState = "idle" | "greeting" | "collecting_info" | "booking_in_progress" | "payment_pending" | "closing" | "escalated"

export const TOOL_STATE_TRANSITIONS: Record<string, TrajectoryState> = {
  create_work_item: "booking_in_progress",
  create_payment_link: "payment_pending",
  handoff_to_human: "escalated",
}

export function getNextState(
  toolName: string,
  toolInput: Record<string, unknown>,
  currentState: TrajectoryState
): TrajectoryState | null {
  if (toolName === "update_work_item_status") {
    const status = toolInput.status as string
    if (status === "completed" || status === "cancelled") return "closing"
  }
  if (toolName === "lookup_customer" || toolName === "create_customer") {
    return currentState === "idle" ? "greeting" : null
  }
  return TOOL_STATE_TRANSITIONS[toolName] ?? null
}

export function getStateLabel(state: TrajectoryState): string {
  const labels: Record<TrajectoryState, string> = {
    idle: "Aguardando",
    greeting: "Saudação",
    collecting_info: "Coletando Info",
    booking_in_progress: "Agendando",
    payment_pending: "Pagamento Pendente",
    closing: "Encerrando",
    escalated: "Escalado",
  }
  return labels[state] ?? state
}

export function getStateColor(state: TrajectoryState): string {
  const colors: Record<TrajectoryState, string> = {
    idle: "text-[#64748B]",
    greeting: "text-[#94A3B8]",
    collecting_info: "text-[#8B5CF6]",
    booking_in_progress: "text-[#3B82F6]",
    payment_pending: "text-[#F59E0B]",
    closing: "text-[#00e5a0]",
    escalated: "text-[#F43F5E]",
  }
  return colors[state] ?? "text-[#94A3B8]"
}
