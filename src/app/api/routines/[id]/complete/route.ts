import { NextRequest, NextResponse } from 'next/server'
import {
  getRoutine,
  getRoutineCompletion,
  setRoutineCompletion,
  removeRoutineCompletion,
  adjustStarBalance,
  logStarTransaction,
} from '@/lib/redis'
import { parseBody, z } from '@/lib/validate'

const CompleteSchema = z.object({
  date:     z.string().min(1),
  memberId: z.string().optional(),
})

const UncompleteSchema = z.object({
  date: z.string().min(1),
})

// POST /api/routines/[id]/complete
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const routine = await getRoutine(id)
  if (!routine) return NextResponse.json({ error: 'routine not found' }, { status: 404 })

  const result = await parseBody(req, CompleteSchema)
  if (result.error) return result.response
  const { date, memberId } = result.data

  const completion = {
    status: 'complete' as const,
    completedAt: new Date().toISOString(),
    completedByMemberId: memberId,
  }
  await setRoutineCompletion(date, id, completion)

  let newStarBalance: number | undefined
  if (routine.starValue > 0 && memberId) {
    newStarBalance = await adjustStarBalance(memberId, routine.starValue)
    await logStarTransaction({
      id: crypto.randomUUID(), memberId, delta: routine.starValue,
      reason: `routine:${id}`, label: `Completed: ${routine.title}`,
      timestamp: new Date().toISOString(),
    })
  }

  return NextResponse.json({ completion, newStarBalance })
}

// DELETE /api/routines/[id]/complete — un-complete
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const routine = await getRoutine(id)
  if (!routine) return NextResponse.json({ error: 'routine not found' }, { status: 404 })

  const result = await parseBody(req, UncompleteSchema)
  if (result.error) return result.response
  const { date } = result.data

  const existing = await getRoutineCompletion(date, id)
  if (!existing) return NextResponse.json({ error: 'no completion record' }, { status: 404 })

  await removeRoutineCompletion(date, id)

  let newStarBalance: number | undefined
  if (existing.status === 'complete' && routine.starValue > 0 && existing.completedByMemberId) {
    newStarBalance = await adjustStarBalance(existing.completedByMemberId, -routine.starValue)
  }

  return NextResponse.json({ ok: true, newStarBalance })
}
