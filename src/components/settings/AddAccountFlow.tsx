'use client'

import { useState } from 'react'
import type { FamilyMember, CalendarProvider, CalendarType } from '@/lib/calendar/types'

interface AddAccountFlowProps {
  members: FamilyMember[]
  preselectedMemberId?: string
  onClose: () => void
  onAppleSaved: () => void
}

type Step = 'pick-provider' | 'apple-form'

const PROVIDERS: { id: CalendarProvider; name: string; description: string; color: string }[] = [
  { id: 'google', name: 'Google Calendar', description: 'Gmail, Google Workspace', color: '#4285f4' },
  { id: 'outlook', name: 'Microsoft Outlook', description: 'Personal, work, or school accounts', color: '#0078d4' },
  { id: 'apple', name: 'Apple iCloud', description: 'Requires app-specific password', color: '#a2aaad' },
]

const CAL_TYPES: { id: CalendarType; label: string }[] = [
  { id: 'personal', label: 'Personal' },
  { id: 'work', label: 'Work' },
  { id: 'kids', label: 'Kids' },
  { id: 'shared', label: 'Shared' },
]

export function AddAccountFlow({ members, preselectedMemberId, onClose, onAppleSaved }: AddAccountFlowProps) {
  const [step, setStep] = useState<Step>('pick-provider')
  const [memberId, setMemberId] = useState(preselectedMemberId ?? members[0]?.id ?? '')
  const [calendarType, setCalendarType] = useState<CalendarType>('personal')

  // Apple form state
  const [appleEmail, setAppleEmail] = useState('')
  const [applePassword, setApplePassword] = useState('')
  const [appleLabel, setAppleLabel] = useState('')
  const [appleError, setAppleError] = useState('')
  const [appleSaving, setAppleSaving] = useState(false)

  function handleProviderSelect(provider: CalendarProvider) {
    if (provider === 'apple') {
      setStep('apple-form')
      return
    }

    // For Google/Outlook: redirect to OAuth connect endpoint
    const params = new URLSearchParams({
      memberId,
      calendarType,
    })
    window.location.href = `/api/auth/${provider}/connect?${params}`
  }

  async function handleAppleSave() {
    if (!appleEmail.trim() || !applePassword.trim()) {
      setAppleError('Email and app-specific password are required.')
      return
    }

    setAppleSaving(true)
    setAppleError('')

    try {
      // Server-side: test CalDAV connection, discover calendars, and save account
      const res = await fetch('/api/auth/apple/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: appleEmail,
          appPassword: applePassword,
          memberId,
          calendarType,
          label: appleLabel,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setAppleError(data.error ?? 'Failed to connect. Check your credentials.')
        return
      }

      onAppleSaved()
      onClose()
    } catch {
      setAppleError('Connection failed. Check your credentials and try again.')
    } finally {
      setAppleSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-[520px] max-w-[95vw] rounded-2xl"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="text-[18px] font-bold">
            {step === 'pick-provider' ? 'Add Calendar Account' : 'Connect Apple iCloud'}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-lg cursor-pointer border-none transition-all duration-150"
            style={{ background: 'var(--surface2)', color: 'var(--text-dim)' }}
          >
            ×
          </button>
        </div>

        <div className="px-6 py-6 flex flex-col gap-4">
          {/* Member + Type selectors (shared between steps) */}
          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="field-label">Family Member</label>
              <select value={memberId} onChange={e => setMemberId(e.target.value)}>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="field-label">Calendar Type</label>
              <select
                value={calendarType}
                onChange={e => setCalendarType(e.target.value as CalendarType)}
              >
                {CAL_TYPES.map(ct => (
                  <option key={ct.id} value={ct.id}>{ct.label}</option>
                ))}
              </select>
            </div>
          </div>

          {step === 'pick-provider' && (
            <>
              <div className="field-label">Choose Provider</div>
              <div className="flex flex-col gap-2">
                {PROVIDERS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleProviderSelect(p.id)}
                    disabled={!memberId}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-left w-full cursor-pointer transition-all duration-150"
                    style={{
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = p.color
                      e.currentTarget.style.background = 'var(--surface3)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border)'
                      e.currentTarget.style.background = 'var(--surface2)'
                    }}
                  >
                    <span
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-base font-bold flex-shrink-0"
                      style={{ background: p.color, color: '#fff' }}
                    >
                      {p.id === 'google' ? 'G' : p.id === 'outlook' ? 'M' : ''}
                    </span>
                    <div>
                      <div className="text-[15px] font-medium" style={{ color: 'var(--text)' }}>
                        {p.name}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-faint)' }}>
                        {p.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 'apple-form' && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="field-label">Label (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Mom's iCloud"
                  value={appleLabel}
                  onChange={e => setAppleLabel(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="field-label">iCloud Email</label>
                <input
                  type="text"
                  placeholder="you@icloud.com"
                  value={appleEmail}
                  onChange={e => setAppleEmail(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="field-label">App-Specific Password</label>
                <input
                  type="password"
                  placeholder="xxxx-xxxx-xxxx-xxxx"
                  value={applePassword}
                  onChange={e => setApplePassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAppleSave()}
                />
                <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                  Generate at{' '}
                  <span style={{ color: 'var(--accent)' }}>appleid.apple.com</span>
                  {' '}→ Sign-In & Security → App-Specific Passwords
                </p>
              </div>

              {appleError && (
                <div
                  className="px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'rgba(255,107,107,0.1)', color: '#ff6b6b', border: '1px solid rgba(255,107,107,0.2)' }}
                >
                  {appleError}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex justify-between items-center px-6 py-4"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <div>
            {step === 'apple-form' && (
              <button
                onClick={() => setStep('pick-provider')}
                className="settings-btn-ghost"
              >
                ← Back
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="settings-btn-secondary">Cancel</button>
            {step === 'apple-form' && (
              <button
                onClick={handleAppleSave}
                className="settings-btn-primary"
                disabled={appleSaving || !appleEmail || !applePassword}
              >
                {appleSaving ? 'Connecting...' : 'Test & Connect'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
