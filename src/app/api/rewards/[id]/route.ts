import { NextRequest, NextResponse } from 'next/server'
import { getReward, updateReward, deleteReward } from '@/lib/redis'
import { parseBody, z } from '@/lib/validate'

const PatchSchema = z.object({
  title:     z.string().min(1).optional(),
  emoji:     z.string().optional(),
  starCost:  z.number().int().min(1).max(500).optional(),
  memberIds: z.array(z.string()).min(1).optional(),
  recurring: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await parseBody(req, PatchSchema)
  if (result.error) return result.response

  const updated = await updateReward(id, result.data)
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const reward = await getReward(id)
  if (!reward) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await deleteReward(id)
  return NextResponse.json({ ok: true })
}
