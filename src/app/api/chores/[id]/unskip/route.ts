import { NextRequest, NextResponse } from 'next/server'
import {
  getChore,
  getChoreCompletion,
  removeChoreCompletion,
} from '@/lib/redis'
import { parseBody, z } from '@/lib/validate'

const UnskipSchema = z.object({
  date: z.string().min(1),
})

// POST /api/chores/[id]/unskip
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const chore = await getChore(id)
  if (!chore) return NextResponse.json({ error: 'chore not found' }, { status: 404 })

  const result = await parseBody(req, UnskipSchema)
  if (result.error) return result.response
  const { date } = result.data

  const existing = await getChoreCompletion(date, id)
  if (!existing || existing.status !== 'skipped') {
    return NextResponse.json({ error: 'no skip record for this date' }, { status: 404 })
  }

  await removeChoreCompletion(date, id)
  return NextResponse.json({ ok: true })
}
