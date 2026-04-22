import { Redis } from '@upstash/redis'
import type {
  FamilyMember,
  ConnectedAccount,
  AppSettings,
  CalendarView,
  LocalEvent,
  AppUser,
  Chore,
  ChoreCompletion,
  Routine,
  RoutineCompletion,
} from './calendar/types'

// ── Redis client ───────────────────────────────────────────────────────────

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// ── Key conventions ────────────────────────────────────────────────────────
//
// All Phase 3 collection types follow this pattern:
//   {entity}:{id}   → individual object          e.g. member:abc123
//   {entities}:ids  → string[] of all IDs        e.g. members:ids
//
// Use createEntityHelpers<T>() below to get typed CRUD for any entity.
// Accounts already use this pattern (account:{id}, accounts:byMember:{mid}).
// Family members were migrated to it in the pre-Phase-3 commit.

const KEYS = {
  // User accounts (Phase 3A)
  user:        (id: string)    => `user:${id}`,
  userIds:     'users:list',
  userByEmail: (email: string) => `user:byEmail:${email}`,

  // Family members (individual-key pattern)
  member:    (id: string) => `member:${id}`,
  memberIds: 'members:ids',
  // Legacy flat-array key — read once during migration, then deleted
  legacyFamilyMembers: 'family:members',

  // Connected accounts
  account:          (id: string)       => `account:${id}`,
  accountsByMember: (memberId: string) => `accounts:byMember:${memberId}`,

  // Singletons
  settings:   'settings',

  // Per-date / per-member keys
  note:        (date: string)     => `note:${date}`,
  localEvents: (memberId: string) => `local-events:${memberId}`,

  // Chores (Phase 3B)
  choreIds:        'chores:ids',
  choreCompletion: (date: string, choreId: string) => `chore-completion:${date}:${choreId}`,

  // Routines (Phase 3B)
  routineIds:        'routines:ids',
  routineCompletion: (date: string, routineId: string) => `routine-completion:${date}:${routineId}`,

  // Star balances (Phase 3B)
  starBalance: (memberId: string) => `star-balance:${memberId}`,
} as const

// ── Entity helper factory ──────────────────────────────────────────────────
//
// Creates a standard CRUD interface for any entity that follows the
// {entity}:{id} + {entities}:ids pattern. All Phase 3 features use this.
//
// Usage:
//   const choreHelpers = createEntityHelpers<Chore>('chore', 'chores:ids')
//   await choreHelpers.create(newChore)
//   await choreHelpers.getAll()

export function createEntityHelpers<T extends { id: string }>(
  entityKeyPrefix: string,
  idsKey: string
) {
  const entityKey = (id: string) => `${entityKeyPrefix}:${id}`

  return {
    async getIds(): Promise<string[]> {
      return (await redis.get<string[]>(idsKey)) ?? []
    },

    async getAll(): Promise<T[]> {
      const ids = await this.getIds()
      if (ids.length === 0) return []
      const items = await Promise.all(ids.map((id) => redis.get<T>(entityKey(id))))
      return items.filter((item) => item !== null) as T[]
    },

    async getById(id: string): Promise<T | null> {
      return redis.get<T>(entityKey(id))
    },

    async create(item: T): Promise<void> {
      await redis.set(entityKey(item.id), item)
      const ids = await this.getIds()
      if (!ids.includes(item.id)) {
        await redis.set(idsKey, [...ids, item.id])
      }
    },

    async update(id: string, updates: Partial<Omit<T, 'id'>>): Promise<T | null> {
      const item = await this.getById(id)
      if (!item) return null
      const updated = { ...item, ...updates }
      await redis.set(entityKey(id), updated)
      return updated
    },

    async remove(id: string): Promise<boolean> {
      const item = await this.getById(id)
      if (!item) return false
      await redis.del(entityKey(id))
      const ids = await this.getIds()
      await redis.set(idsKey, ids.filter((i) => i !== id))
      return true
    },
  }
}

// ── Family Members ─────────────────────────────────────────────────────────

const memberHelpers = createEntityHelpers<FamilyMember>('member', KEYS.memberIds)

// One-time migration: if the old flat-array key exists and the new ID list
// does not, read the old data, write individual keys, then delete the old key.
async function migrateFamilyMembersIfNeeded(): Promise<void> {
  const ids = await redis.get<string[]>(KEYS.memberIds)
  if (ids !== null) return // already migrated

  const legacy = await redis.get<FamilyMember[]>(KEYS.legacyFamilyMembers)
  if (!legacy || legacy.length === 0) {
    // No old data — just initialise an empty list
    await redis.set(KEYS.memberIds, [])
    return
  }

  // Write each member to its individual key
  await Promise.all(legacy.map((m) => redis.set(KEYS.member(m.id), m)))
  await redis.set(KEYS.memberIds, legacy.map((m) => m.id))
  await redis.del(KEYS.legacyFamilyMembers)
}

export async function getFamilyMembers(): Promise<FamilyMember[]> {
  await migrateFamilyMembersIfNeeded()
  return memberHelpers.getAll()
}

export async function addFamilyMember(member: FamilyMember): Promise<void> {
  await migrateFamilyMembersIfNeeded()
  await memberHelpers.create(member)
}

export async function updateFamilyMember(
  id: string,
  updates: Partial<Omit<FamilyMember, 'id'>>
): Promise<FamilyMember | null> {
  return memberHelpers.update(id, updates)
}

export async function removeFamilyMember(id: string): Promise<boolean> {
  const removed = await memberHelpers.remove(id)
  if (!removed) return false

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
  await redis.set(KEYS.account(account.id), account)

  const ids = await getAccountIdsForMember(account.familyMemberId)
  if (!ids.includes(account.id)) {
    await redis.set(KEYS.accountsByMember(account.familyMemberId), [...ids, account.id])
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

  const ids = await getAccountIdsForMember(account.familyMemberId)
  await redis.set(KEYS.accountsByMember(account.familyMemberId), ids.filter((accId) => accId !== id))
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
  await redis.set(KEYS.localEvents(event.memberId), [...events, event])
}

export async function updateLocalEvent(
  memberId: string,
  id: string,
  updates: Partial<Omit<LocalEvent, 'id' | 'memberId'>>
): Promise<LocalEvent | null> {
  const events = await getLocalEvents(memberId)
  const idx = events.findIndex((e) => e.id === id)
  if (idx === -1) return null
  events[idx] = { ...events[idx], ...updates }
  await redis.set(KEYS.localEvents(memberId), events)
  return events[idx]
}

export async function deleteLocalEvent(memberId: string, id: string): Promise<boolean> {
  const events = await getLocalEvents(memberId)
  const filtered = events.filter((e) => e.id !== id)
  if (filtered.length === events.length) return false
  await redis.set(KEYS.localEvents(memberId), filtered)
  return true
}

export async function getAllLocalEvents(): Promise<LocalEvent[]> {
  const members = await getFamilyMembers()
  const localMembers = members.filter((m) => m.localOnly)
  if (localMembers.length === 0) return []
  const results = await Promise.all(localMembers.map((m) => getLocalEvents(m.id)))
  return results.flat()
}

// ── User Accounts (Phase 3A) ──────────────────────────────────────────────

const userHelpers = createEntityHelpers<AppUser>('user', KEYS.userIds)

export async function getUser(id: string): Promise<AppUser | null> {
  return userHelpers.getById(id)
}

export async function getUserByEmail(email: string): Promise<AppUser | null> {
  const userId = await redis.get<string>(KEYS.userByEmail(email))
  if (!userId) return null
  return getUser(userId)
}

export async function getAllUsers(): Promise<AppUser[]> {
  return userHelpers.getAll()
}

export async function createUser(user: AppUser): Promise<void> {
  await userHelpers.create(user)
  await redis.set(KEYS.userByEmail(user.email), user.id)
}

export async function updateUser(
  id: string,
  updates: Partial<Omit<AppUser, 'id'>>
): Promise<AppUser | null> {
  const old = await getUser(id)
  if (!old) return null
  const updated = await userHelpers.update(id, updates)
  if (updates.email && updates.email !== old.email) {
    await redis.del(KEYS.userByEmail(old.email))
    await redis.set(KEYS.userByEmail(updates.email), id)
  }
  return updated
}

export async function deleteUser(id: string): Promise<boolean> {
  const user = await getUser(id)
  if (!user) return false
  const removed = await userHelpers.remove(id)
  if (!removed) return false
  await redis.del(KEYS.userByEmail(user.email))
  return true
}

// ── Chores (Phase 3B) ─────────────────────────────────────────────────────

const choreHelpers = createEntityHelpers<Chore>('chore', KEYS.choreIds)

export const getChores    = ()                                        => choreHelpers.getAll()
export const getChore     = (id: string)                              => choreHelpers.getById(id)
export const createChore  = (chore: Chore)                            => choreHelpers.create(chore)
export const updateChore  = (id: string, u: Partial<Omit<Chore,'id'>>) => choreHelpers.update(id, u)
export const deleteChore  = (id: string)                              => choreHelpers.remove(id)

export async function getChoreCompletion(date: string, choreId: string): Promise<ChoreCompletion | null> {
  return redis.get<ChoreCompletion>(KEYS.choreCompletion(date, choreId))
}

export async function setChoreCompletion(date: string, choreId: string, completion: ChoreCompletion): Promise<void> {
  await redis.set(KEYS.choreCompletion(date, choreId), completion)
}

export async function removeChoreCompletion(date: string, choreId: string): Promise<boolean> {
  const existing = await getChoreCompletion(date, choreId)
  if (!existing) return false
  await redis.del(KEYS.choreCompletion(date, choreId))
  return true
}

export async function getChoreCompletions(date: string, choreIds: string[]): Promise<Record<string, ChoreCompletion | null>> {
  if (choreIds.length === 0) return {}
  const results = await Promise.all(choreIds.map(id => getChoreCompletion(date, id)))
  return Object.fromEntries(choreIds.map((id, i) => [id, results[i]]))
}

// ── Routines (Phase 3B) ───────────────────────────────────────────────────

const routineHelpers = createEntityHelpers<Routine>('routine', KEYS.routineIds)

export const getRoutines    = ()                                             => routineHelpers.getAll()
export const getRoutine     = (id: string)                                   => routineHelpers.getById(id)
export const createRoutine  = (r: Routine)                                   => routineHelpers.create(r)
export const updateRoutine  = (id: string, u: Partial<Omit<Routine,'id'>>) => routineHelpers.update(id, u)
export const deleteRoutine  = (id: string)                                   => routineHelpers.remove(id)

export async function getRoutineCompletion(date: string, routineId: string): Promise<RoutineCompletion | null> {
  return redis.get<RoutineCompletion>(KEYS.routineCompletion(date, routineId))
}

export async function setRoutineCompletion(date: string, routineId: string, completion: RoutineCompletion): Promise<void> {
  await redis.set(KEYS.routineCompletion(date, routineId), completion)
}

export async function removeRoutineCompletion(date: string, routineId: string): Promise<boolean> {
  const existing = await getRoutineCompletion(date, routineId)
  if (!existing) return false
  await redis.del(KEYS.routineCompletion(date, routineId))
  return true
}

export async function getRoutineCompletions(date: string, routineIds: string[]): Promise<Record<string, RoutineCompletion | null>> {
  if (routineIds.length === 0) return {}
  const results = await Promise.all(routineIds.map(id => getRoutineCompletion(date, id)))
  return Object.fromEntries(routineIds.map((id, i) => [id, results[i]]))
}

// ── Star Balances (Phase 3B) ──────────────────────────────────────────────

export async function getStarBalance(memberId: string): Promise<number> {
  return (await redis.get<number>(KEYS.starBalance(memberId))) ?? 0
}

export async function adjustStarBalance(memberId: string, delta: number): Promise<number> {
  const current = await getStarBalance(memberId)
  const newBalance = Math.max(0, current + delta)
  await redis.set(KEYS.starBalance(memberId), newBalance)
  return newBalance
}
