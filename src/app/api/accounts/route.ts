import { NextRequest, NextResponse } from 'next/server'
import { getAllAccounts, removeAccount } from '@/lib/redis'

// GET /api/accounts — list all connected accounts (across all family members)
export async function GET() {
  const accounts = await getAllAccounts()

  // Strip auth credentials from the response (tokens should never reach the client)
  const safe = accounts.map(({ auth, ...rest }) => ({
    ...rest,
    authType: auth.type,
  }))

  return NextResponse.json(safe)
}

// DELETE /api/accounts — remove a connected account
// Body: { id: string }
export async function DELETE(req: NextRequest) {
  const body = await req.json()
  const { id } = body

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const removed = await removeAccount(id)
  if (!removed) {
    return NextResponse.json({ error: 'account not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
