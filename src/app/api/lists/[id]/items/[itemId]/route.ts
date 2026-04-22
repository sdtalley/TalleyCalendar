import { NextRequest, NextResponse } from 'next/server'
import { updateListItem, deleteListItem } from '@/lib/redis'
import { parseBody, z } from '@/lib/validate'

const PatchSchema = z.object({
  text:        z.string().min(1).optional(),
  checked:     z.boolean().optional(),
  subcategory: z.string().optional(),
  order:       z.number().int().min(0).optional(),
})

// PATCH /api/lists/[id]/items/[itemId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const result = await parseBody(req, PatchSchema)
  if (result.error) return result.response

  const updated = await updateListItem(params.id, params.itemId, result.data)
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}

// DELETE /api/lists/[id]/items/[itemId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const updated = await deleteListItem(params.id, params.itemId)
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}
