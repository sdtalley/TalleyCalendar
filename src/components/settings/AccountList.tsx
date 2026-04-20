'use client'

import type { FamilyMember, ConnectedAccount, CalendarType } from '@/lib/calendar/types'

// The API strips auth and returns authType instead
type AccountSafe = Omit<ConnectedAccount, 'auth'> & { authType: string }

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google Calendar',
  outlook: 'Microsoft Outlook',
  apple: 'Apple iCloud',
}

const STATUS_STYLES: Record<string, { color: string; label: string }> = {
  connected: { color: '#34d399', label: 'Connected' },
  error: { color: '#ff6b6b', label: 'Error' },
  reauth_needed: { color: '#fbbf24', label: 'Needs Reconnection' },
}

interface AccountListProps {
  members: FamilyMember[]
  accounts: AccountSafe[]
  onAddAccount: (memberId: string) => void
  onRemoveAccount: (accountId: string) => Promise<void>
  onToggleCalendar: (accountId: string, calendarId: string, enabled: boolean) => Promise<void>
}

export function AccountList({
  members,
  accounts,
  onAddAccount,
  onRemoveAccount,
  onToggleCalendar,
}: AccountListProps) {
  function accountsFor(memberId: string) {
    return accounts.filter(a => a.familyMemberId === memberId)
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text)' }}>
        Calendar Accounts
      </h2>

      {members.length === 0 && (
        <p className="text-sm py-4 text-center" style={{ color: 'var(--text-faint)' }}>
          Add family members above first, then connect their calendar accounts.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {members.map(member => {
          const memberAccounts = accountsFor(member.id)
          return (
            <div key={member.id}>
              {/* Member header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ background: member.color }}
                  />
                  <span className="text-[15px] font-medium" style={{ color: 'var(--text)' }}>
                    {member.name}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
                    {memberAccounts.length} account{memberAccounts.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <button
                  onClick={() => onAddAccount(member.id)}
                  className="settings-btn-ghost"
                  style={{ color: 'var(--accent)' }}
                >
                  + Add
                </button>
              </div>

              {/* Account cards */}
              {memberAccounts.length === 0 ? (
                <div
                  className="px-4 py-3 rounded-xl text-sm text-center"
                  style={{ background: 'var(--surface2)', color: 'var(--text-faint)' }}
                >
                  No accounts connected
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {memberAccounts.map(account => (
                    <AccountCard
                      key={account.id}
                      account={account}
                      onRemove={() => onRemoveAccount(account.id)}
                      onToggleCalendar={(calId, enabled) =>
                        onToggleCalendar(account.id, calId, enabled)
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AccountCard({
  account,
  onRemove,
  onToggleCalendar,
}: {
  account: AccountSafe
  onRemove: () => void
  onToggleCalendar: (calendarId: string, enabled: boolean) => void
}) {
  const status = STATUS_STYLES[account.status] ?? STATUS_STYLES.error

  return (
    <div
      className="px-4 py-3 rounded-xl"
      style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
    >
      {/* Account header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ProviderIcon provider={account.provider} />
          <div>
            <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              {account.label}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-faint)' }}>
              {account.email} · {PROVIDER_LABELS[account.provider] ?? account.provider}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: status.color }}>
            <span className="w-2 h-2 rounded-full" style={{ background: status.color }} />
            {status.label}
          </span>
          {account.status === 'reauth_needed' && account.provider !== 'apple' && (
            <a
              href={`/api/auth/${account.provider}/connect?memberId=${account.familyMemberId}&calendarType=${account.calendarType}&reconnectAccountId=${account.id}`}
              className="settings-btn-ghost text-xs font-semibold"
              style={{ color: '#fbbf24', border: '1px solid #fbbf2460', borderRadius: 6, padding: '2px 8px', textDecoration: 'none' }}
            >
              Reconnect
            </a>
          )}
          <button
            onClick={onRemove}
            className="settings-btn-ghost text-xs"
            style={{ color: '#ff6b6b' }}
          >
            Disconnect
          </button>
        </div>
      </div>

      {/* Calendar toggles */}
      {account.enabledCalendars.length > 0 && (
        <div className="flex flex-col gap-1 pt-1" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="text-[10px] font-semibold uppercase tracking-wider pt-1 pb-0.5" style={{ color: 'var(--text-faint)' }}>
            Calendars
          </div>
          {account.enabledCalendars.map(cal => (
            <label
              key={cal.calendarId}
              className="flex items-center gap-2 px-1 py-1 rounded cursor-pointer text-sm"
              style={{ color: 'var(--text-dim)' }}
            >
              <input
                type="checkbox"
                checked={cal.enabled}
                onChange={e => onToggleCalendar(cal.calendarId, e.target.checked)}
                className="accent-[var(--accent)]"
              />
              {cal.name}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function ProviderIcon({ provider }: { provider: string }) {
  const icons: Record<string, string> = {
    google: 'G',
    outlook: 'M',
    apple: '',
  }
  const colors: Record<string, string> = {
    google: '#4285f4',
    outlook: '#0078d4',
    apple: '#a2aaad',
  }
  return (
    <span
      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
      style={{ background: colors[provider] ?? 'var(--surface3)', color: '#fff' }}
    >
      {icons[provider] ?? '?'}
    </span>
  )
}
