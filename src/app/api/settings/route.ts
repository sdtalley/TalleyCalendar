import { NextRequest, NextResponse } from 'next/server'
import { getSettings, updateSettings } from '@/lib/redis'

// GET /api/settings — get app settings
export async function GET() {
  const settings = await getSettings()
  return NextResponse.json(settings)
}

// PUT /api/settings — update app settings
// Body: Partial<AppSettings>
export async function PUT(req: NextRequest) {
  const body = await req.json()
  const updated = await updateSettings(body)
  return NextResponse.json(updated)
}
