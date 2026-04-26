import { NextRequest, NextResponse } from 'next/server'
import { getRewards, createReward } from '@/lib/redis'
import { parseBody, z } from '@/lib/validate'

const PostSchema = z.object({
  title:     z.string().min(1),
  emoji:     z.string().optional(),
  starCost:  z.number().int().min(1).max(500),
  memberIds: z.array(z.string()).min(1),
  recurring: z.boolean(),
})

export async function GET() {
  return NextResponse.json(await getRewards())
}

export async function POST(req: NextRequest) {
  const result = await parseBody(req, PostSchema)
  if (result.error) return result.response

  const reward = {
    id: crypto.randomUUID(),
    ...result.data,
    redeemedByMemberIds: [],
    createdAt: new Date().toISOString(),
  }
  await createReward(reward)
  return NextResponse.json(reward, { status: 201 })
}
