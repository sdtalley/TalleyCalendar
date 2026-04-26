import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import type { DayMeals } from '@/lib/calendar/types'

function newKey(date: string) { return `meals:${date}` }
function legacyKey(date: string) { return `meal:${date}` }

const EMPTY: DayMeals = { breakfast: [], lunch: [], dinner: [], snack: [] }

async function getDayMeals(date: string): Promise<DayMeals> {
  const data = await redis.get<DayMeals>(newKey(date))
  if (data) return data
  // Lazy migration: lift old single-dinner string into new format
  const legacy = await redis.get<{ name: string }>(legacyKey(date))
  if (legacy?.name) {
    return { ...EMPTY, dinner: [{ id: `migrated-${date}`, name: legacy.name }] }
  }
  return EMPTY
}

function dateRange(start: string, end: string): string[] {
  const dates: string[] = []
  const cur = new Date(start + 'T00:00:00')
  const last = new Date(end + 'T00:00:00')
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  if (!start || !end) {
    return NextResponse.json({ error: 'start and end required' }, { status: 400 })
  }
  const dates = dateRange(start, end)
  const results = await Promise.all(dates.map(d => getDayMeals(d)))
  const out: Record<string, DayMeals> = {}
  dates.forEach((d, i) => { out[d] = results[i] })
  return NextResponse.json(out)
}
