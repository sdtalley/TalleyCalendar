import { Redis } from '@upstash/redis'
import type {
  FamilyMember,
  ConnectedAccount,
  AppSettings,
  CalendarView,
  LocalEvent,
} from './calendar/types'

// ── Redis client ───────────────────────────────────────────────────────────

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// ── Keys ───────────────────────────────────────────────────────────────────

const KEYS = {
  familyMembers: 'family:members',
  account: (id: string) => `account:${id}`,
  accountsByMember: (memberId: string) => `accounts:byMember:${memberId}`,
  settings: 'settings',
  note: (date: string) => `note:${date}`,
  localEvents: (memberId: string) => `local-events:${memberId}`,
} as const

// ── Family Members ─────────────────────────────────────────────────────────

export async function getFamilyMembers(): Promise<FamilyMember[]> {
  const members = await redis.get<FamilyMember[]>(KEYS.familyMembers)
  return members ?? []
}

export async function setFamilyMembers(members: FamilyMember[]): Promise<void> {
  await redis.set(KEYS.familyMembers, members)
}

export async function addFamilyMember(member: FamilyMember): Promise<void> {
  const members = await getFamilyMembers()
  members.push(member)
  await setFamilyMembers(members)
}

export async function updateFamilyMember(
  id: string,
  updates: Partial<Omit<FamilyMember, 'id'>>
): Promise<FamilyMember | null> {
  const members = await getFamilyMembers()
  const idx = members.findIndex((m) => m.id === id)
  if (idx === -1) return null
  members[idx] = { ...members[idx], ...updates }
  await setFamilyMembers(members)
  return members[idx]
}

export async function removeFamilyMember(id: string): Promise<boolean> {
  const members = await getFamilyMembers()
  const filtered = members.filter((m) => m.id !== id)
  if (filtered.length === members.length) return false
  await setFamilyMembers(filtered)

  // Also remove all accounts for this member
  const accountIds = await getAccountIdsForMember(id)
  await Promise.all(accountIds.map((accId) => removeAccount(accId)))

  return true
}

// ── Connected Accounts ─────────────────────────────────────────────────────

export async function getAccount(id: string): Promise<ConnectedAccount | null> {
  return redis.get<ConnectedAccount>(KEYS.account(id))
}

export async function getAccountIdsForMember(memberId: string): Promise<string[]> {
  const ids = await redis.get<string[]>(KEYS.accountsByMember(memberId))
  return ids ?? []
}

export async function getAccountsForMember(memberId: string): Promise<ConnectedAccount[]> {
  const ids = await getAccountIdsForMember(memberId)
  if (ids.length === 0) return []
  const accounts = await Promise.all(ids.map((id) => getAccount(id)))
  return accounts.filter((a): a is ConnectedAccount => a !== null)
}

export async function getAllAccounts(): Promise<ConnectedAccount[]> {
  const members = await getFamilyMembers()
  const allAccounts = await Promise.all(
    members.map((m) => getAccountsForMember(m.id))
  )
  return allAccounts.flat()
}

export async function saveAccount(account: ConnectedAccount): Promise<void> {
  // Save the account object
  await redis.set(KEYS.account(account.id), account)

  // Add to the member's account list if not already there
  const ids = await getAccountIdsForMember(account.familyMemberId)
  if (!ids.includes(account.id)) {
    ids.push(account.id)
    await redis.set(KEYS.accountsByMember(account.familyMemberId), ids)
  }
}

export async function updateAccount(
  id: string,
  updates: Partial<Omit<ConnectedAccount, 'id'>>
): Promise<ConnectedAccount | null> {
  const account = await getAccount(id)
  if (!account) return null
  const updated = { ...account, ...updates }
  await redis.set(KEYS.account(id), updated)
  return updated
}

export async function removeAccount(id: string): Promise<boolean> {
  const account = await getAccount(id)
  if (!account) return false

  // Remove from member's account list
  const ids = await getAccountIdsForMember(account.familyMemberId)
  const filtered = ids.filter((accId) => accId !== id)
  await redis.set(KEYS.accountsByMember(account.familyMemberId), filtered)

  // Delete the account object
  await redis.del(KEYS.account(id))
  return true
}

// ── App Settings ───────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: AppSettings = {
  refreshInterval: 300000,
  defaultView: 'month' as CalendarView,
  dimSchedule: { start: '22:00', end: '06:00' },
  weather: { enabled: false, latitude: 0, longitude: 0, label: '' },
  settingsPin: '',
}

export async function getSettings(): Promise<AppSettings> {
  const settings = await redis.get<AppSettings>(KEYS.settings)
  return settings ?? DEFAULT_SETTINGS
}

export async function updateSettings(
  updates: Partial<AppSettings>
): Promise<AppSettings> {
  const current = await getSettings()
  const updated = { ...current, ...updates }
  await redis.set(KEYS.settings, updated)
  return updated
}

// ── Daily Notes ───────────────────────────────────────────────────────────

export async function getNote(date: string): Promise<string> {
  const note = await redis.get<string>(KEYS.note(date))
  return note ?? ''
}

export async function setNote(date: string, content: string): Promise<void> {
  if (content.trim()) {
    await redis.set(KEYS.note(date), content)
  } else {
    await redis.del(KEYS.note(date))
  }
}

// ── Local Events (for localOnly members — kids, family) ───────────────────

export async function getLocalEvents(memberId: string): Promise<LocalEvent[]> {
  const events = await redis.get<LocalEvent[]>(KEYS.localEvents(memberId))
  return events ?? []
}

export async function saveLocalEvent(event: LocalEvent): Promise<void> {
  const events = await getLocalEvents(event.memberId)
  events.push(event)
  await redis.set(KEYS.localEvents(event.memberId), events)
}

export async function updateLocalEvent(
  memberId: string,
  id: string,
  updates: Partial<Omit<LocalEvent, 'id' | 'memberId'>>
): Promise<LocalEvent | null> {
  const events = await getLocalEvents(memberId)
  const idx = events.findIndex(e => e.id === id)
  if (idx === -1) return null
  events[idx] = { ...events[idx], ...updates }
  await redis.set(KEYS.localEvents(memberId), events)
  return events[idx]
}

export async function deleteLocalEvent(memberId: string, id: string): Promise<boolean> {
  const events = await getLocalEvents(memberId)
  const filtered = events.filter(e => e.id !== id)
  if (filtered.length === events.length) return false
  await redis.set(KEYS.localEvents(memberId), filtered)
  return true
}

export async function getAllLocalEvents(): Promise<LocalEvent[]> {
  const members = await getFamilyMembers()
  const localMembers = members.filter(m => m.localOnly)
  if (localMembers.length === 0) return []
  const results = await Promise.all(localMembers.map(m => getLocalEvents(m.id)))
  return results.flat()
}
