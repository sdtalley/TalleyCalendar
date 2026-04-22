import { NextRequest, NextResponse } from 'next/server'
import { getRoutine, setRoutineCompletion } from '@/lib/redis'
import { parseBody, z } from '@/lib/validate'

const SkipSchema = z.object({
  date:     z.string().min(1),
  memberId: z.string().optional(),
})

// POST /api/routines/[id]/skip
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const routine = await getRoutine(id)
  if (!routine) return NextResponse.json({ error: 'routine not found' }, { status: 404 })

  const result = await parseBody(req, SkipSchema)
  if (result.error) return result.response
  const { date, memberId } = result.data

  const completion = {
    status: 'skipped' as const,
    completedAt: new Date().toISOString(),
    completedByMemberId: memberId,
  }
  await setRoutineCompletion(date, id, completion)

  return NextResponse.json({ completion })
}
