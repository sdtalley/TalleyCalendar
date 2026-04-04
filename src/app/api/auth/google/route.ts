import { NextRequest, NextResponse } from 'next/server'
import { saveAccount } from '@/lib/redis'
import { verifyOAuthState, appUrl } from '@/lib/oauth-state'
import { discoverGoogleCalendars } from '@/lib/calendar/google'
import type { ConnectedAccount, OAuthCredentials } from '@/lib/calendar/types'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'

// GET /api/auth/google?code=...&state=...
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const stateRaw = searchParams.get('state')
  const error = searchParams.get('error')
  const base = appUrl()

  if (error) {
    return NextResponse.redirect(`${base}/settings?error=google_${error}`)
  }

  if (!code || !stateRaw) {
    return NextResponse.redirect(`${base}/settings?error=google_missing_params`)
  }

  // Verify signed state + consume nonce
  const state = await verifyOAuthState(stateRaw)
  if (!state) {
    return NextResponse.redirect(`${base}/settings?error=google_invalid_state`)
  }

  const redirectUri = `${base}/api/auth/google`

  // Exchange code for tokens
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${base}/settings?error=google_token_exchange`)
  }

  const tokenData = await tokenRes.json()

  // Get user email
  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })
  const userData = userRes.ok ? await userRes.json() : { email: 'unknown' }

  const auth: OAuthCredentials = {
    type: 'oauth',
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt: Date.now() + tokenData.expires_in * 1000,
  }

  const account: ConnectedAccount = {
    id: crypto.randomUUID(),
    provider: 'google',
    familyMemberId: state.memberId,
    label: `${userData.email?.split('@')[0]}'s Google`,
    email: userData.email ?? 'unknown',
    calendarType: state.calendarType as ConnectedAccount['calendarType'],
    auth,
    enabledCalendars: [],
    status: 'connected',
    connectedAt: new Date().toISOString(),
  }

  await saveAccount(account)

  // Discover calendars
  try {
    const calendars = await discoverGoogleCalendars(account)
    account.enabledCalendars = calendars.map(c => ({ ...c, enabled: true }))
    await saveAccount(account)
  } catch {
    // Account saved, calendar discovery can be retried
  }

  return NextResponse.redirect(`${base}/settings?success=google`)
}
