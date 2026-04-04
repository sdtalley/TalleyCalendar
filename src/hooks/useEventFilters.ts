'use client'

import { useState, useCallback, useMemo } from 'react'
import type { CalendarEvent, FamilyMemberUI } from '@/lib/calendar/types'

export const DEFAULT_CAL_TYPES = [
  { id: 'personal', name: 'Personal', enabled: true },
  { id: 'work', name: 'Work', enabled: true },
  { id: 'kids', name: 'Kids Activities', enabled: true },
  { id: 'shared', name: 'Shared / Family', enabled: true },
]

export function useEventFilters(
  allEvents: CalendarEvent[],
  members: FamilyMemberUI[]
) {
  // Only store toggle overrides — the member list itself comes from props
  const [disabledMembers, setDisabledMembers] = useState<Set<string>>(new Set())
  const [calTypes, setCalTypes] = useState(DEFAULT_CAL_TYPES)

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
