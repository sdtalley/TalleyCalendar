import { NextRequest, NextResponse } from 'next/server'
import {
  getChore,
  getChoreCompletion,
  setChoreCompletion,
  removeChoreCompletion,
  adjustStarBalance,
} from '@/lib/redis'
import { parseBody, z } from '@/lib/validate'

const CompleteSchema = z.object({
  date:     z.string().min(1),
  memberId: z.string().optional(),
})

const UncompleteSchema = z.object({
  date: z.string().min(1),
})

// POST /api/chores/[id]/complete
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const chore = await getChore(id)
  if (!chore) return NextResponse.json({ error: 'chore not found' }, { status: 404 })

  const result = await parseBody(req, CompleteSchema)
  if (result.error) return result.response
  const { date, memberId } = result.data

  const completion = {
    status: 'complete' as const,
    completedAt: new Date().toISOString(),
    completedByMemberId: memberId,
  }
  await setChoreCompletion(date, id, completion)

  let newStarBalance: number | undefined
  if (chore.starValue > 0 && memberId) {
    newStarBalance = await adjustStarBalance(memberId, chore.starValue)
  }

  return NextResponse.json({ completion, newStarBalance })
}

// DELETE /api/chores/[id]/complete — un-complete
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const chore = await getChore(id)
  if (!chore) return NextResponse.json({ error: 'chore not found' }, { status: 404 })

  const result = await parseBody(req, UncompleteSchema)
  if (result.error) return result.response
  const { date } = result.data

  const existing = await getChoreCompletion(date, id)
  if (!existing) return NextResponse.json({ error: 'no completion record' }, { status: 404 })

  await removeChoreCompletion(date, id)

  // Reverse the stars if the chore was completed (not skipped)
  let newStarBalance: number | undefined
  if (existing.status === 'complete' && chore.starValue > 0 && existing.completedByMemberId) {
    newStarBalance = await adjustStarBalance(existing.completedByMemberId, -chore.starValue)
  }

  return NextResponse.json({ ok: true, newStarBalance })
}
