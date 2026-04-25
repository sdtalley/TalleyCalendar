import { NextRequest, NextResponse } from 'next/server'
import { getRoutines, createRoutine, getRoutineCompletions } from '@/lib/redis'
import { parseBody, z } from '@/lib/validate'
import type { Routine } from '@/lib/calendar/types'

const RepeatSchema = z.union([
  z.literal('daily'),
  z.object({ weekly: z.array(z.number().int().min(0).max(6)) }),
])

const PostSchema = z.object({
  title:      z.string().min(1),
  emoji:      z.string().optional(),
  memberIds:  z.array(z.string()).min(1),
  timeBlocks: z.array(z.enum(['morning', 'afternoon', 'evening'])).min(1),
  repeat:     RepeatSchema,
  starValue:  z.number().int().min(0).default(0),
  order:      z.number().int().optional(),
})

function normalizeRoutine(r: Routine): Routine {
  if (!r.timeBlocks?.length) {
    return { ...r, timeBlocks: r.timeBlock ? [r.timeBlock] : ['morning'] }
  }
  return r
}

// GET /api/routines?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
  const routines = (await getRoutines()).map(normalizeRoutine)
  const completions = await getRoutineCompletions(date, routines.map(r => r.id))
  return NextResponse.json({ routines, completions })
}

// POST /api/routines — admin only
export async function POST(req: NextRequest) {
  if (req.headers.get('x-user-role') !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = await parseBody(req, PostSchema)
  if (result.error) return result.response

  const now = new Date().toISOString()
  const routine = { id: crypto.randomUUID(), ...result.data, createdAt: now, updatedAt: now }

  await createRoutine(routine)
  return NextResponse.json(routine, { status: 201 })
}
