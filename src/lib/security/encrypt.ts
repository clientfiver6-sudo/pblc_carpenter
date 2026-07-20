import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes). Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"')
  }
  return Buffer.from(keyHex, 'hex')
}

// Returns "ivHex:authTagHex:ciphertextHex" — safe to store in DB
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

// Inverse of encrypt(). Throws if tampered or wrong key.
export function decrypt(encryptedText: string): string {
  const key = getKey()
  const parts = encryptedText.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted format')
  const [ivHex, authTagHex, dataHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const data = Buffer.from(dataHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

// Returns true if the string looks like an encrypted value (not plaintext)
export function isEncrypted(value: string): boolean {
  const parts = value.split(':')
  return parts.length === 3 && parts[0].length === 32 && parts[1].length === 32
}

// Safe decrypt that handles null, plaintext legacy values, and missing key gracefully
export function safeDecryptToken(value: string | null | undefined): string | null {
  if (!value) return null
  if (!process.env.ENCRYPTION_KEY) return value // key not configured — return as-is
  if (!isEncrypted(value)) return value // legacy plaintext — return as-is
  try { return decrypt(value) } catch { return null }
}

// Safe encrypt that returns plaintext unchanged when key is not configured
export function safeEncryptToken(value: string | null | undefined): string | null {
  if (!value) return null
  if (!process.env.ENCRYPTION_KEY) return value
  return encrypt(value)
}
