import { createHmac } from 'crypto'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import type { SessionPayload } from './calendar/types'

export const COOKIE_NAME = 'familyhub_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days in seconds

function secret(): string {
  return process.env.NEXTAUTH_SECRET || 'familyhub-default-secret'
}

export function createSessionToken(payload: SessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret()).update(encoded).digest('hex')
  return `${encoded}.${sig}`
}

export function verifySessionToken(token: string): SessionPayload | null {
  const dotIdx = token.indexOf('.')
  if (dotIdx === -1) return null

  const encoded = token.slice(0, dotIdx)
  const sig = token.slice(dotIdx + 1)

  const expectedSig = createHmac('sha256', secret()).update(encoded).digest('hex')
  if (sig !== expectedSig) return null

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as SessionPayload
    if (payload.exp < Date.now()) return null
    if (!payload.userId || !payload.role) return null
    return payload
  } catch {
    return null
  }
}

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = createSessionToken(payload)
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifySessionToken(token)
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12)
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}
