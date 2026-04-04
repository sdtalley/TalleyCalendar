import { NextRequest, NextResponse } from 'next/server'
import { createOAuthState, appUrl } from '@/lib/oauth-state'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

// GET /api/auth/google/connect?memberId=...&calendarType=...
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const memberId = searchParams.get('memberId')
  const calendarType = searchParams.get('calendarType') ?? 'personal'

  if (!memberId) {
    return NextResponse.json({ error: 'memberId is required' }, { status: 400 })
  }

  const state = await createOAuthState(memberId, calendarType)
  const redirectUri = `${appUrl()}/api/auth/google`

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  })

  return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params}`)
}
