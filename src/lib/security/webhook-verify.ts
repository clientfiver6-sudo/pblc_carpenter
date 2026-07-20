import crypto from 'crypto'

// WhatsApp webhook signature verification (X-Hub-Signature-256 header)
export function verifyWhatsAppSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')
    const received = signature.replace('sha256=', '')
    if (expected.length !== received.length) return false
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(received, 'hex')
    )
  } catch {
    return false
  }
}

// Mercado Pago webhook signature verification (x-signature header)
export function verifyMercadoPagoSignature(
  xSignature: string,
  xRequestId: string,
  dataId: string,
  secret: string
): boolean {
  try {
    const parts = Object.fromEntries(
      xSignature.split(',').map(p => p.split('=').map(s => s.trim()) as [string, string])
    )
    const ts = parts['ts']
    const receivedHash = parts['v1']
    if (!ts || !receivedHash) return false
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
    const hash = crypto.createHmac('sha256', secret).update(manifest).digest('hex')
    if (hash.length !== receivedHash.length) return false
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(receivedHash))
  } catch {
    return false
  }
}

// Twilio webhook signature verification (X-Twilio-Signature header)
export function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string,
  authToken: string
): boolean {
  try {
    const sortedParams = Object.keys(params).sort().map(k => k + params[k]).join('')
    const data = url + sortedParams
    const expected = crypto.createHmac('sha1', authToken).update(data, 'utf8').digest('base64')
    if (expected.length !== signature.length) return false
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

// Cron job Bearer token verification
export function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return false
  const token = authHeader.slice(7)
  const expected = process.env.CRON_SECRET
  if (!expected || token.length !== expected.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  } catch {
    return false
  }
}
