import { NextRequest, NextResponse } from 'next/server'
import { getList, updateList, deleteList } from '@/lib/redis'
import { parseBody, z } from '@/lib/validate'

const PatchSchema = z.object({
  title: z.string().min(1).optional(),
  type:  z.enum(['todo', 'grocery', 'other']).optional(),
  color: z.string().min(1).optional(),
})

// PATCH /api/lists/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const result = await parseBody(req, PatchSchema)
  if (result.error) return result.response

  const updated = await updateList(params.id, { ...result.data, updatedAt: new Date().toISOString() })
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}

// DELETE /api/lists/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const list = await getList(params.id)
  if (!list) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await deleteList(params.id)
  return NextResponse.json({ ok: true })
}
