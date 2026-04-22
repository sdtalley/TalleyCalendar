import { NextRequest, NextResponse } from 'next/server'
import type { SessionPayload } from '@/lib/calendar/types'

const COOKIE_NAME = 'familyhub_session'

const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/google',
  '/api/auth/outlook',
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/icons') ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js'
  ) {
    return NextResponse.next()
  }

  const token = req.cookies.get(COOKIE_NAME)?.value
  const session = token ? await verifyToken(token) : null

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Admin-only guard for the settings page
  if (pathname.startsWith('/settings') && session.role !== 'admin') {
    return NextResponse.redirect(new URL('/', req.url))
  }

  // Inject session context into request headers so API routes can read it
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-user-id', session.userId)
  requestHeaders.set('x-user-role', session.role)
  requestHeaders.set('x-member-id', session.memberId ?? '')

  return NextResponse.next({ request: { headers: requestHeaders } })
}

async function verifyToken(token: string): Promise<SessionPayload | null> {
  const dotIdx = token.indexOf('.')
  if (dotIdx === -1) return null

  const encoded = token.slice(0, dotIdx)
  const sig = token.slice(dotIdx + 1)

  const secret = process.env.NEXTAUTH_SECRET || 'familyhub-default-secret'
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const expected = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encoded))
  const expectedHex = Array.from(new Uint8Array(expected))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  if (sig !== expectedHex) return null

  try {
    const payload = JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))) as SessionPayload
    if (payload.exp < Date.now()) return null
    if (!payload.userId || !payload.role) return null
    return payload
  } catch {
    return null
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
