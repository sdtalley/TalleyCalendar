import { NextRequest, NextResponse } from 'next/server'
import { adjustStarBalance, logStarTransaction } from '@/lib/redis'
import { parseBody, z } from '@/lib/validate'

const AdjustSchema = z.object({
  delta:  z.number().int().refine(n => n !== 0, 'delta must be non-zero'),
  reason: z.string().optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params
  const result = await parseBody(req, AdjustSchema)
  if (result.error) return result.response
  const { delta, reason } = result.data

  const newBalance = await adjustStarBalance(memberId, delta)
  await logStarTransaction({
    id: crypto.randomUUID(),
    memberId,
    delta,
    reason: 'manual',
    label: reason ?? (delta > 0 ? 'Stars added' : 'Stars removed'),
    timestamp: new Date().toISOString(),
  })

  return NextResponse.json({ newBalance })
}
