import { NextRequest, NextResponse } from 'next/server'
import { getReward, updateReward, getStarBalance, adjustStarBalance, logStarTransaction } from '@/lib/redis'
import { parseBody, z } from '@/lib/validate'

const RedeemSchema = z.object({ memberId: z.string().min(1) })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await parseBody(req, RedeemSchema)
  if (result.error) return result.response
  const { memberId } = result.data

  const reward = await getReward(id)
  if (!reward) return NextResponse.json({ error: 'Reward not found' }, { status: 404 })
  if (!reward.memberIds.includes(memberId))
    return NextResponse.json({ error: 'Reward not available for this member' }, { status: 403 })

  if (!reward.recurring) {
    const already = reward.redeemedByMemberIds ?? []
    if (already.includes(memberId))
      return NextResponse.json({ error: 'Already redeemed' }, { status: 409 })
  }

  const balance = await getStarBalance(memberId)
  if (balance < reward.starCost)
    return NextResponse.json({ error: 'Insufficient stars' }, { status: 402 })

  const newBalance = await adjustStarBalance(memberId, -reward.starCost)

  await logStarTransaction({
    id: crypto.randomUUID(),
    memberId,
    delta: -reward.starCost,
    reason: `redemption:${id}`,
    label: `Redeemed: ${reward.title}`,
    timestamp: new Date().toISOString(),
  })

  if (!reward.recurring) {
    const already = reward.redeemedByMemberIds ?? []
    await updateReward(id, { redeemedByMemberIds: [...already, memberId] })
  }

  return NextResponse.json({ ok: true, newBalance })
}
