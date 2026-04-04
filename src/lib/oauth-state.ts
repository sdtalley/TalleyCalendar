import { createHmac } from 'crypto'
import { redis } from './redis'

const VALID_CALENDAR_TYPES = ['personal', 'work', 'kids', 'shared'] as const

/**
 * Creates a signed, nonce-protected OAuth state parameter.
 * Stores the nonce in Redis with a 10-minute TTL.
 */
export async function createOAuthState(
  memberId: string,
  calendarType: string
): Promise<string> {
  const validType = VALID_CALENDAR_TYPES.includes(calendarType as typeof VALID_CALENDAR_TYPES[number])
    ? calendarType
    : 'personal'

  const nonce = crypto.randomUUID()
  const payload = JSON.stringify({ memberId, calendarType: validType, nonce })
  const signature = sign(payload)

  // Store nonce in Redis with 10-min TTL
  await redis.set(`oauth_nonce:${nonce}`, '1', { ex: 600 })

  return `${payload}.${signature}`
}

/**
 * Verifies and parses an OAuth state parameter.
 * Returns null if the signature is invalid or the nonce was already used.
 */
export async function verifyOAuthState(
  state: string
): Promise<{ memberId: string; calendarType: string } | null> {
  const dotIdx = state.lastIndexOf('.')
  if (dotIdx === -1) return null

  const payload = state.slice(0, dotIdx)
  const signature = state.slice(dotIdx + 1)

  // Verify HMAC signature
  if (signature !== sign(payload)) return null

  let data: { memberId: string; calendarType: string; nonce: string }
  try {
    data = JSON.parse(payload)
  } catch {
    return null
  }

  // Verify and consume the nonce (one-time use)
  const nonceKey = `oauth_nonce:${data.nonce}`
  const existed = await redis.del(nonceKey)
  if (existed === 0) return null

  // Validate calendarType
  if (!VALID_CALENDAR_TYPES.includes(data.calendarType as typeof VALID_CALENDAR_TYPES[number])) {
    return null
  }

  return { memberId: data.memberId, calendarType: data.calendarType }
}

function sign(payload: string): string {
  const secret = process.env.NEXTAUTH_SECRET || 'familyhub-default-secret'
  return createHmac('sha256', secret).update(payload).digest('hex')
}

/**
 * Normalize the app URL: strip trailing slashes.
 */
export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
}
