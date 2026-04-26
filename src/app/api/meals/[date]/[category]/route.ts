import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { parseBody, z } from '@/lib/validate'
import { nanoid } from 'nanoid'
import type { DayMeals, MealCategory, MealEntry } from '@/lib/calendar/types'

const CATEGORIES: MealCategory[] = ['breakfast', 'lunch', 'dinner', 'snack']
const EMPTY: DayMeals = { breakfast: [], lunch: [], dinner: [], snack: [] }

function mealsKey(date: string) { return `meals:${date}` }

async function getDayMeals(date: string): Promise<DayMeals> {
  const data = await redis.get<DayMeals>(mealsKey(date))
  return data ?? { ...EMPTY }
}

const EntrySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  note: z.string().optional(),
  repeat: z.object({
    frequency: z.literal('weekly'),
    daysOfWeek: z.array(z.number().int().min(0).max(6)),
  }).optional(),
})

type Params = { params: Promise<{ date: string; category: string }> }

export async function PUT(req: NextRequest, { params }: Params) {
  const { date, category } = await params
  if (!CATEGORIES.includes(category as MealCategory)) {
    return NextResponse.json({ error: 'invalid category' }, { status: 400 })
  }
  const result = await parseBody(req, EntrySchema)
  if (result.error) return result.response

  const day = await getDayMeals(date)
  const cat = category as MealCategory
  const entry: MealEntry = { ...result.data, id: result.data.id ?? nanoid() }

  const existing = day[cat].findIndex(e => e.id === entry.id)
  if (existing >= 0) {
    day[cat][existing] = entry
  } else {
    day[cat] = [...day[cat], entry]
  }

  await redis.set(mealsKey(date), day)
  return NextResponse.json({ date, category, entry })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { date, category } = await params
  if (!CATEGORIES.includes(category as MealCategory)) {
    return NextResponse.json({ error: 'invalid category' }, { status: 400 })
  }
  const { searchParams } = new URL(req.url)
  const entryId = searchParams.get('entryId')
  if (!entryId) return NextResponse.json({ error: 'entryId required' }, { status: 400 })

  const day = await getDayMeals(date)
  const cat = category as MealCategory
  day[cat] = day[cat].filter(e => e.id !== entryId)
  await redis.set(mealsKey(date), day)
  return NextResponse.json({ ok: true })
}
