import { NextRequest, NextResponse } from 'next/server'
import { getNote, setNote } from '@/lib/redis'

// GET /api/notes?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  if (!date) {
    return NextResponse.json({ error: 'date parameter required' }, { status: 400 })
  }
  const content = await getNote(date)
  return NextResponse.json({ date, content })
}

// PUT /api/notes
// Body: { date: string, content: string }
export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { date, content } = body
  if (!date) {
    return NextResponse.json({ error: 'date required' }, { status: 400 })
  }
  await setNote(date, content ?? '')
  return NextResponse.json({ date, content: content ?? '' })
}
