'use client'

import { useState } from 'react'
import { NavSidebar, type TabId } from './NavSidebar'
import { TopBar } from './TopBar'
import { CalendarTab } from '@/components/tabs/CalendarTab'
import { TasksTab } from '@/components/tabs/TasksTab'
import { RewardsTab } from '@/components/tabs/RewardsTab'
import { MealsTab } from '@/components/tabs/MealsTab'
import { ListsTab } from '@/components/tabs/ListsTab'
import { SleepTab } from '@/components/tabs/SleepTab'
import { useScreenDim } from '@/hooks/useScreenDim'

export function AppShell() {
  useScreenDim()

  const [activeTab, setActiveTab] = useState<TabId>('calendar')

  return (
    // Mobile (flex-col): TopBar + content on top, NavSidebar on bottom (order-last)
    // Desktop (md:flex-row): NavSidebar on left (order-first), rest on right
    <div className="flex flex-col md:flex-row h-screen overflow-hidden">
      {/* Main area — flex-1 fills all remaining space */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <TopBar />
        <div className="flex-1 overflow-hidden">
          {activeTab === 'calendar' && <CalendarTab />}
          {activeTab === 'tasks'    && <TasksTab />}
          {activeTab === 'rewards'  && <RewardsTab />}
          {activeTab === 'meals'    && <MealsTab />}
          {activeTab === 'lists'    && <ListsTab />}
          {activeTab === 'sleep'    && <SleepTab />}
        </div>
      </div>

      {/* NavSidebar: left on desktop (order-first), bottom on mobile (order-last) */}
      <NavSidebar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}
