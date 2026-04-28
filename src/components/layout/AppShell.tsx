'use client'

import { useState, useEffect } from 'react'
import { NavSidebar, type TabId } from './NavSidebar'
import { CalendarTab } from '@/components/tabs/CalendarTab'
import { TasksTab } from '@/components/tabs/TasksTab'
import { RewardsTab } from '@/components/tabs/RewardsTab'
import { MealsTab } from '@/components/tabs/MealsTab'
import { ListsTab } from '@/components/tabs/ListsTab'
import { SleepTab } from '@/components/tabs/SleepTab'
import { Screensaver } from '@/components/screensaver/Screensaver'
import { VirtualKeyboard } from '@/components/keyboard/VirtualKeyboard'
import { useSleepSchedule } from '@/hooks/useSleepSchedule'
import { useVirtualKeyboard } from '@/hooks/useVirtualKeyboard'
import type { ScreensaverSettings } from '@/lib/calendar/types'

export function AppShell() {
  const { isSleeping, wakeNow } = useSleepSchedule()
  const keyboard = useVirtualKeyboard()

  const [activeTab, setActiveTab] = useState<TabId>('calendar')
  const [suppressScreensaver, setSuppressScreensaver] = useState(false)
  const [screensaverSettings, setScreensaverSettings] = useState<ScreensaverSettings | null>(null)

  // Fetch screensaver settings once on mount
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(s => { if (s.screensaver) setScreensaverSettings(s.screensaver) })
      .catch(() => {})
  }, [])

  return (
    // Mobile (flex-col): content on top, NavSidebar on bottom (order-last)
    // Desktop (md:flex-row): NavSidebar on left (order-first), rest on right
    // Each tab renders its own InfoBar — no global TopBar needed
    <div className="flex flex-col md:flex-row h-screen overflow-hidden">
      {/* Main area — flex-1 fills all remaining space */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="flex-1 overflow-hidden">
          {activeTab === 'calendar' && <CalendarTab />}
          {activeTab === 'tasks'    && <TasksTab />}
          {activeTab === 'rewards'  && <RewardsTab />}
          {activeTab === 'meals'    && <MealsTab onSuppressScreensaver={setSuppressScreensaver} />}
          {activeTab === 'lists'    && <ListsTab />}
          {activeTab === 'sleep'    && <SleepTab />}
        </div>
      </div>

      {/* NavSidebar: left on desktop (order-first), bottom on mobile (order-last) */}
      <NavSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Sleep overlay: full black screen during sleep window; touch anywhere to wake */}
      {isSleeping && (
        <div
          className="fixed inset-0 bg-black"
          style={{ zIndex: 99998 }}
          onPointerDown={wakeNow}
        />
      )}

      {/* Screensaver: full-screen overlay, mounted once, z-index above everything */}
      {screensaverSettings && (
        <Screensaver settings={screensaverSettings} suppress={suppressScreensaver || isSleeping} />
      )}

      {/* Virtual keyboard: slides up from bottom on input focus (kiosk only) */}
      <VirtualKeyboard
        isVisible={keyboard.isVisible}
        inputType={keyboard.inputType}
        focusedInput={keyboard.focusedInput}
      />
    </div>
  )
}
