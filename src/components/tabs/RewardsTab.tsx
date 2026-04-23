'use client'

import { InfoBar } from '@/components/layout/InfoBar'

export function RewardsTab() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <InfoBar />
      <div className="flex flex-col items-center justify-center flex-1 gap-3" style={{ color: 'var(--text-dim)' }}>
        <span style={{ fontSize: 48 }}>⭐</span>
        <div className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Stars &amp; Rewards</div>
        <div className="text-sm">Earn stars, redeem rewards — coming in Phase 3B</div>
      </div>
    </div>
  )
}
