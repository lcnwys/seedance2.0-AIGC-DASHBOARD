import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

function getJwtSecret() {
  const jwtSecret = process.env.JWT_SECRET?.trim()
  if (!jwtSecret) {
    throw new Error('Missing required environment variable: JWT_SECRET')
  }

  return jwtSecret
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, getJwtSecret(), { expiresIn: '7d' })
}

export function verifyToken(token: string): { userId: string } | null {
  const jwtSecret = getJwtSecret()

  try {
    return jwt.verify(token, jwtSecret) as { userId: string }
  } catch {
    return null
  }
}
