import { NextRequest, NextResponse } from 'next/server'
import { getLists, createList, updateList } from '@/lib/redis'
import { parseBody, z } from '@/lib/validate'

const PostSchema = z.object({
  title:            z.string().min(1),
  type:             z.enum(['todo', 'grocery', 'other']),
  color:            z.string().min(1),
  isGroceryDefault: z.boolean().optional(),
})

// GET /api/lists
export async function GET() {
  const lists = await getLists()
  return NextResponse.json(lists)
}

// POST /api/lists
export async function POST(req: NextRequest) {
  const result = await parseBody(req, PostSchema)
  if (result.error) return result.response

  if (result.data.isGroceryDefault) {
    const all = await getLists()
    await Promise.all(
      all.filter(l => l.isGroceryDefault)
         .map(l => updateList(l.id, { isGroceryDefault: false, updatedAt: new Date().toISOString() }))
    )
  }

  const now = new Date().toISOString()
  const list = { id: crypto.randomUUID(), ...result.data, items: [], createdAt: now, updatedAt: now }
  await createList(list)
  return NextResponse.json(list, { status: 201 })
}
