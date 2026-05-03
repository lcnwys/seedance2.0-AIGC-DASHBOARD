import crypto from 'crypto'

const IV_LENGTH = 16
const ALGORITHM = 'aes-256-cbc'

function getEncryptionKeyRaw() {
  return process.env.ENCRYPTION_KEY?.trim() || ''
}

export function hasEncryptionKeyConfigured() {
  return getEncryptionKeyRaw().length > 0
}

function getKey(): Buffer {
  const encryptionKey = getEncryptionKeyRaw()
  if (!encryptionKey) {
    throw new Error('Missing required environment variable: ENCRYPTION_KEY')
  }

  // Keep the historical derivation method so existing encrypted team keys remain readable after upgrade.
  const key = encryptionKey.padEnd(32, '0').slice(0, 32)
  return Buffer.from(key, 'utf-8')
}

/**
 * Encrypt sensitive data (like API keys)
 */
export function encrypt(text: string): string {
  if (!text) return ''
  
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  // Return IV + encrypted data (IV is needed for decryption)
  return iv.toString('hex') + ':' + encrypted
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return ''
  if (!hasEncryptionKeyConfigured()) return ''
  
  try {
    const parts = encryptedText.split(':')
    if (parts.length !== 2) return ''
    
    const iv = Buffer.from(parts[0], 'hex')
    const encrypted = parts[1]
    
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv)
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    console.error('Decryption failed:', error)
    return ''
  }
}

/**
 * Mask API key for display (show first 3 and last 4 chars)
 * e.g., "sk-abc123456789xyz" => "sk-***...9xyz"
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 10) return '****'
  
  const prefix = apiKey.slice(0, 6)  // e.g., "sk-abc"
  const suffix = apiKey.slice(-4)     // last 4 chars
  
  return `${prefix}***...${suffix}`
}
