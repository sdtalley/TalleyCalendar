'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import type { CalendarEvent, FamilyMemberUI } from '@/lib/calendar/types'

const LS_DISABLED_MEMBERS = 'talley_disabled_members'
const LS_CAL_TYPES = 'talley_cal_types'

export const DEFAULT_CAL_TYPES = [
  { id: 'personal', name: 'Personal', enabled: true },
  { id: 'work', name: 'Work', enabled: true },
  { id: 'kids', name: 'Kids Activities', enabled: true },
  { id: 'shared', name: 'Shared / Family', enabled: true },
]

function loadDisabledMembers(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_DISABLED_MEMBERS)
    if (raw) return new Set(JSON.parse(raw) as string[])
  } catch {}
  return new Set()
}

function loadCalTypes() {
  try {
    const raw = localStorage.getItem(LS_CAL_TYPES)
    if (raw) {
      const saved = JSON.parse(raw) as { id: string; enabled: boolean }[]
      return DEFAULT_CAL_TYPES.map(ct => {
        const match = saved.find(s => s.id === ct.id)
        return match ? { ...ct, enabled: match.enabled } : ct
      })
    }
  } catch {}
  return DEFAULT_CAL_TYPES
}

export function useEventFilters(
  allEvents: CalendarEvent[],
  members: FamilyMemberUI[]
) {
  const [disabledMembers, setDisabledMembers] = useState<Set<string>>(loadDisabledMembers)
  const [calTypes, setCalTypes] = useState(loadCalTypes)

  useEffect(() => {
    localStorage.setItem(LS_DISABLED_MEMBERS, JSON.stringify([...disabledMembers]))
  }, [disabledMembers])

  useEffect(() => {
    localStorage.setItem(LS_CAL_TYPES, JSON.stringify(calTypes.map(ct => ({ id: ct.id, enabled: ct.enabled }))))
  }, [calTypes])

  // Derive familyMembers from props + toggle state on every render (no lag)
  const familyMembers: FamilyMemberUI[] = useMemo(
    () => members.map(m => ({ ...m, enabled: !disabledMembers.has(m.id) })),
    [members, disabledMembers]
  )

  const toggleMember = useCallback((id: string) => {
    setDisabledMembers(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleCalType = useCallback((id: string) => {
    setCalTypes(prev =>
      prev.map(ct => (ct.id === id ? { ...ct, enabled: !ct.enabled } : ct))
    )
  }, [])

  const visibleEvents = useMemo(() => {
    const enabledMembers = new Set(familyMembers.filter(m => m.enabled).map(m => m.id))
    const enabledTypes = new Set(calTypes.filter(ct => ct.enabled).map(ct => ct.id))
    return allEvents.filter(
      e => enabledMembers.has(e.familyMemberId) && enabledTypes.has(e.calendarType)
    )
  }, [allEvents, familyMembers, calTypes])

  return {
    familyMembers,
    calTypes,
    visibleEvents,
    toggleMember,
    toggleCalType,
  }
}
