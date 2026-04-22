import { NextRequest, NextResponse } from 'next/server'
import { parseBody, z } from '@/lib/validate'
import { getUser, updateUser, deleteUser, getUserByEmail } from '@/lib/redis'
import { hashPassword } from '@/lib/auth'

const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(['admin', 'member', 'guest']).optional(),
  memberId: z.string().nullable().optional(),
})

// PATCH /api/users/[id] — admin only
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const role = req.headers.get('x-user-role')
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const result = await parseBody(req, UpdateUserSchema)
  if (result.error) return result.response

  const { password, email, ...rest } = result.data

  if (email) {
    const existing = await getUserByEmail(email.toLowerCase())
    if (existing && existing.id !== id) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    }
  }

  const updates: Record<string, unknown> = { ...rest }
  if (email) updates.email = email.toLowerCase()
  if (password) updates.passwordHash = await hashPassword(password)

  const updated = await updateUser(id, updates)
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { passwordHash: _, ...safe } = updated
  return NextResponse.json(safe)
}

// DELETE /api/users/[id] — admin only
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const role = req.headers.get('x-user-role')
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const requestingUserId = req.headers.get('x-user-id')
  if (requestingUserId === id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }

  const user = await getUser(id)
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await deleteUser(id)
  return NextResponse.json({ ok: true })
}
