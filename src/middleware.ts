import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = 'familyhub_session'

// Routes that don't require authentication
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/google',      // OAuth callbacks must be accessible (Google redirects here)
  '/api/auth/outlook',     // OAuth callbacks must be accessible (Microsoft redirects here)
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/icons') ||
    pathname === '/manifest.json'
  ) {
    return NextResponse.next()
  }

  // Check session cookie
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token || !(await verifyToken(token, req))) {
    // Redirect to login for pages, return 401 for API routes
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = new URL('/login', req.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

async function verifyToken(token: string, req: NextRequest): Promise<boolean> {
  const dotIdx = token.indexOf('.')
  if (dotIdx === -1) return false

  const encoded = token.slice(0, dotIdx)
  const sig = token.slice(dotIdx + 1)

  // Use Web Crypto API (Edge runtime compatible)
  const secret = process.env.NEXTAUTH_SECRET || 'familyhub-default-secret'
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const expected = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(encoded)
  )

  const expectedHex = Array.from(new Uint8Array(expected))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  if (sig !== expectedHex) return false

  try {
    const payload = JSON.parse(atob(encoded))
    if (payload.exp < Date.now()) return false
    return payload.authenticated === true
  } catch {
    return false
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
