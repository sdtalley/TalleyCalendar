import { NextRequest, NextResponse } from 'next/server'
import { getChore, updateChore, deleteChore } from '@/lib/redis'
import { parseBody, z } from '@/lib/validate'

const PatchSchema = z.object({
  title:     z.string().min(1).optional(),
  emoji:     z.string().optional(),
  memberIds: z.array(z.string()).min(1).optional(),
  date:      z.string().nullable().optional(),
  time:      z.string().nullable().optional(),
  repeat:    z.object({
    frequency:  z.enum(['daily', 'weekly', 'monthly']),
    interval:   z.number().int().min(1),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
    endDate:    z.string().optional(),
  }).nullable().optional(),
  starValue: z.number().int().min(0).optional(),
})

// PATCH /api/chores/[id] — admin only
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (req.headers.get('x-user-role') !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const result = await parseBody(req, PatchSchema)
  if (result.error) return result.response

  const updates: Record<string, unknown> = { ...result.data, updatedAt: new Date().toISOString() }
  // Convert null → undefined for optional fields
  if (updates.date === null)   updates.date   = undefined
  if (updates.time === null)   updates.time   = undefined
  if (updates.repeat === null) updates.repeat = undefined

  const updated = await updateChore(id, updates)
  if (!updated) return NextResponse.json({ error: 'chore not found' }, { status: 404 })

  return NextResponse.json(updated)
}

// DELETE /api/chores/[id] — admin only
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (req.headers.get('x-user-role') !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const existing = await getChore(id)
  if (!existing) return NextResponse.json({ error: 'chore not found' }, { status: 404 })

  await deleteChore(id)
  return NextResponse.json({ ok: true })
}
