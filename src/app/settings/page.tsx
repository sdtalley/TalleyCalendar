'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { FamilyMember, ConnectedAccount, AppSettings } from '@/lib/calendar/types'
import { FamilyMemberList } from '@/components/settings/FamilyMemberList'
import { AccountList } from '@/components/settings/AccountList'
import { AddAccountFlow } from '@/components/settings/AddAccountFlow'

type AccountSafe = Omit<ConnectedAccount, 'auth'> & { authType: string }

export default function SettingsPage() {
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [accounts, setAccounts] = useState<AccountSafe[]>([])
  const [dimStart, setDimStart] = useState('22:00')
  const [dimEnd, setDimEnd] = useState('06:00')
  const [weatherEnabled, setWeatherEnabled] = useState(false)
  const [weatherLat, setWeatherLat] = useState('')
  const [weatherLon, setWeatherLon] = useState('')
  const [weatherLabel, setWeatherLabel] = useState('')
  const [pinLocked, setPinLocked] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addAccountMemberId, setAddAccountMemberId] = useState<string | null>(null)
  const router = useRouter()

  // Check if PIN is required
  useEffect(() => {
    fetch('/api/settings/verify-pin')
      .then(r => r.json())
      .then(data => {
        if (data.required) setPinLocked(true)
      })
      .catch(() => {})
  }, [])

  // Check for OAuth success/error in URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const success = params.get('success')
    const err = params.get('error')
    if (success) {
      // Clean up URL
      window.history.replaceState({}, '', '/settings')
    }
    if (err) {
      setError(`Connection failed: ${err.replace(/_/g, ' ')}`)
      window.history.replaceState({}, '', '/settings')
    }
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const [membersRes, accountsRes, settingsRes] = await Promise.all([
        fetch('/api/family'),
        fetch('/api/accounts'),
        fetch('/api/settings'),
      ])
      if (!membersRes.ok || !accountsRes.ok) {
        setError('Failed to load settings. Check that Redis is configured.')
        return
      }
      setMembers(await membersRes.json())
      setAccounts(await accountsRes.json())
      if (settingsRes.ok) {
        const settings: AppSettings = await settingsRes.json()
        setDimStart(settings.dimSchedule.start)
        setDimEnd(settings.dimSchedule.end)
        if (settings.weather) {
          setWeatherEnabled(settings.weather.enabled)
          setWeatherLat(settings.weather.latitude ? String(settings.weather.latitude) : '')
          setWeatherLon(settings.weather.longitude ? String(settings.weather.longitude) : '')
          setWeatherLabel(settings.weather.label || '')
        }
        setCurrentPin(settings.settingsPin || '')
      }
      setError(null)
    } catch {
      setError('Failed to connect to the server.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Family member handlers ──

  async function handleAddMember(member: Omit<FamilyMember, 'id'>) {
    const res = await fetch('/api/family', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(member),
    })
    if (res.ok) await fetchData()
  }

  async function handleUpdateMember(id: string, updates: Partial<Omit<FamilyMember, 'id'>>) {
    const res = await fetch('/api/family', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    })
    if (res.ok) await fetchData()
  }

  async function handleRemoveMember(id: string) {
    const res = await fetch('/api/family', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) await fetchData()
  }

  // ── Account handlers ──

  async function handleRemoveAccount(accountId: string) {
    if (!confirm('Disconnect this calendar account?')) return
    const res = await fetch('/api/accounts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: accountId }),
    })
    if (res.ok) await fetchData()
  }

  async function handleToggleCalendar(accountId: string, calendarId: string, enabled: boolean) {
    const account = accounts.find(a => a.id === accountId)
    if (!account) return

    const updated = account.enabledCalendars.map(c =>
      c.calendarId === calendarId ? { ...c, enabled } : c
    )

    const res = await fetch(`/api/accounts/${accountId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabledCalendars: updated }),
    })
    if (res.ok) await fetchData()
  }

  async function handlePinSubmit() {
    const res = await fetch('/api/settings/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: pinInput }),
    })
    const data = await res.json()
    if (data.valid) {
      setPinLocked(false)
      setPinError(false)
    } else {
      setPinError(true)
      setPinInput('')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg)' }}>
        <div className="text-lg" style={{ color: 'var(--text-dim)' }}>Loading settings...</div>
      </div>
    )
  }

  // PIN gate
  if (pinLocked) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg)' }}>
        <div
          className="w-[340px] rounded-2xl p-8 flex flex-col items-center gap-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="text-lg font-bold" style={{ color: 'var(--text)' }}>
            Enter Settings PIN
          </div>
          <p className="text-sm text-center" style={{ color: 'var(--text-dim)' }}>
            Settings are PIN-protected to prevent accidental changes.
          </p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            placeholder="PIN"
            value={pinInput}
            onChange={e => {
              setPinInput(e.target.value.replace(/\D/g, ''))
              setPinError(false)
            }}
            onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
            className="text-center text-2xl tracking-[0.3em] w-full"
            autoFocus
            style={pinError ? { borderColor: '#ff6b6b' } : undefined}
          />
          {pinError && (
            <div className="text-sm" style={{ color: '#ff6b6b' }}>Incorrect PIN</div>
          )}
          <div className="flex gap-3 w-full">
            <Link
              href="/"
              className="flex-1 text-center px-4 py-2.5 rounded-[8px] text-sm font-medium no-underline transition-all duration-150"
              style={{ background: 'var(--surface2)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}
            >
              Cancel
            </Link>
            <button
              onClick={handlePinSubmit}
              className="flex-1 settings-btn-primary"
            >
              Unlock
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4 sticky top-0 z-10"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium no-underline transition-colors duration-150"
            style={{ color: 'var(--text-dim)' }}
          >
            ← Back to Calendar
          </Link>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Settings</h1>
        </div>
        <button
          onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST' })
            router.push('/login')
          }}
          className="settings-btn-ghost"
          style={{ color: 'var(--text-faint)' }}
        >
          Sign Out
        </button>
      </header>

      {/* Error banner */}
      {error && (
        <div
          className="mx-6 mt-4 px-4 py-3 rounded-xl text-sm flex items-center justify-between"
          style={{ background: 'rgba(255,107,107,0.1)', color: '#ff6b6b', border: '1px solid rgba(255,107,107,0.2)' }}
        >
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-4 px-2 py-1 rounded text-xs font-medium cursor-pointer"
            style={{ background: 'rgba(255,107,107,0.2)', border: 'none', color: '#ff6b6b' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col gap-8"
        style={{ overflowY: 'auto', height: 'calc(100vh - 65px)' }}
      >
        {/* Family Members Section */}
        <section
          className="rounded-2xl p-6"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <FamilyMemberList
            members={members}
            onAdd={handleAddMember}
            onUpdate={handleUpdateMember}
            onRemove={handleRemoveMember}
          />
        </section>

        {/* Calendar Accounts Section */}
        <section
          className="rounded-2xl p-6"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <AccountList
            members={members}
            accounts={accounts}
            onAddAccount={memberId => setAddAccountMemberId(memberId)}
            onRemoveAccount={handleRemoveAccount}
            onToggleCalendar={handleToggleCalendar}
          />
        </section>

        {/* Screen Dimming Section */}
        <section
          className="rounded-2xl p-6"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text)' }}>
            Screen Dimming
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-dim)' }}>
            Automatically dim the display during nighttime hours (for kiosk/tablet use).
          </p>
          <div className="flex gap-4 items-end">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="field-label">Dim at</label>
              <input
                type="time"
                value={dimStart}
                onChange={e => setDimStart(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="field-label">Brighten at</label>
              <input
                type="time"
                value={dimEnd}
                onChange={e => setDimEnd(e.target.value)}
              />
            </div>
            <button
              onClick={async () => {
                const res = await fetch('/api/settings', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ dimSchedule: { start: dimStart, end: dimEnd } }),
                })
                if (res.ok) setError(null)
                else setError('Failed to save dim schedule.')
              }}
              className="settings-btn-primary"
              style={{ marginBottom: 2 }}
            >
              Save
            </button>
          </div>
        </section>

        {/* Weather Section */}
        <section
          className="rounded-2xl p-6"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text)' }}>
            Weather
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-dim)' }}>
            Show current weather in the top bar. Uses Open-Meteo (no API key required).
          </p>

          <div className="flex items-center gap-3 mb-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--text)' }}>
              <input
                type="checkbox"
                checked={weatherEnabled}
                onChange={async e => {
                  const enabled = e.target.checked
                  setWeatherEnabled(enabled)
                  if (!enabled) {
                    await fetch('/api/settings', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        weather: { enabled: false, latitude: 0, longitude: 0, label: '' },
                      }),
                    })
                  }
                }}
                style={{ accentColor: 'var(--accent)' }}
              />
              Enable weather widget
            </label>
          </div>

          {weatherEnabled && (
            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="field-label">City / Label</label>
                  <input
                    type="text"
                    placeholder="e.g. Dallas"
                    value={weatherLabel}
                    onChange={e => setWeatherLabel(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="field-label">Latitude</label>
                  <input
                    type="text"
                    placeholder="e.g. 32.7767"
                    value={weatherLat}
                    onChange={e => setWeatherLat(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="field-label">Longitude</label>
                  <input
                    type="text"
                    placeholder="e.g. -96.7970"
                    value={weatherLon}
                    onChange={e => setWeatherLon(e.target.value)}
                  />
                </div>
              </div>
              <div className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                Find your coordinates at{' '}
                <a
                  href="https://www.latlong.net/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent)' }}
                >
                  latlong.net
                </a>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={async () => {
                    const lat = parseFloat(weatherLat)
                    const lon = parseFloat(weatherLon)
                    if (isNaN(lat) || isNaN(lon)) {
                      setError('Enter valid latitude and longitude.')
                      return
                    }
                    const res = await fetch('/api/settings', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        weather: { enabled: true, latitude: lat, longitude: lon, label: weatherLabel },
                      }),
                    })
                    if (res.ok) setError(null)
                    else setError('Failed to save weather settings.')
                  }}
                  className="settings-btn-primary"
                >
                  Save
                </button>
              </div>
            </div>
          )}

        </section>

        {/* Settings PIN Section */}
        <section
          className="rounded-2xl p-6"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text)' }}>
            Settings PIN
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-dim)' }}>
            Require a PIN to access Settings (prevents accidental changes on kiosk displays).
          </p>

          {currentPin ? (
            <div className="flex flex-col gap-3">
              <div className="text-sm" style={{ color: 'var(--text)' }}>
                PIN is currently <strong>enabled</strong>.
              </div>
              <div className="flex gap-3">
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="field-label">New PIN (or leave blank to remove)</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="New PIN"
                    value={newPin}
                    onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const res = await fetch('/api/settings', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ settingsPin: newPin }),
                    })
                    if (res.ok) {
                      setCurrentPin(newPin)
                      setNewPin('')
                      setError(null)
                    }
                  }}
                  className="settings-btn-primary"
                >
                  {newPin ? 'Update PIN' : 'Remove PIN'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="field-label">Set a PIN (numbers only)</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="e.g. 1234"
                    value={newPin}
                    onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (!newPin) return
                    const res = await fetch('/api/settings', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ settingsPin: newPin }),
                    })
                    if (res.ok) {
                      setCurrentPin(newPin)
                      setNewPin('')
                      setError(null)
                    }
                  }}
                  className="settings-btn-primary"
                  disabled={!newPin}
                >
                  Enable PIN
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Add Account Modal */}
      {addAccountMemberId && (
        <AddAccountFlow
          members={members}
          preselectedMemberId={addAccountMemberId}
          onClose={() => setAddAccountMemberId(null)}
          onAppleSaved={fetchData}
        />
      )}
    </div>
  )
}
