import { NextRequest, NextResponse } from 'next/server'
import { createOAuthState, appUrl } from '@/lib/oauth-state'

const MS_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
const SCOPES = 'Calendars.ReadWrite User.Read offline_access'

// GET /api/auth/outlook/connect?memberId=...&calendarType=...&reconnectAccountId=...
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const memberId = searchParams.get('memberId')
  const calendarType = searchParams.get('calendarType') ?? 'personal'
  const reconnectAccountId = searchParams.get('reconnectAccountId') ?? undefined

  if (!memberId) {
    return NextResponse.json({ error: 'memberId is required' }, { status: 400 })
  }

  const state = await createOAuthState(memberId, calendarType, reconnectAccountId)
  const redirectUri = `${appUrl()}/api/auth/outlook`

  const params = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: SCOPES,
    state,
    prompt: 'consent',
  })

  return NextResponse.redirect(`${MS_AUTH_URL}?${params}`)
}
