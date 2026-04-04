import { createHmac } from 'crypto'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'familyhub_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days in seconds

function secret(): string {
  return process.env.NEXTAUTH_SECRET || 'familyhub-default-secret'
}

/**
 * Creates a signed session token: base64(payload).signature
 */
export function createSessionToken(): string {
  const payload = JSON.stringify({
    authenticated: true,
    iat: Date.now(),
    exp: Date.now() + SESSION_MAX_AGE * 1000,
  })
  const encoded = Buffer.from(payload).toString('base64url')
  const sig = createHmac('sha256', secret()).update(encoded).digest('hex')
  return `${encoded}.${sig}`
}

/**
 * Verifies a session token. Returns true if valid and not expired.
 */
export function verifySessionToken(token: string): boolean {
  const dotIdx = token.indexOf('.')
  if (dotIdx === -1) return false

  const encoded = token.slice(0, dotIdx)
  const sig = token.slice(dotIdx + 1)

  const expectedSig = createHmac('sha256', secret()).update(encoded).digest('hex')
  if (sig !== expectedSig) return false

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString())
    if (payload.exp < Date.now()) return false
    return payload.authenticated === true
  } catch {
    return false
  }
}

/**
 * Sets the session cookie (call from API route after successful login).
 */
export async function setSessionCookie(): Promise<void> {
  const token = createSessionToken()
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
}

/**
 * Clears the session cookie (logout).
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

/**
 * Checks if the current request has a valid session (for use in API routes / server components).
 */
export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return false
  return verifySessionToken(token)
}

/**
 * The cookie name, exported for middleware to read.
 */
export { COOKIE_NAME }
