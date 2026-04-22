import { NextRequest, NextResponse } from 'next/server'
import { clearCheckedItems } from '@/lib/redis'

// POST /api/lists/[id]/clear-checked
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const updated = await clearCheckedItems(params.id)
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}
