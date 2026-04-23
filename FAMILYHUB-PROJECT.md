# FamilyHub Calendar — Master Project Specification

**Current state (2026-04-23):** Phase 3B Features 4–6 complete (Chores, Routines, Lists). UX polish commits done: Schedule view, DayCountPicker, InfoBar one-bar architecture. Feature 7 (Rewards) is next.  
**Detailed Phase 3 implementation specs:** see Claude Code memory → `phase3_implementation_plan.md`

---

## Overview

A self-hosted family calendar web application that aggregates Google Calendar, Apple iCloud, and Outlook into a single unified interface. Designed primarily for a 27" wall-mounted kitchen touch display, accessible from any device via browser or PWA.

**Primary competitive reference:** Skylight Calendar Max ($149 + $79/yr). TalleyCalendar targets full Skylight feature parity while retaining key advantages: Outlook two-way write-back (Skylight is read-only on Outlook), any display size, full data ownership, no ongoing subscription cost, and customizable at the code level.

---

## Problem Statement

Off-the-shelf solutions (Echo Show 15, Skylight, Cozyla) are either too expensive, too slow, or can't aggregate Google + Apple + Outlook well. This family uses all three providers — no single product handles them with a good wall-display UI.

---

## Goals

1. **Unified view** across all calendar providers
2. **Large-format, touch-first UI** for a 27" wall-mounted display
3. **Family features** matching Skylight: chores, routines, rewards/stars, meals, lists, screensaver, sleep, countdowns
4. **Per-person profiles** with color coding, avatars, filtering
5. **Zero or near-zero recurring cost** — free hosting tiers throughout
6. **Extensible** — Home Assistant integration roadmap (Phase 4)

---

## Architecture

### Hosting: Vercel (Free Tier)

```
┌─────────────────────────────────────────────────┐
│                    VERCEL                        │
│  ┌──────────────┐    ┌────────────────────────┐  │
│  │  Next.js App  │◄──►│  Serverless Functions   │  │
│  │  (App Router) │    │  /api/calendars         │  │
│  │  PWA + SW     │    │  /api/accounts          │  │
│  │  6-tab shell  │    │  /api/family            │  │
│  │               │    │  /api/settings          │  │
│  │               │    │  /api/events            │  │
│  │               │    │  /api/meals, auth, ...  │  │
│  └──────────────┘    └────────────────────────┘  │
│                              │                    │
│                     ┌────────┴────────┐           │
│                     │  Upstash Redis  │           │
│                     │  (free tier)    │           │
│                     └─────────────────┘           │
└─────────────────────────────────────────────────┘
         │                │               │
         ▼                ▼               ▼
   Google Cal API   Apple CalDAV    MS Graph API
   (OAuth 2.0)     (App-Specific    (OAuth 2.0)
                     Password)
```

**Future on-prem option:** same codebase moves to Pi + Cloudflare Tunnel when Home Assistant integration happens (Phase 4).

---

## UI Layout Architecture

### AppShell (current — post UX-2 InfoBar architecture)

```
┌──────────────────────────────────────────────────────────┐
│  InfoBar (rendered by each Tab) — ONE bar:               │
│  LEFT: date · time · weather   RIGHT: tab-specific ctrls │
├──────┬───────────────────────────────────────────────────┤
│      │  [Profile chips strip — CalendarTab only]        │
│ Nav  │                                                   │
│ Side │          Active Tab content area                  │
│ bar  │   Calendar / Tasks / Rewards / Meals /            │
│ 72px │   Lists / Sleep                                   │
│      │                                                   │
└──────┴───────────────────────────────────────────────────┘
  landscape: sidebar left │ portrait/mobile: sidebar bottom (60px)
  mobile: InfoBar shows left side only; tab-specific controls hidden (md:hidden)
```

### Tab Structure

| Tab | Content | Status |
|---|---|---|
| **Calendar** | Month / Schedule (1–7 days) / Agenda | ✅ Live |
| **Tasks** | Chores + Routines (Day/Week view redesign pending) | ✅ Live (partial) |
| **Rewards** | Stars + Reward redemption | Feature 7 next |
| **Meals** | Meal planner + Recipe Box | Phase 3C |
| **Lists** | Custom lists (To Do / Grocery / Other) | ✅ Live |
| **Sleep** | Sleep mode control + schedule | Phase 3D |
| Settings | `<Link href="/settings">` (not a tab) | ✅ Live |

### Layout rules
- **AppShell** owns: NavSidebar + tab switcher + `useScreenDim`. No TopBar — each tab renders its own InfoBar.
- **InfoBar**: shared component — left side always shows date (Mon Apr 28) + time (10:51 AM) + weather. Right side (`rightSlot` prop) contains tab-specific controls, visible on desktop only (`hidden md:flex`). TopBar is deprecated.
- **CalendarTab InfoBar right slot**: `[Schedule ▾] [Nd?] [⊞ Filter?] [<] [date range] [>] [Today] [Search] [+ Add]`. Profile chips are a separate strip below InfoBar (Skylight-accurate: chips are in tab content area, not info bar).
- **TasksTab InfoBar right slot**: `[○ Day] [□ Week]` toggle (full layout redesign pending with Feature 7).
- **NavSidebar**: CSS flex `order` trick — `order-first` landscape, `order-last` portrait. No `fixed` positioning.
- `/settings` route kept separate (OAuth callbacks redirect there); Settings item is a `<Link>`.
- Touch swipe left/right navigates dates on all calendar views.

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 14+ (App Router) | Vercel-native, SSR, API routes |
| UI | React + Tailwind CSS | Dark theme, responsive |
| Gesture | @use-gesture/react | Touch-first drag-to-reschedule |
| Validation | Zod | `parseBody<T>()` in `src/lib/validate.ts` — all API routes |
| Google | Google Calendar API v3 | OAuth 2.0, full CRUD |
| Apple | CalDAV via tsdav | App-specific password, read-only |
| Outlook | Microsoft Graph API | OAuth 2.0, full CRUD (two-way — advantage over Skylight) |
| Recurrence | rrule | RFC 5545 expansion |
| Data Store | Upstash Redis (@upstash/redis) | Individual-key pattern + `createEntityHelpers<T>()` |
| Auth | Custom HMAC-SHA256 sessions | Cookie-based, Edge middleware |
| OAuth Security | HMAC-signed state + one-time nonce | Redis-backed, 10-min TTL |
| Service Worker | Workbox 7 (CDN, no npm) | Runtime caching + Web Push stub |
| Weather | Open-Meteo API | Free, no API key |
| Deployment | Vercel free tier | Auto-deploy from GitHub |

---

## Display Hardware

**Target:** 27" capacitive touch monitor, wall-mounted, landscape. App defaults to "Roomy" density matching Skylight Cal Max behavior.

**Kiosk options:**
- Chromium kiosk mode (Linux / Pi / old laptop)
- Fully Kiosk Browser (Android / Peloton / tablet)

---

## Feature History & Roadmap

### Phase 1 — Core Calendar ✅
- [x] Month / Week / Day views
- [x] Agenda sidebar
- [x] Per-member color coding + toggle; per-type filtering
- [x] Quick-add event modal (touch-friendly)
- [x] Live clock, keyboard shortcuts, dark theme
- [x] PWA manifest + icons
- [x] Upstash Redis integration
- [x] Settings page — family members + calendar account management
- [x] Google Calendar OAuth (connect → discover → pick)
- [x] Microsoft Outlook OAuth (multitenant: personal + work/Entra)
- [x] Apple iCloud CalDAV (creds → test → discover → pick)
- [x] Aggregated event fetching; 5-min polling; SWR cache
- [x] Login auth (HMAC-SHA256 cookies, Edge middleware, OAuth CSRF)

### Phase 2 — Polish & Usability ✅
- [x] Multi-day / all-day event rendering
- [x] Event detail modal
- [x] Screen dimming schedule (CSS brightness, configurable)
- [x] Weather widget (Open-Meteo, TopBar)
- [x] Settings PIN protection
- [x] Recurring event expansion (rrule)
- [x] Search / filter events
- [x] Mini calendar in sidebar
- [x] Daily notes + meal plan section
- [x] Apple iCloud timezone fix (TZID= + Intl.DateTimeFormat offset)
- [x] Mobile PWA layout (bottom-sheet drawer)
- [x] Hours/Agenda toggle in right sidebar
- [x] Month view dynamic event count (ResizeObserver)
- [x] Per-month SWR cache + directional prefetch + shimmer
- [x] Resizable sidebar; longpress / double-click to add event

### Phase 2.5 — Layout Redesign + Write-Back + Meals ✅
- [x] Left sidebar retired; TopBar Members + Filters dropdowns
- [x] Lists panel (left, resizable) with Meals / Shopping / To-Do tabs
- [x] Google OAuth reconnect fix (published app; Reconnect button in AccountList)
- [x] Event write-back — POST/PATCH/DELETE to Google + Outlook
- [x] Drag-to-reschedule (Week/Day/Hours; `work` locked; personal confirm)
- [x] Dinner pill in Month + Week views
- [x] Meals tab in Lists panel (week-by-week planner, auto-save)

### Phase 2.6 — Local Members + Overlapping Events ✅
- [x] `FamilyMember.localOnly` — kids/family events stored in Redis
- [x] `LocalEvent` type + `local-events:{memberId}` Redis key
- [x] `/api/calendars` merges local events; `/api/events` routes CRUD to Redis
- [x] Overlapping events side-by-side in Day/Hours view (`computeColumnLayout`)
- [x] Filter persistence (localStorage)
- [x] Members dropdown replaces inline chips in TopBar

### Pre-Phase 3 Architecture ✅ (all 5 commits — uncommitted as of 2026-04-21)
- [x] **#1** Redis individual-key pattern + `createEntityHelpers<T>()`; `family:members` → `member:{id}` + `members:ids`
- [x] **#2** Zod + `parseBody<T>()` in `src/lib/validate.ts`; `/api/family` as canonical pattern
- [x] **#3** `@use-gesture/react` — `DraggableEventBlock` + `useDrag`; drag-to-create removed
- [x] **#4** AppShell + NavSidebar + TopBar + 6 tab stubs; `page.tsx` → 4-line wrapper
- [x] **#5** `public/sw.js` — Workbox 7 CDN, runtime caching, Web Push stub; `/sw.js` exempted in middleware

### Phase 3 — Skylight Feature Parity (starting Phase 3A)
> Granular specs (data models, API routes, component designs): `phase3_implementation_plan.md` in Claude Code memory

**Phase 3A — Foundation** ✅ COMPLETE
- [x] Feature 1: Multi-user auth + role system (admin / member / guest; bcrypt; per-user logins) — commit c085c19
- [x] Feature 2: Navigation polish (Agenda view + profile chips strip) — commit d60ef10
- [x] Feature 3: Profile avatars (emoji / initials / photo) + non-person profiles (Pets, Activities, Holidays) — commit 7e64b1e

**Phase 3B — Core Family Features**
- [x] Feature 4: Chores (emoji, repeat, star value, completion with confetti animation) — 93060ce
- [x] Feature 5: Routines (Morning/Afternoon/Evening blocks; daily auto-reset) — 2b1dd53
- [x] Feature 6: Lists (To Do / Grocery / Other; subcategories; color-coded grid + detail view) — 86e5305
- [x] UX-1: Calendar polish — Schedule view rename, DayCountPicker (1–7 days), single toolbar, touch swipe, h-full fixes — b1dd1d5
- [x] UX-2: InfoBar one-bar architecture — Clock shows date+time, each tab renders own InfoBar, AppShell drops TopBar, profile chips moved to separate strip — (pending commit)
- [ ] Feature 7: Rewards / Stars (star balance per profile; reward redemption; celebration animation)

**Phase 3C — Meals Expansion**
- [ ] Feature 8: Meals expanded (4 categories: breakfast/lunch/dinner/snack; notes; recurring)
- [ ] Feature 9: Recipe Box (manual + URL import via JSON-LD schema; Plan Meal; Add to Grocery List)

**Phase 3D — Display Experience**
- [ ] Feature 10: Screensaver (Google Drive public folder + API key; photo slideshow; idle detection)
- [ ] Feature 11: True sleep mode (full black overlay; scheduled; touch-to-wake)
- [ ] Feature 12: Countdowns (event flag; persistent CountdownBar; screensaver integration)
- [ ] Feature 13: Calendar settings polish (weekStart, shadeWeekends, density, scheduleDays, displayName)
- [ ] Feature 14: Wake-on-touch + brightness improvements

**Phase 3E — Integrations**
- [ ] Feature 15: ICS subscribed calendars (school district, TeamSnap, US Holidays, etc.)
- [ ] Feature 16: Per-event reminders + Web Push notifications (VAPID; wall display popup; phone push)

### Phase 4 — AI + Home Assistant (separate planning)
- [ ] Sidekick equivalent (Claude API — photo/email/voice → events/lists/recipes)
- [ ] AI meal planning
- [ ] Home Assistant integration + on-prem Pi migration

---

## Project Structure

```
TalleyCalendar/
├── FAMILYHUB-PROJECT.md              ← master spec (this file)
├── public/
│   ├── manifest.json
│   ├── sw.js                         ← Workbox 7 CDN; runtime caching + Web Push stub
│   └── icons/{icon-192.png,icon-512.png}
└── src/
    ├── middleware.ts                  ← auth guard; exempts /login, OAuth, /_next, /icons, /manifest.json, /sw.js
    ├── app/
    │   ├── layout.tsx                 ← root layout + <ServiceWorkerRegistration />
    │   ├── page.tsx                   ← 4-line wrapper: <AppShell />
    │   ├── globals.css
    │   ├── login/page.tsx
    │   ├── settings/page.tsx          ← standalone (kept separate for OAuth callback redirects)
    │   └── api/
    │       ├── auth/
    │       │   ├── login/route.ts
    │       │   ├── logout/route.ts
    │       │   ├── google/{route,connect/route}.ts
    │       │   ├── outlook/{route,connect/route}.ts
    │       │   └── apple/test/route.ts
    │       ├── accounts/{route,[id]/route}.ts
    │       ├── family/route.ts        ← canonical Zod parseBody<T>() pattern
    │       ├── calendars/route.ts     ← aggregated event fetch (all providers + local)
    │       ├── events/{route,[id]/route}.ts
    │       ├── meals/route.ts
    │       ├── notes/route.ts
    │       ├── weather/route.ts
    │       └── settings/{route,verify-pin/route}.ts
    ├── components/
    │   ├── ServiceWorkerRegistration.tsx  ← registers /sw.js on mount ('use client')
    │   ├── layout/
    │   │   ├── AppShell.tsx           ← root shell: NavSidebar + tab switcher + useScreenDim (no TopBar)
    │   │   ├── NavSidebar.tsx         ← left/bottom tab nav; exports TabId type
    │   │   ├── InfoBar.tsx            ← ONE combined info bar: left=Clock+Weather, right=rightSlot (per tab)
    │   │   ├── TopBar.tsx             ← DEPRECATED; no longer rendered anywhere
    │   │   ├── Clock.tsx              ← shows date (Mon Apr 28) + time (10:51) + AM/PM
    │   │   ├── WeatherWidget.tsx
    │   │   └── Sidebar.tsx            ← RETIRED (Phase 2.5); file kept
    │   ├── tabs/
    │   │   ├── CalendarTab.tsx        ← all calendar logic; InfoBar at top; profile chips strip; mobile sub-nav
    │   │   ├── TasksTab.tsx           ← chores + routines; InfoBar with Day/Week placeholder
    │   │   ├── RewardsTab.tsx         ← stub; InfoBar
    │   │   ├── MealsTab.tsx           ← stub; InfoBar
    │   │   ├── ListsTab.tsx           ← full lists; InfoBar with + New List right slot
    │   │   └── SleepTab.tsx           ← stub; InfoBar
    │   ├── calendar/
    │   │   ├── MonthView.tsx
    │   │   ├── WeekView.tsx           ← DraggableEventBlock + useDrag; drag-to-create removed
    │   │   ├── DayView.tsx            ← replaced by rolling agenda in Phase 3A Feature 2
    │   │   ├── AgendaSidebar.tsx      ← removed from layout (pre-Phase 3 #4); file exists
    │   │   ├── EventModal.tsx
    │   │   ├── EventDetailModal.tsx
    │   │   ├── MiniCalendar.tsx
    │   │   └── MobileDayDrawer.tsx
    │   ├── lists/
    │   │   ├── ListsPanel.tsx         ← removed from layout (pre-Phase 3 #4); file exists
    │   │   └── MealPlanPanel.tsx
    │   └── settings/
    │       ├── AccountList.tsx
    │       ├── AddAccountFlow.tsx
    │       └── FamilyMemberList.tsx
    ├── hooks/
    │   ├── useCalendarEvents.ts       ← fetches /api/calendars + /api/family; per-month SWR cache
    │   ├── useCalendarNavigation.ts
    │   ├── useEventFilters.ts         ← member/type toggles; localStorage persistence
    │   └── useScreenDim.ts            ← CSS brightness schedule
    └── lib/
        ├── auth.ts                    ← HMAC-SHA256 session token creation/verification
        ├── oauth-state.ts             ← HMAC-signed OAuth state + one-time nonce
        ├── redis.ts                   ← Upstash client + typed helpers + createEntityHelpers<T>()
        ├── validate.ts                ← Zod parseBody<T>(req, schema)
        ├── sampleData.ts
        ├── utils.ts
        └── calendar/
            ├── types.ts               ← all shared types
            ├── google.ts
            ├── outlook.ts
            ├── apple.ts
            ├── local.ts               ← normalizeLocalEvent(): LocalEvent → CalendarEvent
            └── recurrence.ts
```

---

## Environment Variables

```bash
# ── Google Calendar ──
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ── Microsoft Outlook ──
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_TENANT_ID=common

# ── Upstash Redis ──
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# ── App ──
NEXTAUTH_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ── Login (Phase 3A migrates this to per-user Redis accounts; env vars remain as admin fallback) ──
AUTH_USERNAME=
AUTH_PASSWORD=

# ── Added in Phase 3D (screensaver) ──
# GOOGLE_API_KEY=       # simple API key (not OAuth) for Google Drive photo folder access

# ── Added in Phase 3E (Web Push) ──
# VAPID_PUBLIC_KEY=
# VAPID_PRIVATE_KEY=
```

---

## Redis Key Schema

```
# Family Members (individual-key pattern — migrated pre-Phase 3 #1)
member:{id}                              → FamilyMember
members:ids                              → string[]

# Calendar Accounts
account:{id}                             → ConnectedAccount
accounts:byMember:{memberId}             → string[]

# Local Events (localOnly members — kids/family)
local-events:{memberId}                  → LocalEvent[]

# OAuth
oauth:nonce:{nonce}                      → string (10-min TTL, one-time CSRF nonce)

# App Data
settings                                 → AppSettings
note:{YYYY-MM-DD}                        → string (daily notes)
meal:{YYYY-MM-DD}                        → { name: string }  ← migrates to meals:{date} in Phase 3C

# Phase 3A — User Accounts
user:{id}                                → AppUser
users:list                               → string[]
user:byEmail:{email}                     → string (userId)

# Phase 3B — Tasks
chore:{id}                               → Chore
chores:ids                               → string[]
chore-completion:{YYYY-MM-DD}:{choreId}  → ChoreCompletion
routine:{id}                             → Routine
routines:ids                             → string[]
routine-completion:{YYYY-MM-DD}:{id}     → RoutineCompletion

# Phase 3B — Rewards
reward:{id}                              → Reward
rewards:ids                              → string[]
star-balance:{memberId}                  → number
star-transactions:{memberId}             → StarTransaction[] (Redis LIST — LPUSH/LRANGE, atomic)

# Phase 3B — Lists
list:{id}                                → AppList
lists:ids                                → string[]

# Phase 3C — Meals + Recipes
recipe:{id}                              → Recipe
recipes:ids                              → string[]
meals:{YYYY-MM-DD}                       → DayMeals (replaces meal:{date})

# Phase 3E — Integrations
ics-cache:{accountId}                    → { events, fetchedAt }
push-subscription:{userId}              → PushSubscription
reminders:{YYYY-MM-DD}                   → ReminderEntry[]
```

---

## Core Types

```typescript
// ── Enums ──
type CalendarProvider = 'google' | 'apple' | 'outlook' | 'local' | 'ics'  // 'ics' added Phase 3E
type CalendarType     = 'personal' | 'work' | 'kids' | 'shared'

// ── Family Member ──
interface FamilyMember {
  id: string
  name: string
  color: string
  localOnly?: boolean
  defaultCalendarType?: 'kids' | 'shared'
  // Added Phase 3A Feature 3:
  // avatar?: { type: 'emoji' | 'initials' | 'photo'; value: string }
  // profileType: 'person' | 'other'
  // profileCategory?: string
}

// ── Connected Account ──
interface ConnectedAccount {
  id: string
  provider: CalendarProvider
  familyMemberId: string
  label: string
  email: string
  calendarType: CalendarType
  auth:
    | { type: 'oauth';   accessToken: string; refreshToken: string; expiresAt: number }
    | { type: 'caldav';  username: string; appPassword: string }
    | { type: 'ics';     url: string }   // Phase 3E
  enabledCalendars: { calendarId: string; name: string; enabled: boolean }[]
  defaultWriteCalendarId: string
  status: 'connected' | 'error' | 'reauth_needed'
  connectedAt: string
  lastSyncAt?: string
}

// ── Calendar Event (normalized from any provider) ──
interface CalendarEvent {
  id: string
  externalId?: string
  provider: CalendarProvider
  accountId: string
  title: string
  description?: string
  location?: string
  start: Date
  end: Date
  allDay: boolean
  recurring: boolean
  recurrenceRule?: string
  familyMemberId: string
  calendarType: CalendarType
  color: string
  source: { calendarId: string; calendarName: string; provider: CalendarProvider }
  // Added Phase 3A Feature 3:
  // memberIds?: string[]
  // countdown?: boolean
  // reminder?: { minutesBefore: number }
}

// ── Local Event (Redis-stored for localOnly members) ──
interface LocalEvent {
  id: string
  memberId: string
  calendarType: 'kids' | 'shared'
  title: string
  description?: string
  location?: string
  start: string    // ISO string
  end: string      // ISO string
  allDay: boolean
}

// ── Meal Plan (current; expands to DayMeals in Phase 3C) ──
interface MealPlan { name: string }

// ── App Settings ──
interface AppSettings {
  refreshInterval: number
  defaultView: CalendarView
  dimSchedule: { start: string; end: string }    // HH:MM
  weather: { enabled: boolean; latitude: number; longitude: number; label: string }
  settingsPin: string
  // Phase 3 additions: calendarSettings, screensaver, sleepSettings, wakeOnTouch
}

type CalendarView = 'month' | 'week' | 'day'

// ── Phase 3A: User Accounts (not yet implemented) ──
// type UserRole = 'admin' | 'member' | 'guest'
// interface AppUser { id, name, email, passwordHash, role, memberId, createdAt }
// interface SessionPayload { userId, role, memberId, iat, exp }

// ── Phase 3B+ types: see phase3_implementation_plan.md ──
// Chore, ChoreRepeat, ChoreCompletion
// Routine, RoutineCompletion
// Reward, StarTransaction
// AppList, ListItem
// Recipe, MealEntry, DayMeals
// PushSubscription
```

---

## Authentication & Security

- **App login**: HMAC-SHA256 signed session cookie (`familyhub_session`, 30-day expiry)
- **Edge middleware**: all routes protected; public exceptions: `/login`, OAuth callbacks, `/_next`, `/icons`, `/manifest.json`, `/sw.js`
- **OAuth CSRF**: HMAC-signed state + one-time Redis nonce (10-min TTL); nonce consumed on callback
- **Settings PIN**: optional numeric PIN in Redis; verified server-side via `/api/settings/verify-pin`
- **Apple credentials**: never returned to client (auth field stripped from `GET /api/accounts`)
- **Phase 3A**: migrates to per-user bcrypt accounts; env-var login remains as admin fallback during transition

---

## Kiosk Mode Setup

```bash
# Chromium (Linux / Pi / laptop)
chromium-browser --kiosk --noerrdialogs --disable-infobars \
  --no-first-run --start-fullscreen "https://your-app.vercel.app"
```

Android: **Fully Kiosk Browser** — single URL lock, motion-activated wake, remote admin.

---

## Development Workflow

```bash
npm install
npm run dev       # localhost:3000
git push origin main  # Vercel auto-deploys
```

Implementation tracking lives in Claude Code memory (`.claude/projects/.../memory/`).  
Run `git log --oneline -10` at session start to verify commit state.

---

## Data Flow

```
Settings UI                       Calendar UI
    │                                  │
    ▼                                  ▼
/api/accounts (CRUD)            /api/calendars (GET)
/api/family (CRUD)                     │
    │                                  ▼
    ▼                       For each ConnectedAccount:
Redis                        ├─ google.ts  → Google Calendar API
  member:{id}                ├─ outlook.ts → Microsoft Graph API
  account:{id}               ├─ apple.ts   → CalDAV (iCloud)
  accounts:byMember:{}       ├─ local.ts   → Redis local-events:{memberId}
  settings                   └─ ics.ts     → remote ICS URL (Phase 3E)
                                       │
                                       ▼
                              Normalize → CalendarEvent[]
                                       │
                                       ▼
                              Return to UI → render on calendar
```

---

## Open Questions / Decisions

- [x] Auth model → HMAC sessions (migrating to per-user accounts Phase 3A)
- [x] Apple single-user limitation → per-user CalDAV credentials in Redis
- [x] Microsoft work accounts → multitenant + personal Azure registration
- [x] Event write-back target → `defaultWriteCalendarId` per account; no create-time prompt
- [x] UI layout → AppShell + NavSidebar tabs (retired 3-panel layout in pre-Phase 3 #4)
- [x] Meals data model → own Redis key, not a CalendarType
- [x] Local members → `localOnly` flag; events in `local-events:{memberId}`
- [x] Photo storage (screensaver) → Google Drive public folder + simple API key (no OAuth)
- [x] Phone notifications → Web Push API (VAPID, free, PWA-native)
- [x] Wall display session → permanent kiosk; no per-user login on device
- [x] Drag-to-create → removed (mouse-only, wrong for touch); users tap date or + button
- [x] SQL migration (Turso/Neon) → rejected; Redis at family scale is fine
- [x] TanStack Query → rejected; SWR works and migration cost not worth it
- [ ] Sync frequency → 5-min polling default; webhook upgrade deferred to later
- [ ] Full offline support → SW baseline done (pre-Phase 3 #5); complete offline deferred

---

## Reference Links

- [Google Calendar API v3](https://developers.google.com/calendar/api/v3/reference)
- [Microsoft Graph Calendar](https://learn.microsoft.com/en-us/graph/api/resources/calendar)
- [tsdav (CalDAV client)](https://github.com/natelindev/tsdav)
- [Open-Meteo Weather API](https://open-meteo.com/en/docs)
- [Upstash Redis](https://upstash.com/docs/redis/overall/getstarted)
- [Workbox (service worker)](https://developer.chrome.com/docs/workbox)
- [Skylight Calendar](https://ourskylight.com) — primary competitive reference
- [Fully Kiosk Browser](https://www.fully-kiosk.com/)
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
