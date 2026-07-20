function sanitizeForXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .slice(0, 2000) // Polly character limit
}

export function buildGatherTwiML(actionUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${sanitizeForXml(actionUrl)}" method="POST" language="pt-BR" speechTimeout="auto" timeout="5">
    <Say voice="Polly.Camila-Neural" language="pt-BR">Olá! Como posso ajudá-lo hoje?</Say>
  </Gather>
  <Say voice="Polly.Camila-Neural" language="pt-BR">Não ouvi nada. Por favor, ligue novamente.</Say>
</Response>`
}

export function buildSayTwiML(text: string, actionUrl: string): string {
  const safe = sanitizeForXml(text)
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Camila-Neural" language="pt-BR">${safe}</Say>
  <Gather input="speech" action="${sanitizeForXml(actionUrl)}" method="POST" language="pt-BR" speechTimeout="auto" timeout="8">
    <Say voice="Polly.Camila-Neural" language="pt-BR">Posso ajudar com mais alguma coisa?</Say>
  </Gather>
  <Say voice="Polly.Camila-Neural" language="pt-BR">Obrigado pela ligação. Até logo!</Say>
  <Hangup/>
</Response>`
}

export function buildHangupTwiML(message: string): string {
  const safe = sanitizeForXml(message)
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Camila-Neural" language="pt-BR">${safe}</Say>
  <Hangup/>
</Response>`
}
