import { NextRequest, NextResponse } from 'next/server'
import { getAllAccounts, getFamilyMembers, getLocalEvents } from '@/lib/redis'
import { fetchGoogleEvents } from '@/lib/calendar/google'
import { fetchOutlookEvents } from '@/lib/calendar/outlook'
import { fetchAppleEvents } from '@/lib/calendar/apple'
import { expandRecurringEvents } from '@/lib/calendar/recurrence'
import { normalizeLocalEvent } from '@/lib/calendar/local'
import type { CalendarEvent } from '@/lib/calendar/types'

// GET /api/calendars?start=ISO&end=ISO
// Fetches events from all connected accounts, normalizes, and returns unified list
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const startParam = searchParams.get('start')
  const endParam = searchParams.get('end')

  // Default to current month ± 1 week buffer
  const now = new Date()
  const timeMin = startParam
    ? new Date(startParam)
    : new Date(now.getFullYear(), now.getMonth(), 1 - 7)
  const timeMax = endParam
    ? new Date(endParam)
    : new Date(now.getFullYear(), now.getMonth() + 1, 7)

  const [accounts, members] = await Promise.all([
    getAllAccounts(),
    getFamilyMembers(),
  ])

  const memberColors = new Map(members.map(m => [m.id, m.color]))

  const allEvents: CalendarEvent[] = []
  const errors: { accountId: string; provider: string; error: string }[] = []

  // Fetch from all accounts in parallel
  const connectedAccounts = accounts.filter(a => a.status === 'connected')

  const results = await Promise.allSettled(
    connectedAccounts.map(async account => {
      let events: CalendarEvent[] = []
      switch (account.provider) {
        case 'google':
          events = await fetchGoogleEvents(account, timeMin, timeMax)
          break
        case 'outlook':
          events = await fetchOutlookEvents(account, timeMin, timeMax)
          break
        case 'apple':
          events = await fetchAppleEvents(account, timeMin, timeMax)
          break
      }

      // Fill in color from family member
      const color = memberColors.get(account.familyMemberId) ?? '#6c8cff'
      return events.map(e => ({ ...e, color }))
    })
  )

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === 'fulfilled') {
      allEvents.push(...result.value)
    } else {
      const account = connectedAccounts[i]
      errors.push({
        accountId: account.id,
        provider: account.provider,
        error: result.reason?.message ?? 'Unknown error',
      })
    }
  }

  // Add local events for localOnly members, filtered to the requested window
  const localMembers = members.filter(m => m.localOnly)
  const localResults = await Promise.allSettled(
    localMembers.map(m => getLocalEvents(m.id))
  )
  for (let i = 0; i < localResults.length; i++) {
    const result = localResults[i]
    if (result.status !== 'fulfilled') continue
    const member = localMembers[i]
    for (const le of result.value) {
      const start = new Date(le.start)
      const end = new Date(le.end)
      if (end < timeMin || start > timeMax) continue
      allEvents.push(normalizeLocalEvent(le, member))
    }
  }

  // Expand recurring events into individual instances
  const expandedEvents = expandRecurringEvents(allEvents, timeMin, timeMax)

  // Sort by start time
  expandedEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

  return NextResponse.json({
    events: expandedEvents,
    errors: errors.length > 0 ? errors : undefined,
    _debug: {
      totalAccounts: accounts.length,
      connectedAccounts: connectedAccounts.length,
      totalMembers: members.length,
      totalEvents: expandedEvents.length,
    },
  })
}
