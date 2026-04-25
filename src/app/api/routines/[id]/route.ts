import { NextRequest, NextResponse } from 'next/server'
import { getRoutine, updateRoutine, deleteRoutine } from '@/lib/redis'
import { parseBody, z } from '@/lib/validate'

const PatchSchema = z.object({
  title:      z.string().min(1).optional(),
  emoji:      z.string().optional(),
  memberIds:  z.array(z.string()).min(1).optional(),
  timeBlocks: z.array(z.enum(['morning', 'afternoon', 'evening'])).min(1).optional(),
  repeat:     z.union([
    z.literal('daily'),
    z.object({ weekly: z.array(z.number().int().min(0).max(6)) }),
  ]).optional(),
  endDate:    z.string().optional(),
  starValue:  z.number().int().min(0).optional(),
  order:      z.number().int().optional(),
})

// PATCH /api/routines/[id] — admin only
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (req.headers.get('x-user-role') !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const result = await parseBody(req, PatchSchema)
  if (result.error) return result.response

  const updated = await updateRoutine(id, { ...result.data, updatedAt: new Date().toISOString() })
  if (!updated) return NextResponse.json({ error: 'routine not found' }, { status: 404 })

  return NextResponse.json(updated)
}

// DELETE /api/routines/[id] — admin only
// Body: { scope?: 'all' | 'future', date?: 'YYYY-MM-DD' }
//   'all'    (default) → delete the routine entirely
//   'future' + date    → set endDate to the day before date
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (req.headers.get('x-user-role') !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const existing = await getRoutine(id)
  if (!existing) return NextResponse.json({ error: 'routine not found' }, { status: 404 })

  let scope: 'all' | 'future' = 'all'
  let date: string | undefined
  try {
    const body = await req.json()
    if (body?.scope) scope = body.scope
    if (body?.date) date = body.date
  } catch {
    // No body — treat as 'all'
  }

  if (scope === 'future' && date) {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    const endDate = d.toISOString().slice(0, 10)
    const updated = await updateRoutine(id, { endDate, updatedAt: new Date().toISOString() })
    return NextResponse.json({ ok: true, updated })
  }

  await deleteRoutine(id)
  return NextResponse.json({ ok: true })
}
