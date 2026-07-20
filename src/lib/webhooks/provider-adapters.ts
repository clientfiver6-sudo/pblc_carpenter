export interface ProviderConfig {
  displayName: string
  commonEvents: Array<{ event: string; label: string }>
  signatureHeader: string
}

export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  calendly: {
    displayName: "Calendly",
    commonEvents: [
      { event: "invitee.created", label: "Agendamento criado" },
      { event: "invitee.canceled", label: "Agendamento cancelado" },
    ],
    signatureHeader: "calendly-webhook-signature",
  },
  google_calendar: {
    displayName: "Google Calendar",
    commonEvents: [
      { event: "created", label: "Evento criado" },
      { event: "cancelled", label: "Evento cancelado" },
    ],
    signatureHeader: "x-goog-channel-token",
  },
  pix: {
    displayName: "PIX / Banco",
    commonEvents: [
      { event: "payment.received", label: "Pagamento recebido" },
      { event: "payment.failed", label: "Pagamento falhou" },
    ],
    signatureHeader: "x-webhook-signature",
  },
  generic: {
    displayName: "Genérico",
    commonEvents: [
      { event: "booking.created", label: "Agendamento criado" },
      { event: "booking.cancelled", label: "Agendamento cancelado" },
      { event: "payment.received", label: "Pagamento recebido" },
    ],
    signatureHeader: "x-webhook-signature",
  },
}
