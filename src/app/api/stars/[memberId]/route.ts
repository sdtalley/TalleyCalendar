import { NextResponse } from 'next/server'
import { getStarBalance, getStarTransactions } from '@/lib/redis'

export async function GET(_req: Request, { params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params
  const [balance, transactions] = await Promise.all([
    getStarBalance(memberId),
    getStarTransactions(memberId),
  ])
  return NextResponse.json({ balance, transactions })
}
