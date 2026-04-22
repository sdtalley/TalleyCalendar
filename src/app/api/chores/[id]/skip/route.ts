import { NextRequest, NextResponse } from 'next/server'
import { getChore, setChoreCompletion } from '@/lib/redis'
import { parseBody, z } from '@/lib/validate'

const SkipSchema = z.object({
  date:     z.string().min(1),
  memberId: z.string().optional(),
})

// POST /api/chores/[id]/skip
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const chore = await getChore(id)
  if (!chore) return NextResponse.json({ error: 'chore not found' }, { status: 404 })

  const result = await parseBody(req, SkipSchema)
  if (result.error) return result.response
  const { date, memberId } = result.data

  const completion = {
    status: 'skipped' as const,
    completedAt: new Date().toISOString(),
    completedByMemberId: memberId,
  }
  await setChoreCompletion(date, id, completion)

  return NextResponse.json({ completion })
}
