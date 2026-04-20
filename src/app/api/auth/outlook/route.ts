import { NextRequest, NextResponse } from 'next/server'
import { saveAccount, getAccount, updateAccount } from '@/lib/redis'
import { verifyOAuthState, appUrl } from '@/lib/oauth-state'
import { discoverOutlookCalendars } from '@/lib/calendar/outlook'
import type { ConnectedAccount, OAuthCredentials } from '@/lib/calendar/types'

const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
const GRAPH_API = 'https://graph.microsoft.com/v1.0'

// GET /api/auth/outlook?code=...&state=...
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const stateRaw = searchParams.get('state')
  const error = searchParams.get('error')
  const base = appUrl()

  if (error) {
    return NextResponse.redirect(`${base}/settings?error=outlook_${error}`)
  }

  if (!code || !stateRaw) {
    return NextResponse.redirect(`${base}/settings?error=outlook_missing_params`)
  }

  const state = await verifyOAuthState(stateRaw)
  if (!state) {
    return NextResponse.redirect(`${base}/settings?error=outlook_invalid_state`)
  }

  const redirectUri = `${base}/api/auth/outlook`

  // Exchange code for tokens
  const tokenRes = await fetch(MS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.AZURE_CLIENT_ID!,
      client_secret: process.env.AZURE_CLIENT_SECRET!,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      scope: 'Calendars.ReadWrite User.Read offline_access',
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${base}/settings?error=outlook_token_exchange`)
  }

  const tokenData = await tokenRes.json()

  // Get user profile
  const userRes = await fetch(`${GRAPH_API}/me`, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })
  const userData = userRes.ok
    ? await userRes.json()
    : { mail: 'unknown', userPrincipalName: 'unknown', displayName: 'Outlook' }

  const email = userData.mail ?? userData.userPrincipalName ?? 'unknown'

  const auth: OAuthCredentials = {
    type: 'oauth',
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt: Date.now() + tokenData.expires_in * 1000,
  }

  // Reconnect: update existing account's tokens, preserve all other settings
  if (state.accountId) {
    const existing = await getAccount(state.accountId)
    if (existing) {
      const updated = await updateAccount(state.accountId, {
        auth,
        status: 'connected',
        lastSyncAt: new Date().toISOString(),
      })
      if (updated) {
        return NextResponse.redirect(`${base}/settings?success=outlook_reconnect`)
      }
    }
    // Fallthrough: account not found, treat as new connection
  }

  const account: ConnectedAccount = {
    id: crypto.randomUUID(),
    provider: 'outlook',
    familyMemberId: state.memberId,
    label: `${userData.displayName ?? email.split('@')[0]}'s Outlook`,
    email,
    calendarType: state.calendarType as ConnectedAccount['calendarType'],
    auth,
    enabledCalendars: [],
    status: 'connected',
    connectedAt: new Date().toISOString(),
  }

  await saveAccount(account)

  try {
    const calendars = await discoverOutlookCalendars(account)
    account.enabledCalendars = calendars.map(c => ({ ...c, enabled: true }))
    await saveAccount(account)
  } catch {
    // Account saved, calendar discovery can be retried
  }

  return NextResponse.redirect(`${base}/settings?success=outlook`)
}
