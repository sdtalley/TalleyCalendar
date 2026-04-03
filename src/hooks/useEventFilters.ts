'use client'

import { useState, useCallback, useMemo } from 'react'
import type { CalendarEvent, FamilyMember } from '@/lib/calendar/types'

export const DEFAULT_CAL_TYPES = [
  { id: 'personal', name: 'Personal', enabled: true },
  { id: 'work', name: 'Work', enabled: true },
  { id: 'kids', name: 'Kids Activities', enabled: true },
  { id: 'shared', name: 'Shared / Family', enabled: true },
]

export function useEventFilters(
  allEvents: CalendarEvent[],
  initialMembers: FamilyMember[]
) {
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(initialMembers)
  const [calTypes, setCalTypes] = useState(DEFAULT_CAL_TYPES)

  const toggleMember = useCallback((id: string) => {
    setFamilyMembers(prev =>
      prev.map(m => (m.id === id ? { ...m, enabled: !m.enabled } : m))
    )
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
