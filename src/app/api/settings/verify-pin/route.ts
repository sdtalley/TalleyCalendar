import { NextRequest, NextResponse } from 'next/server'
import { getSettings } from '@/lib/redis'

// POST /api/settings/verify-pin
// Body: { pin: string }
// Returns: { required: boolean, valid: boolean }
export async function POST(req: NextRequest) {
  const settings = await getSettings()
  const pin = settings.settingsPin

  // No PIN configured — always allow
  if (!pin) {
    return NextResponse.json({ required: false, valid: true })
  }

  const body = await req.json()
  const valid = body.pin === pin

  return NextResponse.json({ required: true, valid })
}

// GET /api/settings/verify-pin — check if PIN is required
export async function GET() {
  const settings = await getSettings()
  return NextResponse.json({ required: !!settings.settingsPin })
}
