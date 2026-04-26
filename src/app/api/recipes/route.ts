import { NextRequest, NextResponse } from 'next/server'
import { getRecipes, createRecipe } from '@/lib/redis'
import { parseBody, z } from '@/lib/validate'

const PostSchema = z.object({
  name:         z.string().min(1),
  category:     z.string().min(1),
  instructions: z.string(),
  ingredients:  z.array(z.string()),
  sourceUrl:    z.string().optional(),
})

export async function GET() {
  const recipes = await getRecipes()
  return NextResponse.json(recipes)
}

export async function POST(req: NextRequest) {
  const result = await parseBody(req, PostSchema)
  if (result.error) return result.response
  const now = new Date().toISOString()
  const recipe = { id: crypto.randomUUID(), ...result.data, createdAt: now, updatedAt: now }
  await createRecipe(recipe)
  return NextResponse.json(recipe, { status: 201 })
}
