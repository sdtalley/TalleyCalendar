import { NextRequest, NextResponse } from 'next/server'
import {
  getRoutine,
  getRoutineCompletion,
  removeRoutineCompletion,
} from '@/lib/redis'
import { parseBody, z } from '@/lib/validate'

const UnskipSchema = z.object({
  date: z.string().min(1),
})

// POST /api/routines/[id]/unskip
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const routine = await getRoutine(id)
  if (!routine) return NextResponse.json({ error: 'routine not found' }, { status: 404 })

  const result = await parseBody(req, UnskipSchema)
  if (result.error) return result.response
  const { date } = result.data

  const existing = await getRoutineCompletion(date, id)
  if (!existing || existing.status !== 'skipped') {
    return NextResponse.json({ error: 'no skip record for this date' }, { status: 404 })
  }

  await removeRoutineCompletion(date, id)
  return NextResponse.json({ ok: true })
}
