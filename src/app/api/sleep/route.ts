import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { getSettings } from '@/lib/redis'

// POST /api/sleep
// Puts the machine into hardware suspend via rtcwake, with the RTC alarm set to
// wake at the configured sleepSchedule.to time.
//
// Guards:
//   1. ENABLE_SYSTEM_SLEEP=true must be set in .env.local (absent on Vercel)
//   2. Request must originate from localhost (127.0.0.1 or ::1)
//
// On Vercel or non-local callers: returns 501 so the client falls back to CSS overlay.
export async function POST(req: NextRequest) {
  if (process.env.ENABLE_SYSTEM_SLEEP !== 'true') {
    return NextResponse.json({ error: 'System sleep not enabled on this host' }, { status: 501 })
  }

  // Restrict to localhost only
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  if (ip !== '127.0.0.1' && ip !== '::1') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Calculate the next wake time as a Unix timestamp
  const settings = await getSettings()
  const wakeTo = settings.sleepSchedule?.to ?? '06:00'
  const wakeTimestamp = nextOccurrenceUnix(wakeTo)

  try {
    // rtcwake: suspend to RAM (mem) and set RTC alarm to wake at wakeTimestamp
    execSync(`sudo rtcwake -m mem -t ${wakeTimestamp}`, { timeout: 5000 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `rtcwake failed: ${msg}` }, { status: 500 })
  }
}

// Returns the Unix timestamp (seconds) for the next occurrence of HH:MM.
// If that time is in the past today, returns tomorrow's occurrence.
function nextOccurrenceUnix(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  const now = new Date()
  const candidate = new Date(now)
  candidate.setHours(h, m, 0, 0)
  if (candidate <= now) {
    candidate.setDate(candidate.getDate() + 1)
  }
  return Math.floor(candidate.getTime() / 1000)
}
