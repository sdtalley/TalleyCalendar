'use client'

import { useState, useEffect } from 'react'
import { InfoBar } from '@/components/layout/InfoBar'
import type { AppSettings } from '@/lib/calendar/types'

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function formatTime12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const ampm = h < 12 ? 'AM' : 'PM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

function nextSleepLabel(from: string, to: string): string {
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const fromMin = timeToMinutes(from)
  const toMin = timeToMinutes(to)

  const isOvernightWindow = fromMin >= toMin
  const inWindow = isOvernightWindow
    ? (nowMin >= fromMin || nowMin < toMin)
    : (nowMin >= fromMin && nowMin < toMin)

  if (inWindow) return 'Currently sleeping'

  // Time until sleep
  let minsUntilFrom = fromMin - nowMin
  if (minsUntilFrom < 0) minsUntilFrom += 24 * 60
  const hoursUntil = Math.floor(minsUntilFrom / 60)
  const minsRem = minsUntilFrom % 60

  if (hoursUntil === 0) return `In ${minsRem} minute${minsRem !== 1 ? 's' : ''} (at ${formatTime12(from)})`
  if (minsRem === 0) return `In ${hoursUntil} hour${hoursUntil !== 1 ? 's' : ''} (at ${formatTime12(from)})`
  return `In ${hoursUntil}h ${minsRem}m (at ${formatTime12(from)})`
}

export function SleepTab() {
  const [enabled, setEnabled] = useState(false)
  const [from, setFrom]       = useState('00:00')
  const [to, setTo]           = useState('06:00')
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((s: AppSettings) => {
        if (s.sleepSchedule) {
          setEnabled(s.sleepSchedule.enabled)
          setFrom(s.sleepSchedule.from)
          setTo(s.sleepSchedule.to)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sleepSchedule: { enabled, from, to } }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <InfoBar />
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-6 py-8">
        <div
          className="w-full max-w-sm rounded-2xl p-8 flex flex-col gap-6"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {/* Header */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 32 }}>🌙</span>
              <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Sleep Schedule</h2>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
              Hardware sleep suspends the display completely. Touch to wake.
            </p>
          </div>

          {loading ? (
            <div className="text-sm" style={{ color: 'var(--text-faint)' }}>Loading…</div>
          ) : (
            <>
              {/* Enable toggle */}
              <label className="flex items-center gap-3 cursor-pointer" style={{ color: 'var(--text)' }}>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={e => setEnabled(e.target.checked)}
                  style={{ accentColor: 'var(--accent)', width: 18, height: 18 }}
                />
                <span className="text-sm font-medium">Enable sleep schedule</span>
              </label>

              {/* Time pickers */}
              <div className="flex gap-4">
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>
                    Sleep at
                  </label>
                  <input
                    type="time"
                    value={from}
                    disabled={!enabled}
                    onChange={e => setFrom(e.target.value)}
                    style={{ opacity: enabled ? 1 : 0.4 }}
                  />
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>
                    Wake at
                  </label>
                  <input
                    type="time"
                    value={to}
                    disabled={!enabled}
                    onChange={e => setTo(e.target.value)}
                    style={{ opacity: enabled ? 1 : 0.4 }}
                  />
                </div>
              </div>

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="settings-btn-primary"
              >
                {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
              </button>

              {/* Status */}
              {enabled && (
                <div
                  className="rounded-xl px-4 py-3 text-sm flex flex-col gap-1"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
                >
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-dim)' }}>Next sleep</span>
                    <span style={{ color: 'var(--text)' }}>{nextSleepLabel(from, to)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-dim)' }}>Wake time</span>
                    <span style={{ color: 'var(--text)' }}>{formatTime12(to)}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
