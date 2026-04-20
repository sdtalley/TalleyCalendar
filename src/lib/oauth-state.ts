import { createHmac } from 'crypto'
import { redis } from './redis'

const VALID_CALENDAR_TYPES = ['personal', 'work', 'kids', 'shared'] as const

/**
 * Creates a signed, nonce-protected OAuth state parameter.
 * Stores the nonce in Redis with a 10-minute TTL.
 * Pass reconnectAccountId to signal that the callback should update an
 * existing account's tokens rather than create a new one.
 */
export async function createOAuthState(
  memberId: string,
  calendarType: string,
  reconnectAccountId?: string
): Promise<string> {
  const validType = VALID_CALENDAR_TYPES.includes(calendarType as typeof VALID_CALENDAR_TYPES[number])
    ? calendarType
    : 'personal'

  const nonce = crypto.randomUUID()
  const payload = JSON.stringify({
    memberId,
    calendarType: validType,
    nonce,
    ...(reconnectAccountId ? { accountId: reconnectAccountId } : {}),
  })
  const signature = sign(payload)

  await redis.set(`oauth_nonce:${nonce}`, '1', { ex: 600 })

  return `${payload}.${signature}`
}

/**
 * Verifies and parses an OAuth state parameter.
 * Returns null if the signature is invalid or the nonce was already used.
 * Returns accountId when the flow is a reconnect for an existing account.
 */
export async function verifyOAuthState(
  state: string
): Promise<{ memberId: string; calendarType: string; accountId?: string } | null> {
  const dotIdx = state.lastIndexOf('.')
  if (dotIdx === -1) return null

  const payload = state.slice(0, dotIdx)
  const signature = state.slice(dotIdx + 1)

  if (signature !== sign(payload)) return null

  let data: { memberId: string; calendarType: string; nonce: string; accountId?: string }
  try {
    data = JSON.parse(payload)
  } catch {
    return null
  }

  const nonceKey = `oauth_nonce:${data.nonce}`
  const existed = await redis.del(nonceKey)
  if (existed === 0) return null

  if (!VALID_CALENDAR_TYPES.includes(data.calendarType as typeof VALID_CALENDAR_TYPES[number])) {
    return null
  }

  return {
    memberId: data.memberId,
    calendarType: data.calendarType,
    ...(data.accountId ? { accountId: data.accountId } : {}),
  }
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
