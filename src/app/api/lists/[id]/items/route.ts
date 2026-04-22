import { NextRequest, NextResponse } from 'next/server'
import { getList, addListItem } from '@/lib/redis'
import { parseBody, z } from '@/lib/validate'

const PostSchema = z.object({
  text:        z.string().min(1),
  subcategory: z.string().optional(),
})

// POST /api/lists/[id]/items
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const result = await parseBody(req, PostSchema)
  if (result.error) return result.response

  const list = await getList(params.id)
  if (!list) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const maxOrder = list.items.reduce((m, it) => Math.max(m, it.order), -1)
  const item = {
    id:          crypto.randomUUID(),
    text:        result.data.text,
    checked:     false,
    subcategory: result.data.subcategory,
    order:       maxOrder + 1,
  }

  const updated = await addListItem(params.id, item)
  return NextResponse.json(updated, { status: 201 })
}
