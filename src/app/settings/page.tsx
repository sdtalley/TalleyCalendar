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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addAccountMemberId, setAddAccountMemberId] = useState<string | null>(null)
  const router = useRouter()

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg)' }}>
        <div className="text-lg" style={{ color: 'var(--text-dim)' }}>Loading settings...</div>
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
