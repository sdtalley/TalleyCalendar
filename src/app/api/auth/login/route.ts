import { NextRequest, NextResponse } from 'next/server'
import { setSessionCookie } from '@/lib/auth'
import { timingSafeEqual } from 'crypto'

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

// POST /api/auth/login
// Body: { username: string, password: string }
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { username, password } = body

  const expectedUser = process.env.AUTH_USERNAME
  const expectedPass = process.env.AUTH_PASSWORD

  if (!expectedUser || !expectedPass) {
    return NextResponse.json(
      { error: 'Auth not configured. Set AUTH_USERNAME and AUTH_PASSWORD.' },
      { status: 500 }
    )
  }

  if (
    !username || !password ||
    !safeCompare(username, expectedUser) ||
    !safeCompare(password, expectedPass)
  ) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  await setSessionCookie()
  return NextResponse.json({ ok: true })
}
