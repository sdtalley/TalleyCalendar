import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

function mealKey(date: string) {
  return `meal:${date}`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  if (date) {
    const meal = await redis.get<{ name: string }>(mealKey(date))
    return NextResponse.json({ date, name: meal?.name ?? '' })
  }

  if (start && end) {
    const startDate = new Date(start + 'T00:00:00')
    const endDate = new Date(end + 'T00:00:00')
    const dates: string[] = []
    const cur = new Date(startDate)
    while (cur <= endDate) {
      dates.push(
        `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
      )
      cur.setDate(cur.getDate() + 1)
    }

    const meals = await Promise.all(dates.map(d => redis.get<{ name: string }>(mealKey(d))))
    const result: Record<string, string> = {}
    dates.forEach((d, i) => {
      result[d] = meals[i]?.name ?? ''
    })
    return NextResponse.json(result)
  }

  return NextResponse.json({ error: 'date or start/end required' }, { status: 400 })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { date, name } = body as { date: string; name: string }

  if (!date || typeof name !== 'string') {
    return NextResponse.json({ error: 'date and name required' }, { status: 400 })
  }

  if (name.trim() === '') {
    await redis.del(mealKey(date))
  } else {
    await redis.set(mealKey(date), { name: name.trim() })
  }

  return NextResponse.json({ date, name: name.trim() })
}
