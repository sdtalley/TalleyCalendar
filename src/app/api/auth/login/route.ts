import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { nanoid } from 'nanoid'
import { parseBody, z } from '@/lib/validate'
import { getUserByEmail, createUser, getFamilyMembers } from '@/lib/redis'
import { verifyPassword, hashPassword, setSessionCookie } from '@/lib/auth'
import type { SessionPayload, AppUser } from '@/lib/calendar/types'

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

function envCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

// POST /api/auth/login
// Body: { email: string, password: string }
export async function POST(req: NextRequest) {
  const result = await parseBody(req, LoginSchema)
  if (result.error) return result.response

  const { email, password } = result.data

  const envUser = process.env.AUTH_USERNAME
  const envPass = process.env.AUTH_PASSWORD

  // ── Redis-first auth ───────────────────────────────────────────────────────
  const dbUser = await getUserByEmail(email.toLowerCase())

  if (dbUser) {
    const valid = await verifyPassword(password, dbUser.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const payload: SessionPayload = {
      userId: dbUser.id,
      role: dbUser.role,
      memberId: dbUser.memberId,
      iat: Date.now(),
      exp: Date.now() + 1000 * 60 * 60 * 24 * 30,
    }
    await setSessionCookie(payload)
    return NextResponse.json({ ok: true })
  }

  // ── Env-var fallback ───────────────────────────────────────────────────────
  if (!envUser || !envPass) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const emailMatches = envCompare(email.toLowerCase(), envUser.toLowerCase())
  const passMatches = envCompare(password, envPass)

  if (!emailMatches || !passMatches) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  // Auto-create admin user in Redis on first successful env-var login
  const members = await getFamilyMembers()
  const newUser: AppUser = {
    id: nanoid(),
    name: envUser,
    email: envUser.toLowerCase(),
    passwordHash: await hashPassword(envPass),
    role: 'admin',
    memberId: members[0]?.id ?? null,
    createdAt: new Date().toISOString(),
  }
  await createUser(newUser)

  const payload: SessionPayload = {
    userId: newUser.id,
    role: 'admin',
    memberId: newUser.memberId,
    iat: Date.now(),
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30,
  }
  await setSessionCookie(payload)
  return NextResponse.json({ ok: true })
}
