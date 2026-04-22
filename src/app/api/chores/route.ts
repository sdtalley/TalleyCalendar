import { NextRequest, NextResponse } from 'next/server'
import { getChores, createChore, getChoreCompletions } from '@/lib/redis'
import { parseBody, z } from '@/lib/validate'

const ChoreRepeatSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  interval:  z.number().int().min(1).default(1),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  endDate:   z.string().optional(),
})

const PostSchema = z.object({
  title:     z.string().min(1),
  emoji:     z.string().optional(),
  memberIds: z.array(z.string()).min(1),
  date:      z.string().optional(),
  time:      z.string().optional(),
  repeat:    ChoreRepeatSchema.optional(),
  starValue: z.number().int().min(0).default(0),
})

// GET /api/chores?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
  const chores = await getChores()
  const completions = await getChoreCompletions(date, chores.map(c => c.id))
  return NextResponse.json({ chores, completions })
}

// POST /api/chores — admin only
export async function POST(req: NextRequest) {
  if (req.headers.get('x-user-role') !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = await parseBody(req, PostSchema)
  if (result.error) return result.response

  const now = new Date().toISOString()
  const chore = {
    id: crypto.randomUUID(),
    ...result.data,
    createdAt: now,
    updatedAt: now,
  }

  await createChore(chore)
  return NextResponse.json(chore, { status: 201 })
}
