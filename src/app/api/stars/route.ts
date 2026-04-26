import { NextResponse } from 'next/server'
import { getFamilyMembers, getAllStarBalances } from '@/lib/redis'

export async function GET() {
  const members = await getFamilyMembers()
  const balances = await getAllStarBalances(members.map(m => m.id))
  return NextResponse.json(balances)
}
