import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'

// POST /api/system/minimize
// Minimizes the Chromium kiosk window so the user can access the Lubuntu desktop
// for native app access (terminal, file manager, onboard for GTK apps, etc.).
//
// Guards:
//   1. NEXT_PUBLIC_LOCAL_MODE=true must be set (absent on Vercel)
//   2. Request must originate from localhost (127.0.0.1 or ::1)
//
// Requires xdotool installed on the Optiplex: sudo apt install xdotool
export async function POST(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_LOCAL_MODE !== 'true') {
    return NextResponse.json({ error: 'Not available on this host' }, { status: 501 })
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  if (ip !== '127.0.0.1' && ip !== '::1') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    execSync('xdotool search --name "Chromium" windowminimize', { timeout: 3000 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `xdotool failed: ${msg}` }, { status: 500 })
  }
}
