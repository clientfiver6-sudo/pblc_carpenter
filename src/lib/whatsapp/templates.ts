// Pre-built WhatsApp message templates for automations
// These are plain text templates (not Meta-registered templates) for non-template messages

export function templateBookingCreated(vars: {
  customerName: string
  businessName: string
  serviceName: string
  scheduledTime: string
}): string {
  return `Olá ${vars.customerName}!\n\nSeu agendamento foi confirmado!\n\n*${vars.serviceName}* em *${vars.businessName}*\n${vars.scheduledTime}\n\nQualquer dúvida, pode me perguntar aqui!`
}

export function templateBookingReminder(vars: {
  customerName: string
  businessName: string
  serviceName: string
  scheduledTime: string
}): string {
  return `Oi ${vars.customerName}!\n\nLembrete: amanhã você tem:\n\n*${vars.serviceName}* em *${vars.businessName}*\n${vars.scheduledTime}\n\nNos vemos em breve! Para remarcar, é só me avisar.`
}

export function templateBookingCompleted(vars: {
  customerName: string
  businessName: string
  serviceName: string
  price?: string
}): string {
  const priceText = vars.price ? `\n\nValor: *${vars.price}*` : ""
  return `Obrigado(a), ${vars.customerName}!\n\nFoi um prazer atender você em *${vars.businessName}*!${priceText}\n\nEsperamos te ver em breve! Se precisar de algo, é só chamar.`
}

export function templatePaymentReminder(vars: {
  customerName: string
  businessName: string
  amount: string
  pixLink?: string
}): string {
  const pixText = vars.pixLink ? `\n\nLink de pagamento: ${vars.pixLink}` : ""
  return `Oi ${vars.customerName}!\n\nLembrete amigável: ainda temos um pagamento pendente de *${vars.amount}* referente ao serviço em *${vars.businessName}*.${pixText}\n\nQualquer dúvida, pode me avisar!`
}

export function templateInactiveCustomer(vars: {
  customerName: string
  businessName: string
  businessType: string
}): string {
  return `Oi ${vars.customerName}!\n\nFaz um tempinho que não nos vemos aqui na *${vars.businessName}*. Como você está?\n\nSe precisar de algum serviço ou quiser agendar, estamos à disposição!`
}
