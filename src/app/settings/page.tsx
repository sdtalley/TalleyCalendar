'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { FamilyMember, ConnectedAccount, AppSettings, AppUser, SessionPayload, ScreensaverSettings, ScreensaverMode } from '@/lib/calendar/types'
import { FamilyMemberList } from '@/components/settings/FamilyMemberList'
import { AccountList } from '@/components/settings/AccountList'
import { AddAccountFlow } from '@/components/settings/AddAccountFlow'
import type { DrivePhoto } from '@/app/api/screensaver/photos/route'

type AccountSafe = Omit<ConnectedAccount, 'auth'> & { authType: string }
type UserSafe = Omit<AppUser, 'passwordHash'>

const SS_DEFAULTS: ScreensaverSettings = {
  enabled: true,
  idleMinutes: 3,
  mode: 'slideshow',
  order: 'shuffle',
  secondsPerSlide: 30,
  fill: 'fill',
  showDateTime: true,
  blurBackground: false,
}

export default function SettingsPage() {
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [accounts, setAccounts] = useState<AccountSafe[]>([])
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
  const [session, setSession] = useState<SessionPayload | null>(null)
  const [users, setUsers] = useState<UserSafe[]>([])
  const [userFormOpen, setUserFormOpen] = useState(false)
  const [newUserName, setNewUserName] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserRole, setNewUserRole] = useState<AppUser['role']>('member')
  const [newUserMemberId, setNewUserMemberId] = useState<string>('')
  const [userFormError, setUserFormError] = useState('')

  // Sleep schedule (for display in Settings — full management in SleepTab)
  const [sleepSched, setSleepSched] = useState<AppSettings['sleepSchedule']>({ enabled: false, from: '00:00', to: '06:00' })

  // Screensaver settings state
  const [ss, setSs] = useState<ScreensaverSettings>(SS_DEFAULTS)
  const [ssFolderInput, setSsFolderInput] = useState('')
  const [ssFolderStatus, setSsFolderStatus] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [ssPhotos, setSsPhotos] = useState<DrivePhoto[]>([])
  const [ssPhotoLoading, setSsPhotoLoading] = useState(false)
  const [ssSaving, setSsSaving] = useState(false)

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
      const [membersRes, accountsRes, settingsRes, usersRes, meRes] = await Promise.all([
        fetch('/api/family'),
        fetch('/api/accounts'),
        fetch('/api/settings'),
        fetch('/api/users'),
        fetch('/api/auth/me'),
      ])
      if (meRes.ok) setSession(await meRes.json())
      if (usersRes.ok) setUsers(await usersRes.json())
      if (!membersRes.ok || !accountsRes.ok) {
        setError('Failed to load settings. Check that Redis is configured.')
        return
      }
      setMembers(await membersRes.json())
      setAccounts(await accountsRes.json())
      if (settingsRes.ok) {
        const settings: AppSettings = await settingsRes.json()
        if (settings.weather) {
          setWeatherEnabled(settings.weather.enabled)
          setWeatherLat(settings.weather.latitude ? String(settings.weather.latitude) : '')
          setWeatherLon(settings.weather.longitude ? String(settings.weather.longitude) : '')
          setWeatherLabel(settings.weather.label || '')
        }
        setCurrentPin(settings.settingsPin || '')
        if (settings.sleepSchedule) setSleepSched(settings.sleepSchedule)
        if (settings.screensaver) {
          setSs(settings.screensaver)
          setSsFolderInput(settings.screensaver.googleDriveFolderId ?? '')
        }
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

  async function handleSetDefaultWriteCalendar(accountId: string, calendarId: string) {
    const res = await fetch(`/api/accounts/${accountId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultWriteCalendarId: calendarId }),
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

  async function handleCreateUser() {
    setUserFormError('')
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newUserName,
        email: newUserEmail,
        password: newUserPassword,
        role: newUserRole,
        memberId: newUserMemberId || null,
      }),
    })
    if (res.ok) {
      setUserFormOpen(false)
      setNewUserName('')
      setNewUserEmail('')
      setNewUserPassword('')
      setNewUserRole('member')
      setNewUserMemberId('')
      await fetchData()
    } else {
      const data = await res.json()
      setUserFormError(data.error ?? 'Failed to create user')
    }
  }

  async function handleDeleteUser(id: string) {
    if (!confirm('Delete this user account? They will no longer be able to log in.')) return
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
    if (res.ok) await fetchData()
  }

  // ── Screensaver handlers ──

  async function handleVerifyFolder() {
    const id = ssFolderInput.trim()
    if (!id) return
    setSsFolderStatus(null)
    setSsPhotoLoading(true)
    try {
      const res = await fetch('/api/screensaver/folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSsFolderStatus({ type: 'err', msg: data.error ?? 'Verification failed' })
      } else {
        setSsFolderStatus({ type: 'ok', msg: `✓ "${data.folderName}" — ${data.photoCount} photo${data.photoCount !== 1 ? 's' : ''}` })
        setSs(prev => ({ ...prev, googleDriveFolderId: id, googleDriveFolderName: data.folderName }))
        // Load photos for single-photo picker
        const photosRes = await fetch('/api/screensaver/photos')
        if (photosRes.ok) {
          const photosData = await photosRes.json()
          setSsPhotos(photosData.photos ?? [])
        }
      }
    } finally {
      setSsPhotoLoading(false)
    }
  }

  // Load photos when the section is first visited and a folder is already configured
  useEffect(() => {
    if (ss.googleDriveFolderId && ssPhotos.length === 0) {
      fetch('/api/screensaver/photos')
        .then(r => r.json())
        .then(d => setSsPhotos(d.photos ?? []))
        .catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ss.googleDriveFolderId])

  async function handleSaveScreensaver(patch: Partial<ScreensaverSettings>) {
    const updated = { ...ss, ...patch }
    setSs(updated)
    setSsSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screensaver: updated }),
      })
    } finally {
      setSsSaving(false)
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
            onSetDefaultWriteCalendar={handleSetDefaultWriteCalendar}
          />
        </section>

        {/* Sleep Schedule Section */}
        <section
          className="rounded-2xl p-6"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text)' }}>
            Sleep Schedule
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-dim)' }}>
            Hardware sleep suspends the display completely during overnight hours. Configure in the Sleep tab.
          </p>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌙</span>
            <div className="text-sm" style={{ color: 'var(--text-dim)' }}>
              Sleep from <strong style={{ color: 'var(--text)' }}>{sleepSched?.from ?? '00:00'}</strong> to <strong style={{ color: 'var(--text)' }}>{sleepSched?.to ?? '06:00'}</strong>
              {sleepSched?.enabled
                ? <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>Enabled</span>
                : <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--surface2)', color: 'var(--text-faint)' }}>Disabled</span>
              }
            </div>
          </div>

          {/* Sleep Now — only shown on local deployment */}
          {process.env.NEXT_PUBLIC_LOCAL_MODE === 'true' && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>Sleep Now</div>
                  <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
                    Immediately suspend this display. Touch screen to wake.
                  </div>
                </div>
                <button
                  onClick={async () => {
                    const res = await fetch('/api/sleep', { method: 'POST' })
                    if (!res.ok) setError('Sleep command failed — check that ENABLE_SYSTEM_SLEEP=true is set.')
                  }}
                  className="settings-btn-primary shrink-0"
                >
                  Sleep Now
                </button>
              </div>
            </div>
          )}
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

        {/* Users & Access Section — admin only */}
        {session?.role === 'admin' && (
          <section
            className="rounded-2xl p-6"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                Users &amp; Access
              </h2>
              <button
                onClick={() => { setUserFormOpen(v => !v); setUserFormError('') }}
                className="settings-btn-primary text-sm"
              >
                {userFormOpen ? 'Cancel' : '+ Add User'}
              </button>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--text-dim)' }}>
              Manage who can log in to FamilyHub and their permission level.
            </p>

            {/* Add user form */}
            {userFormOpen && (
              <div
                className="rounded-xl p-4 mb-4 flex flex-col gap-3"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
              >
                <div className="flex gap-3">
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="field-label">Name</label>
                    <input type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Full name" />
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="field-label">Email</label>
                    <input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="login@email.com" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="field-label">Password</label>
                    <input type="password" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} placeholder="Min 8 characters" />
                  </div>
                  <div className="flex flex-col gap-1.5" style={{ minWidth: 100 }}>
                    <label className="field-label">Role</label>
                    <select value={newUserRole} onChange={e => setNewUserRole(e.target.value as AppUser['role'])}>
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                      <option value="guest">Guest</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="field-label">Linked Family Member (optional)</label>
                  <select value={newUserMemberId} onChange={e => setNewUserMemberId(e.target.value)}>
                    <option value="">— None —</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                {userFormError && (
                  <div className="text-sm" style={{ color: '#ff6b6b' }}>{userFormError}</div>
                )}
                <div className="flex justify-end">
                  <button
                    onClick={handleCreateUser}
                    disabled={!newUserName || !newUserEmail || !newUserPassword}
                    className="settings-btn-primary"
                  >
                    Create User
                  </button>
                </div>
              </div>
            )}

            {/* User list */}
            <div className="flex flex-col gap-2">
              {users.length === 0 && (
                <div className="text-sm" style={{ color: 'var(--text-faint)' }}>No users yet.</div>
              )}
              {users.map(u => {
                const linkedMember = members.find(m => m.id === u.memberId)
                const isSelf = session?.userId === u.id
                return (
                  <div
                    key={u.id}
                    className="flex items-center justify-between px-4 py-3 rounded-xl"
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                        {u.name}
                        {isSelf && <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--accent)', color: '#fff' }}>you</span>}
                      </div>
                      <div className="text-xs truncate" style={{ color: 'var(--text-dim)' }}>{u.email}</div>
                      {linkedMember && (
                        <div className="text-xs" style={{ color: 'var(--text-faint)' }}>
                          Linked: {linkedMember.name}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span
                        className="text-xs px-2 py-1 rounded-full font-medium"
                        style={{
                          background: u.role === 'admin' ? 'rgba(108,140,255,0.15)' : 'var(--surface)',
                          color: u.role === 'admin' ? 'var(--accent)' : 'var(--text-dim)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        {u.role}
                      </span>
                      {!isSelf && (
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="text-xs px-2 py-1 rounded cursor-pointer"
                          style={{ background: 'rgba(255,107,107,0.1)', color: '#ff6b6b', border: 'none' }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Screensaver Section */}
        <section
          className="rounded-2xl p-6 flex flex-col gap-5"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div>
            <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text)' }}>Screensaver</h2>
            <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
              Show a photo slideshow or a single pinned photo after the display is idle.
            </p>
          </div>

          {/* Enable toggle */}
          <label className="flex items-center gap-3 cursor-pointer text-sm" style={{ color: 'var(--text)' }}>
            <input
              type="checkbox"
              checked={ss.enabled}
              onChange={e => handleSaveScreensaver({ enabled: e.target.checked })}
              style={{ accentColor: 'var(--accent)', width: 16, height: 16 }}
            />
            Enable screensaver
          </label>

          {ss.enabled && (
            <>
              {/* Google Drive folder */}
              <div className="flex flex-col gap-2">
                <label className="field-label">Google Drive Folder ID</label>
                <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                  Create a folder in Google Drive, set sharing to &quot;Anyone with the link → Viewer&quot;, then paste the folder ID from the URL
                  (the long string after <code>/folders/</code>).
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs"
                    value={ssFolderInput}
                    onChange={e => { setSsFolderInput(e.target.value); setSsFolderStatus(null) }}
                    className="flex-1"
                  />
                  <button
                    onClick={handleVerifyFolder}
                    disabled={!ssFolderInput.trim() || ssPhotoLoading}
                    className="settings-btn-primary shrink-0"
                  >
                    {ssPhotoLoading ? 'Checking…' : 'Verify'}
                  </button>
                </div>
                {ssFolderStatus && (
                  <div
                    className="text-sm"
                    style={{ color: ssFolderStatus.type === 'ok' ? '#22c55e' : '#ff6b6b' }}
                  >
                    {ssFolderStatus.msg}
                  </div>
                )}
                {ss.googleDriveFolderName && !ssFolderStatus && (
                  <div className="text-xs" style={{ color: 'var(--text-faint)' }}>
                    Current folder: <strong style={{ color: 'var(--text-dim)' }}>{ss.googleDriveFolderName}</strong>
                  </div>
                )}
              </div>

              {/* Mode toggle */}
              <div className="flex flex-col gap-2">
                <label className="field-label">Display mode</label>
                <div className="flex gap-2">
                  {(['slideshow', 'single'] as ScreensaverMode[]).map(m => (
                    <button
                      key={m}
                      onClick={() => handleSaveScreensaver({ mode: m })}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                      style={{
                        background: ss.mode === m ? 'var(--accent)' : 'var(--surface2)',
                        color: ss.mode === m ? '#fff' : 'var(--text-dim)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {m === 'slideshow' ? '▶ Slideshow' : '📌 Single photo'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Single photo picker */}
              {ss.mode === 'single' && ss.googleDriveFolderId && (
                <div className="flex flex-col gap-2">
                  <label className="field-label">
                    Choose photo
                    {ss.singlePhotoId && (
                      <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-faint)' }}>
                        (1 selected)
                      </span>
                    )}
                  </label>
                  {ssPhotos.length === 0 ? (
                    <div className="text-sm" style={{ color: 'var(--text-faint)' }}>
                      No photos found in folder. Make sure the folder has images and is publicly shared.
                    </div>
                  ) : (
                    <div
                      className="grid gap-2 overflow-y-auto"
                      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', maxHeight: 280 }}
                    >
                      {ssPhotos.map(photo => (
                        <button
                          key={photo.id}
                          onClick={() => handleSaveScreensaver({ singlePhotoId: photo.id })}
                          title={photo.name}
                          className="relative rounded-lg overflow-hidden transition-all"
                          style={{
                            aspectRatio: '1',
                            border: ss.singlePhotoId === photo.id
                              ? '3px solid var(--accent)'
                              : '2px solid var(--border)',
                            padding: 0,
                            background: 'var(--surface2)',
                          }}
                        >
                          {photo.thumbnailLink ? (
                            <img
                              src={photo.thumbnailLink}
                              alt={photo.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xl">🖼</div>
                          )}
                          {ss.singlePhotoId === photo.id && (
                            <div
                              className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                              style={{ background: 'var(--accent)', color: '#fff' }}
                            >
                              ✓
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Slideshow options */}
              {ss.mode === 'slideshow' && (
                <div className="flex flex-col gap-3">
                  <div className="flex gap-4">
                    <div className="flex flex-col gap-1.5 flex-1">
                      <label className="field-label">Order</label>
                      <select
                        value={ss.order}
                        onChange={e => handleSaveScreensaver({ order: e.target.value as 'chronological' | 'shuffle' })}
                      >
                        <option value="shuffle">Shuffle</option>
                        <option value="chronological">Chronological</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-1">
                      <label className="field-label">Seconds per slide</label>
                      <input
                        type="number"
                        min={5}
                        max={120}
                        value={ss.secondsPerSlide}
                        onChange={e => handleSaveScreensaver({ secondsPerSlide: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Common display options */}
              <div className="flex flex-col gap-3">
                <div className="flex gap-4">
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="field-label">Idle time (minutes)</label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={ss.idleMinutes}
                      onChange={e => handleSaveScreensaver({ idleMinutes: Number(e.target.value) })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="field-label">Photo fit</label>
                    <select
                      value={ss.fill}
                      onChange={e => handleSaveScreensaver({ fill: e.target.value as 'fit' | 'fill' })}
                    >
                      <option value="fill">Fill (crop to fit)</option>
                      <option value="fit">Fit (show full photo)</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-3 cursor-pointer text-sm" style={{ color: 'var(--text)' }}>
                    <input
                      type="checkbox"
                      checked={ss.showDateTime}
                      onChange={e => handleSaveScreensaver({ showDateTime: e.target.checked })}
                      style={{ accentColor: 'var(--accent)', width: 16, height: 16 }}
                    />
                    Show clock &amp; date overlay
                  </label>
                  {ss.fill === 'fit' && (
                    <label className="flex items-center gap-3 cursor-pointer text-sm" style={{ color: 'var(--text)' }}>
                      <input
                        type="checkbox"
                        checked={ss.blurBackground}
                        onChange={e => handleSaveScreensaver({ blurBackground: e.target.checked })}
                        style={{ accentColor: 'var(--accent)', width: 16, height: 16 }}
                      />
                      Blur background behind photo (fit mode)
                    </label>
                  )}
                </div>
              </div>

              {ssSaving && (
                <div className="text-xs" style={{ color: 'var(--text-faint)' }}>Saving…</div>
              )}
            </>
          )}
        </section>

        {/* Kiosk Section — only shown on local deployment */}
        {process.env.NEXT_PUBLIC_LOCAL_MODE === 'true' && (
          <section
            className="rounded-2xl p-6"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text)' }}>
              Kiosk
            </h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-dim)' }}>
              Controls for the wall display kiosk hardware.
            </p>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>Minimize to Desktop</div>
                  <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
                    Minimize Chromium to access the Lubuntu desktop (terminal, file manager, etc.).
                  </div>
                </div>
                <button
                  onClick={async () => {
                    const res = await fetch('/api/system/minimize', { method: 'POST' })
                    if (!res.ok) setError('Minimize failed — check that xdotool is installed (sudo apt install xdotool).')
                  }}
                  className="settings-btn-secondary shrink-0"
                >
                  Minimize
                </button>
              </div>
            </div>
          </section>
        )}

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
