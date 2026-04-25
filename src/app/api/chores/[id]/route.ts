import { NextRequest, NextResponse } from 'next/server'
import { getChore, updateChore, deleteChore } from '@/lib/redis'
import { parseBody, z } from '@/lib/validate'

const PatchSchema = z.object({
  title:      z.string().min(1).optional(),
  emoji:      z.string().optional(),
  memberIds:  z.array(z.string()).min(1).optional(),
  date:       z.string().nullable().optional(),
  time:       z.string().nullable().optional(),
  repeat:     z.object({
    frequency:  z.enum(['daily', 'weekly', 'monthly']),
    interval:   z.number().int().min(1),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
    endDate:    z.string().optional(),
  }).nullable().optional(),
  exceptions: z.array(z.string()).optional(),
  starValue:  z.number().int().min(0).optional(),
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
// Body: { scope?: 'all' | 'this' | 'future', date?: 'YYYY-MM-DD' }
//   'all'    (default) → delete the chore entirely
//   'this'   + date    → add date to exceptions (chore persists, that date is excluded)
//   'future' + date    → set repeat.endDate to the day before date
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (req.headers.get('x-user-role') !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const existing = await getChore(id)
  if (!existing) return NextResponse.json({ error: 'chore not found' }, { status: 404 })

  // Try to parse scope from body (may be absent for non-repeating chores)
  let scope: 'all' | 'this' | 'future' = 'all'
  let date: string | undefined
  try {
    const body = await req.json()
    if (body?.scope) scope = body.scope
    if (body?.date) date = body.date
  } catch {
    // No body or invalid JSON — treat as 'all'
  }

  if (scope === 'this' && date) {
    const exceptions = [...(existing.exceptions ?? []), date]
    const updated = await updateChore(id, { exceptions, updatedAt: new Date().toISOString() })
    return NextResponse.json({ ok: true, updated })
  }

  if (scope === 'future' && date && existing.repeat) {
    // Set endDate to the day before the given date
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    const endDate = d.toISOString().slice(0, 10)
    const updated = await updateChore(id, {
      repeat: { ...existing.repeat, endDate },
      updatedAt: new Date().toISOString(),
    })
    return NextResponse.json({ ok: true, updated })
  }

  await deleteChore(id)
  return NextResponse.json({ ok: true })
}
