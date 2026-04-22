import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { parseBody, z } from '@/lib/validate'
import { getAllUsers, createUser, getUserByEmail } from '@/lib/redis'
import { hashPassword } from '@/lib/auth'
import type { AppUser } from '@/lib/calendar/types'

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'member', 'guest']),
  memberId: z.string().nullable().optional(),
})

// GET /api/users — admin only (enforced by middleware header)
export async function GET(req: NextRequest) {
  const role = req.headers.get('x-user-role')
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const users = await getAllUsers()
  const safe = users.map(({ passwordHash: _, ...u }) => u)
  return NextResponse.json(safe)
}

// POST /api/users — admin only
export async function POST(req: NextRequest) {
  const role = req.headers.get('x-user-role')
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = await parseBody(req, CreateUserSchema)
  if (result.error) return result.response

  const { name, email, password, role: userRole, memberId } = result.data

  const existing = await getUserByEmail(email.toLowerCase())
  if (existing) {
    return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
  }

  const user: AppUser = {
    id: nanoid(),
    name,
    email: email.toLowerCase(),
    passwordHash: await hashPassword(password),
    role: userRole,
    memberId: memberId ?? null,
    createdAt: new Date().toISOString(),
  }

  await createUser(user)
  const { passwordHash: _, ...safe } = user
  return NextResponse.json(safe, { status: 201 })
}
