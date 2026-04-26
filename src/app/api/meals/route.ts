import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import type { DayMeals } from '@/lib/calendar/types'

function newKey(date: string)    { return `meals:${date}` }
function legacyKey(date: string) { return `meal:${date}` }

const EMPTY: DayMeals = { breakfast: [], lunch: [], dinner: [], snack: [] }

function dateRange(start: string, end: string): string[] {
  const dates: string[] = []
  const cur  = new Date(start + 'T00:00:00')
  const last = new Date(end   + 'T00:00:00')
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end   = searchParams.get('end')
  if (!start || !end) {
    return NextResponse.json({ error: 'start and end required' }, { status: 400 })
  }

  const dates = dateRange(start, end)

  // Fetch all new-format keys in one mget round-trip (1 Redis command vs. 7)
  const rawData = await redis.mget<(DayMeals | null)[]>(...dates.map(newKey) as [string, ...string[]])

  // For any null results, check legacy single-dinner keys (lazy migration path)
  const results = await Promise.all(
    dates.map(async (date, i) => {
      const data = rawData[i]
      if (data) return data
      const legacy = await redis.get<{ name: string }>(legacyKey(date))
      if (legacy?.name) {
        return { ...EMPTY, dinner: [{ id: `migrated-${date}`, name: legacy.name }] } as DayMeals
      }
      return EMPTY
    })
  )

  const out: Record<string, DayMeals> = {}
  dates.forEach((d, i) => { out[d] = results[i] })
  return NextResponse.json(out)
}
