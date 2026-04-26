import { NextRequest, NextResponse } from 'next/server'
import { getRecipe, updateRecipe, deleteRecipe } from '@/lib/redis'
import { parseBody, z } from '@/lib/validate'

const PatchSchema = z.object({
  name:         z.string().min(1).optional(),
  category:     z.string().optional(),
  instructions: z.string().optional(),
  ingredients:  z.array(z.string()).optional(),
  sourceUrl:    z.string().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const recipe = await getRecipe(params.id)
  if (!recipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(recipe)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const result = await parseBody(req, PatchSchema)
  if (result.error) return result.response
  const updated = await updateRecipe(params.id, { ...result.data, updatedAt: new Date().toISOString() })
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const recipe = await getRecipe(params.id)
  if (!recipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await deleteRecipe(params.id)
  return NextResponse.json({ ok: true })
}
