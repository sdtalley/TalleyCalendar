# FamilyHub Calendar — Project Specification

## Overview

A self-hosted family calendar web application that aggregates multiple calendar sources (Google, Apple iCloud, Outlook) into a single, unified interface. Designed primarily for a wall-mounted kitchen display (27" touch) but accessible from any device via web browser.

---

## Problem Statement

Current off-the-shelf solutions (Echo Show 15, Skylight, Cozyla) are either too expensive, too slow, or lack the flexibility to aggregate disparate calendar ecosystems. The family uses a mix of Google Calendar, Apple iCloud Calendar, and Outlook — no single product handles all three well with a good UI.

---

## Goals

1. **Unified view** of all family calendars regardless of provider
2. **Large-format, touch-friendly UI** optimized for a wall-mounted display
3. **Easy event creation** from both the display and mobile devices
4. **Per-person and per-calendar-type filtering** (toggle work vs personal vs kids)
5. **Zero or near-zero recurring cost** — use free hosting tiers
6. **Extensible foundation** for future Home Assistant integration and smart features

---

## Architecture

### Hosting: Vercel (Free Tier)

```
┌─────────────────────────────────────────────────┐
│                    VERCEL                        │
│                                                  │
│  ┌──────────────┐    ┌────────────────────────┐  │
│  │  Static Site  │    │   Serverless Functions  │  │
│  │  (Next.js /   │◄──►│                        │  │
│  │   React App)  │    │  /api/calendars         │  │
│  │               │    │  /api/accounts          │  │
│  │  Month View   │    │  /api/family            │  │
│  │  Week View    │    │  /api/settings          │  │
│  │  Day View     │    │  /api/weather           │  │
│  │  Agenda       │    │  /api/auth/*            │  │
│  └──────────────┘    └────────────────────────┘  │
│                              │                    │
│                     ┌────────┴────────┐           │
│                     │  Upstash Redis  │           │
│                     │  (free tier)    │           │
│                     │  - OAuth tokens │           │
│                     │  - User config  │           │
│                     │  - Settings     │           │
│                     └─────────────────┘           │
└─────────────────────────────────────────────────┘
         │                │               │
         ▼                ▼               ▼
   Google Cal API   Apple CalDAV    MS Graph API
   (OAuth 2.0)     (App-Specific    (OAuth 2.0)
                     Password)
```

### Why Vercel over On-Prem (for now)

- Accessible from anywhere — kitchen display, phones, laptops — no VPN needed
- No security exposure on home network
- Free tier is more than sufficient (100GB bandwidth, serverless functions)
- Deploys via `git push` — iterate fast in Claude Code
- The Pi 3B stays available for Home Assistant later
- **Migration path**: same codebase can move to Pi + Cloudflare Tunnel when HA integration happens

### Future On-Prem Option

When Home Assistant enters the picture, the likely migration path is:

```
Pi 3B/4/5 running:
  - Home Assistant (primary)
  - FamilyHub Calendar (Docker container or Node process)
  - Cloudflare Tunnel or Tailscale (free, secure remote access)
```

---

## UI Layout Architecture

### Three-Panel Desktop Layout

```
┌─────────────────┬──────────────────────────┬─────────────────┐
│   Lists Panel   │      Calendar (main)      │  Hours / Agenda │
│  (resizable,    │    Month / Week view      │  (resizable,    │
│   collapsible)  │                           │   collapsible)  │
│                 │                           │                 │
│  Meals          │                           │  Mini calendar  │
│  Shopping       │                           │  Day timeline   │
│  To-Do          │                           │  Event list     │
└─────────────────┴──────────────────────────┴─────────────────┘
```

**Semantic reading direction**: Planning (left) → Overview (center) → Detail (right)

### Panel Behavior
- Both sidebars are **resizable** via drag handle and **collapsible** to a ~40px icon strip
- Collapsed state is persisted in Redis settings per-device (or localStorage)
- Default widths: Lists ~280px, Hours/Agenda ~300px

### Filter Relocation (left sidebar removed)
- **Family member toggles** → TopBar avatar chip buttons (colored dot + name, tap to toggle, dims when off)
- **Calendar type filters** → "Filters" dropdown button in TopBar (used rarely; hidden until needed)
- Left sidebar is fully retired; its space becomes the Lists panel

### Mobile Layout
- TopBar avatar chips remain visible (compact)
- Lists panel → bottom drawer via a list/menu icon button (same pattern as MobileDayDrawer)
- Hours/Agenda → bottom sheet on day tap (unchanged)
- Both sidebars hidden; full-width calendar preserved

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | **Next.js 14+ (App Router)** | Vercel-native, SSR for fast loads, API routes built-in |
| UI | **React + Tailwind CSS** | Rapid iteration, responsive, dark theme |
| Calendar Lib | **Custom grid components** | Full control over touch interactions and display density |
| Google Integration | **Google Calendar API v3** | OAuth 2.0, full CRUD |
| Apple Integration | **CalDAV (via `tsdav`)** | App-specific password auth, read |
| Outlook Integration | **Microsoft Graph API** | OAuth 2.0, full CRUD |
| Data Store | **Upstash Redis** (`@upstash/redis`) | Token storage, event cache, user preferences |
| Auth | **Custom HMAC-SHA256 sessions** | Cookie-based login with Edge middleware route protection |
| OAuth Security | **HMAC-signed state + one-time nonce** | CSRF protection for OAuth flows, nonces stored in Redis with TTL |
| Weather | **Open-Meteo API** | Free, no API key required, 10-min cache |
| Deployment | **Vercel (free tier)** | Auto-deploy from GitHub |
| Version Control | **GitHub** | Source of truth, triggers Vercel deploys |

---

## Display Hardware

### Current Plan (Budget / Free)

**Server**: Raspberry Pi 3B (already owned) — reserved for future Home Assistant use. Not needed if hosting on Vercel.

**Display options (ranked by feasibility)**:

1. **Old touchscreen laptop (16")** — Open Chromium in kiosk mode (`chromium-browser --kiosk http://familyhub.vercel.app`). Prop or wall-mount as-is; disassemble later for flush mounting.
2. **Peloton display (salvaged)** — Runs Android. Check if it boots; touch issue may be loose ribbon cable. Sideload a browser if touch works.
3. **Echo Show 15 (existing)** — Use Silk browser to access the web app. Likely sluggish but zero-effort to test.
4. **Any spare monitor/TV + Pi 3B** — Pi serves and displays in kiosk mode. Pi 3B is slow for Chromium; usable but not ideal.

### Future Upgrade Path

27" capacitive touch monitor ($250–400 range: UPERFECT, ViewSonic TD2760, Dell P2418HT) + Raspberry Pi 4/5 or thin client, VESA-mounted.

---

## Features

### Phase 1 — Core Calendar (MVP) ✅

- [x] Month view with event indicators
- [x] Week view with time blocks
- [x] Day view with timeline
- [x] Agenda sidebar (selected day + upcoming)
- [x] Per-family-member color coding and toggle
- [x] Per-calendar-type filtering (Personal / Work / Kids / Shared)
- [x] Quick-add event modal (touch-friendly)
- [x] Live clock display
- [x] Keyboard shortcuts (arrow keys, T for today, N for new event, M/W/D for views)
- [x] Dark theme optimized for always-on display
- [x] PWA manifest + icons (installable on phones, add-to-homescreen)
- [x] Upstash Redis integration (family members, accounts, settings)
- [x] Settings page — family member management (add/edit/remove, pick color)
- [x] Settings page — "Add Calendar Account" flow (pick provider + member)
- [x] Google Calendar OAuth flow (connect → discover calendars → pick which to show)
- [x] Microsoft Outlook OAuth flow (multitenant: personal + work/Entra accounts)
- [x] Apple iCloud CalDAV flow (enter creds in UI → test connection → discover calendars)
- [x] Account management (status indicators, toggle, reconnect, remove)
- [x] Aggregated event fetching (all connected accounts → unified CalendarEvent list)
- [x] Auto-refresh polling (5-minute interval via useCalendarEvents hook)
- [x] Login authentication (HMAC-SHA256 signed cookies, Edge middleware)
- [x] OAuth CSRF protection (HMAC-signed state + one-time Redis nonces)

### Phase 2 — Polish & Usability ✅

- [x] Multi-day / all-day event rendering (banners in month, dedicated sections in week/day)
- [x] Event detail modal (click any event → full details with source, location, recurrence)
- [x] Screen dimming schedule (configurable in Settings, default 10pm–6am, CSS brightness)
- [x] Weather widget (Open-Meteo in TopBar, configurable lat/lon in Settings)
- [x] Settings PIN protection (numeric PIN gate for kiosk mode)
- [x] PWA icons (192x192 + 512x512, dark calendar theme)
- [x] Drag-to-create events (drag on week/day timeline to pre-fill event modal)
- [x] Recurring event expansion (rrule library expands instances in API response)
- [x] Search / filter events (search bar in TopBar, / keyboard shortcut)
- [x] Mini calendar in sidebar for quick date navigation
- [x] Daily notes / meal plan section (per-day notes in AgendaSidebar, saved to Redis)

### Phase 2 — UI/UX Refinements ✅

- [x] **Apple iCloud timezone fix** — extract `TZID=` from `DTSTART`/`DTEND`; use `Intl.DateTimeFormat` offset trick to convert named-timezone local times to UTC on Vercel's UTC server
- [x] **Mobile PWA responsive layout** — single breakpoint (`< 768px`): sidebars hidden, TopBar collapses to 2 rows, day tap opens a bottom-sheet drawer (`MobileDayDrawer`) with that day's events; `100dvh` for browser-chrome stability
- [x] **Right sidebar: Hours / Agenda toggle** — clicking a day auto-switches the right sidebar to Hours mode, which renders the full `DayView` (hour grid + drag-to-create) inside the 300px panel; Agenda mode shows the original 7-day upcoming list + daily notes
- [x] **Desktop top bar: Day tab removed** — Day view now lives in the sidebar; desktop shows Month / Week only; mobile retains all three tabs
- [x] **TopBar layout fix** — 3-column CSS grid (`1fr auto 1fr`) prevents left-nav and right-controls from ever colliding; weather + clock live in the centered auto column
- [x] **Month view: dynamic event count** — `ResizeObserver` on the grid container computes `maxShow` from actual row height; shows more events on tall screens, fewer on compact ones
- [x] **Month view: clicking a day stays in Month view** — day click (grid and mini-calendar) updates the right sidebar only; no longer forces a view switch
- [x] **Month view: compact right-justified time** — timed events show `9a` / `3:30p` right-aligned in the pill (name truncates toward it); hidden on mobile so the name gets full width
- [x] **Day/Week view: remove redundant time text** — time is implied by event position on the hour grid; time text inside blocks removed to recover vertical space on short events
- [x] **Search bar cleanup** — magnifying glass icon removed; placeholder simplified to "Search"

### Phase 2 — Polish Backlog ✅

- [x] **Longpress / double-click to add event** — double-click a month day cell (desktop) or long-press 600ms (mobile/touchscreen) opens the add-event modal pre-filled to that date; synthetic post-longpress click suppressed so day-select doesn't also fire
- [x] **Resizable sidebar** — drag handle on left border of right sidebar resizes between 240px–520px; accent pill indicator on hover; mouse and touch both supported
- [x] **Calendar event prefetch + SWR cache** — `useCalendarEvents` now accepts `currentDate` and maintains a per-month cache keyed by `"YYYY-MM"`; on navigation to a cached month events display instantly with a silent SWR revalidation in the background; cache misses show a faint shimmer sweep on the calendar grid; after initial load the next month forward is immediately prefetched; subsequent navigations trigger a directional prefetch (500ms debounce) for the predicted next month; cache entries evict when more than 3 months from the current view; the 5-min polling interval always refreshes the currently visible window

### Phase 2.5 — Layout Redesign + Event Write-Back + Meals

#### Layout Redesign ✅
- [x] **Remove left sidebar** (`Sidebar.tsx`) — retired; `ListsPanel` occupies left slot
- [x] **TopBar filter chips** — family member avatar chips (colored, tap-to-toggle, dim when off) inline in TopBar
- [x] **TopBar filter dropdown** — "Filters" button for calendar type toggles (Personal/Work/Kids/Shared)
- [x] **Lists panel** (left side, resizable 220–520px + collapsible to 44px icon strip) — shell with Meals / Shopping / To-Do tabs; Shopping and To-Do are stubs
- [x] **Mobile Lists drawer** — `MobileListsDrawer` bottom sheet via ☰ button in mobile TopBar row 2

#### Google OAuth Reconnect Fix ✅
- [x] **Publish Google OAuth app** — moved consent screen from "Testing" to "Published" in Google Cloud Console; eliminates 7-day refresh token expiry
- [x] **Reconnect button UI** — in `AccountList.tsx`, amber "Reconnect" button shown when `status === 'reauth_needed'` (Google + Outlook); re-triggers OAuth via `?reconnectAccountId=` param; callback updates only tokens + status, preserving label/calendarType/enabledCalendars

#### Event Write-Back ✅
- [x] **`defaultWriteCalendarId` per account** — add field to `ConnectedAccount`; shown in account settings as radio selector of enabled calendars; falls back to `"primary"` for Google
- [x] `POST /api/events` — create event on provider (Google Calendar API, MS Graph); optimistic local event shown immediately
- [x] `PATCH /api/events/:id` — update event on provider (move, resize, rename); optimistic position shown during drag
- [x] `DELETE /api/events/:id` — delete event on provider; Delete button in EventDetailModal (Google/Outlook only)
- [x] **Drag-to-reschedule** — drag existing Google/Outlook events to new times; ghost preview during drag; cross-day supported in Week/Day/Hours views; Month view drag opens confirmation modal to adjust time before committing; scoped to `shared` and `kids` calendar types only (work locked to prevent accidental meeting moves; personal locked to prevent one family member moving another's events; Apple CalDAV read-only by design)

#### Meals Feature ✅
- [x] **`meal:{YYYY-MM-DD}` Redis key** — stores `{ name: string }` JSON (structured for future ingredient expansion)
- [x] **`GET/PUT /api/meals`** — read/write meal plan entries by date or week range
- [x] **Dinner pill rendering** — pinned amber pill at bottom of each day cell in Month view (amber left-border style); pinned "Dinner" band row always visible below all-day section in Week view
- [x] **Meals tab in Lists panel** — week-by-week planner (Sun–Sat), inline click-to-edit, week navigation arrows, auto-save on blur/Enter, today highlighted with accent color
- [x] **`MealPlanPanel.tsx`** — standalone component inside `ListsPanel.tsx` shell; `MobileListsDrawer` also renders it on mobile

### Phase 2.6 — Local Members + Overlapping Events

#### Local Members (Kids / Family) ✅
- [x] **`FamilyMember.localOnly`** — optional boolean flag; when true, the member has no external calendar account and all events are stored in Redis
- [x] **`FamilyMember.defaultCalendarType`** — `'kids' | 'shared'`; the calendarType stamped on all local events for this member
- [x] **`LocalEvent` type** — `{ id, memberId, calendarType, title, description?, location?, start, end, allDay }` stored as JSON array at `local-events:{memberId}` in Redis
- [x] **`src/lib/calendar/local.ts`** — `normalizeLocalEvent()` converts `LocalEvent` → `CalendarEvent` with `provider: 'local'`, `accountId: 'local:{memberId}'`
- [x] **Redis helpers** — `getLocalEvents`, `saveLocalEvent`, `updateLocalEvent`, `deleteLocalEvent`, `getAllLocalEvents` added to `redis.ts`
- [x] **`/api/calendars`** — fetches local events for all `localOnly` members, filters to the requested time window, normalizes, and merges into the unified event list
- [x] **`/api/events` POST** — detects `localOnly` member; writes `LocalEvent` to Redis instead of calling a provider API; returns `provider: 'local'` response shape
- [x] **`/api/events/[id]` PATCH/DELETE** — detects `accountId.startsWith('local:')` and routes to `updateLocalEvent` / `deleteLocalEvent` in Redis
- [x] **Settings UI** — `FamilyMemberList.tsx` "No external calendar account" toggle in member form; when enabled, Kids / Family·Shared type picker appears; member list shows colored badge ("Kids · Local" / "Family · Local")
- [x] **`EventModal.tsx`** — localOnly member selected → calendar type field locked to member's `defaultCalendarType`; switching Person auto-updates type

#### Overlapping Events Side-by-Side in Hours / Day View ✅
- [x] **`computeColumnLayout()`** — greedy column-assignment algorithm in `DayView.tsx`; sorts events by start, builds overlap clusters, assigns each event a `(col, totalCols)` pair
- [x] **Side-by-side rendering** — each timed event uses `left: calc(col/totalCols * 100% + 1px)` / `right: calc((totalCols-col-1)/totalCols * 100% + Npx)`; non-overlapping events continue to use full width

### Phase 3 — Home Assistant Integration

- [ ] Embed HA dashboard as a tab/panel
- [ ] Pull HA entity states into calendar sidebar (lights, locks, thermostat, etc.)
- [ ] Display HA alerts/notifications
- [ ] Migration path: move from Vercel to on-prem Pi with Cloudflare Tunnel
- [ ] Split-screen or swipe between Calendar and HA Dashboard

### Phase 4 — Smart Features (Long-term)

- [ ] Flier/photo scan → auto-create event (OCR + LLM parsing via phone camera)
- [ ] Natural language event creation ("Soccer practice every Tuesday 4pm")
- [ ] Family member location awareness (ETA to home)
- [ ] **Shopping list** — Lists panel Shopping tab; `shopping:{YYYY-WW}` Redis key; manual add + auto-populate from meal plan ingredients
- [ ] **To-Do list** — Lists panel To-Do tab; `todo:{YYYY-MM-DD}` Redis key
- [ ] **Meal ingredients** — expand `meal:{YYYY-MM-DD}` to `{ name, ingredients: Ingredient[] }`; ingredients sync to Shopping list
- [ ] **AI meal suggestions** — suggest dinners based on history, season, or prompt
- [ ] Birthday/anniversary reminders with countdown
- [ ] School calendar import (ICS bulk import)
- [ ] Notification system (push to phones for upcoming events)

---

## Calendar Account Architecture

### Design Principle: Multi-Account, UI-Driven

Every calendar connection is managed **from the Settings UI**, not from `.env` files. Family
members can each connect their own accounts across any provider. `.env` holds only the
**app-level OAuth client credentials** (one Google project, one Azure app registration).
Per-user tokens and Apple credentials are stored in **Upstash Redis**, keyed per account.

### Account Model (stored in Redis)

```
Redis key structure:
  family:members                     → JSON array of FamilyMember objects
  account:{accountId}                → JSON ConnectedAccount object
  accounts:byMember:{memberId}       → JSON array of accountId strings
  settings                           → JSON AppSettings object
  oauth:nonce:{nonce}                → one-time nonce for OAuth CSRF (10-min TTL)
  note:{YYYY-MM-DD}                  → string (daily notes)
  meal:{YYYY-MM-DD}                  → JSON MealPlan object { name: string } (expandable to ingredients)
  local-events:{memberId}            → JSON array of LocalEvent objects (for localOnly members)
```

```typescript
interface ConnectedAccount {
  id: string                          // uuid
  provider: 'google' | 'outlook' | 'apple'
  familyMemberId: string              // which family member owns this
  label: string                       // display name, e.g. "Dad's Work Gmail"
  email: string                       // the account email (for display)
  calendarType: CalendarType          // personal | work | kids | shared

  // Provider-specific auth
  auth:
    | { type: 'oauth'; accessToken: string; refreshToken: string; expiresAt: number }
    | { type: 'caldav'; username: string; appPassword: string }

  // Which calendars from this account are enabled
  enabledCalendars: {
    calendarId: string                // e.g. "primary", "family@group.calendar.google.com"
    name: string                      // display name from provider
    enabled: boolean
  }[]

  defaultWriteCalendarId: string      // which sub-calendar to write new events to; falls back to "primary"

  status: 'connected' | 'error' | 'reauth_needed'
  connectedAt: string                 // ISO date
  lastSyncAt?: string                 // ISO date
}
```

### Settings UI Flow

1. **Settings → Family Members**: Add/edit/remove family members (name, color)
2. **Settings → Calendar Accounts**: "Add Calendar Account" button
3. User picks a **provider** (Google, Microsoft, Apple) and a **family member**
4. **Google / Microsoft**: Redirect to OAuth consent → callback saves tokens → app fetches
   available calendars from that account → user picks which to show and categorizes them
5. **Apple**: Inline form for iCloud email + app-specific password → app tests the CalDAV
   connection → on success, fetches available calendars → user picks which to show
6. Connected accounts are listed per family member with status indicator, toggle, and remove
7. **Screen Dimming**: Configure dim/brighten times for kiosk use
8. **Weather**: Enable/disable, set location coordinates and city label
9. **Settings PIN**: Set a numeric PIN to protect the Settings page from accidental changes

### Provider Details

#### Google Calendar
- **App setup** (one-time, by you): Google Cloud Console → project → enable Calendar API → OAuth 2.0 credentials
- **Auth flow**: OAuth 2.0 with refresh tokens. HMAC-signed state param encodes `memberId` + `calendarType` with one-time nonce for CSRF protection
- **Scopes**: `calendar.readonly` (read), `calendar.events` (write)
- **Endpoints**: Google Calendar API v3 — `GET /users/me/calendarList` (discover calendars), `GET /calendars/{id}/events` (fetch events)
- **Token refresh**: Automatic — refresh token stored in Redis, access token refreshed server-side when expired
- **Gotcha**: App starts in "Testing" mode (100 users max). Fine for family use. Google verification needed only if you want to open it to others.

#### Microsoft Outlook (personal + work accounts)
- **App setup** (one-time, by you): Azure Portal → App Registration
  - **Supported account types: "Accounts in any organizational directory AND personal Microsoft accounts"** (multitenant + personal)
  - This allows both personal Outlook.com accounts AND work/school Entra ID accounts
- **Auth flow**: OAuth 2.0 via MSAL. HMAC-signed state param with one-time nonce
- **Scopes**: `Calendars.ReadWrite`, `User.Read`
- **Endpoints**: Microsoft Graph API — `GET /me/calendars` (discover), `GET /me/calendarView` (fetch events in time range)
- **Work account gotcha**: Some organizations require admin consent for third-party apps. If your Entra tenant blocks it, you (as admin) can grant consent in Azure Portal → Enterprise Applications → your app → Permissions → "Grant admin consent"
- **Tenant ID**: Use `common` to support all account types

#### Apple iCloud Calendar
- **Auth**: No OAuth available. Each user generates an **app-specific password** at appleid.apple.com
- **Protocol**: CalDAV (WebDAV extension) via `tsdav` library
- **Server**: `https://caldav.icloud.com`
- **Flow**: User enters iCloud email + app-specific password in Settings UI → app tests connection server-side (credentials never sent to client) → on success, discovers calendars via CalDAV PROPFIND → saves credentials to Redis
- **iCal parsing**: Custom RFC 5545 parser handles line unfolding, VTIMEZONE vs VEVENT scoping, all-day vs timed events, recurrence rules; `TZID=`-qualified `DTSTART`/`DTEND` values are converted to UTC via the `Intl.DateTimeFormat` offset trick (critical on Vercel which runs in UTC)
- **Multiple users**: Each family member can add their own Apple account (credentials stored per-account in Redis, not in `.env`)
- **Gotcha**: Credentials can't be validated until we try to connect. The UI must test on save and show clear success/failure. If Apple revokes the app-specific password, the account status changes to `reauth_needed`

---

## Project Structure

```
TalleyCalendar/
├── README.md
├── FAMILYHUB-PROJECT.md              ← this file (master spec)
├── NEXT-STEPS.md                     ← step-by-step implementation tracker
├── package.json
├── next.config.js
├── tailwind.config.js
├── .env.local                        ← app-level secrets only (never committed)
├── .env.example                      ← template for required env vars
├── public/
│   ├── manifest.json                 ← PWA manifest
│   └── icons/
│       ├── icon-192.png              ← PWA icon (dark calendar theme)
│       └── icon-512.png              ← PWA icon (dark calendar theme)
├── src/
│   ├── middleware.ts                  ← Edge middleware: route protection (Web Crypto HMAC)
│   ├── app/
│   │   ├── layout.tsx                ← root layout, global styles, metadata
│   │   ├── page.tsx                  ← main calendar page
│   │   ├── globals.css               ← design system (CSS vars + Tailwind + settings styles)
│   │   ├── login/
│   │   │   └── page.tsx              ← login page (username/password form)
│   │   ├── settings/
│   │   │   └── page.tsx              ← Settings UI: members, accounts, dimming, weather, PIN
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/route.ts            ← POST: verify credentials, set session cookie
│   │       │   ├── logout/route.ts           ← POST: clear session cookie
│   │       │   ├── google/
│   │       │   │   ├── route.ts              ← Google OAuth callback
│   │       │   │   └── connect/route.ts      ← initiate Google OAuth
│   │       │   ├── outlook/
│   │       │   │   ├── route.ts              ← Outlook OAuth callback
│   │       │   │   └── connect/route.ts      ← initiate Outlook OAuth
│   │       │   └── apple/
│   │       │       └── test/route.ts         ← POST: test CalDAV creds + save account
│   │       ├── accounts/
│   │       │   ├── route.ts                  ← GET (list, auth stripped), DELETE
│   │       │   └── [id]/
│   │       │       └── route.ts              ← GET single, PATCH update
│   │       ├── family/
│   │       │   └── route.ts                  ← GET/POST/PATCH/DELETE family members
│   │       ├── calendars/
│   │       │   └── route.ts                  ← GET aggregated events from all accounts
│   │       ├── notes/
│   │       │   └── route.ts                  ← GET/PUT daily notes per date
│   │       ├── meals/
│   │       │   └── route.ts                  ← GET/PUT meal plan entries by date or week range
│   │       ├── weather/
│   │       │   └── route.ts                  ← GET current weather (Open-Meteo proxy)
│   │       └── settings/
│   │           ├── route.ts                  ← GET/PUT app settings
│   │           └── verify-pin/route.ts       ← GET (PIN required?), POST (verify PIN)
│   ├── components/
│   │   ├── calendar/
│   │   │   ├── MonthView.tsx         ← month grid; dynamic event count (ResizeObserver); compact right-justified times; dinner pill pinned at bottom of day cells
│   │   │   ├── WeekView.tsx          ← week grid with all-day section + drag-to-create; dinner band row pinned below all-day section
│   │   │   ├── DayView.tsx           ← day timeline; supports hideHeader prop for sidebar embedding
│   │   │   ├── AgendaSidebar.tsx     ← Hours/Agenda toggle; Hours mode embeds DayView; Agenda shows 7-day list + notes (right panel)
│   │   │   ├── MobileDayDrawer.tsx   ← bottom-sheet drawer shown on mobile when a day is tapped
│   │   │   ├── MiniCalendar.tsx      ← compact month calendar for sidebar navigation
│   │   │   ├── EventModal.tsx        ← quick-add new event (supports drag pre-fill)
│   │   │   └── EventDetailModal.tsx  ← view event details (click any event)
│   │   ├── lists/
│   │   │   ├── ListsPanel.tsx        ← left panel shell + MobileListsDrawer; Meals/Shopping/To-Do tabs; resizable + collapsible
│   │   │   └── MealPlanPanel.tsx     ← week-by-week meal planner; inline click-to-edit; week navigation; today highlight
│   │   ├── settings/
│   │   │   ├── FamilyMemberList.tsx  ← manage family members (add/edit/remove)
│   │   │   ├── AccountList.tsx       ← list connected accounts per member; amber Reconnect button when reauth_needed (Google/Outlook)
│   │   │   └── AddAccountFlow.tsx    ← provider picker + OAuth redirect / Apple form
│   │   └── layout/
│   │       ├── TopBar.tsx            ← 3-column grid; family member chip toggles; Filters dropdown; mobile ☰ Lists button
│   │       ├── Sidebar.tsx           ← RETIRED — file kept for reference; no longer rendered
│   │       ├── Clock.tsx             ← live clock display
│   │       └── WeatherWidget.tsx     ← current weather in top bar
│   ├── hooks/
│   │   ├── useCalendarEvents.ts      ← fetches /api/calendars + /api/family; per-month SWR cache, directional prefetch, shimmer on cold miss, 5-min poll
│   │   ├── useCalendarNavigation.ts  ← view state, date navigation
│   │   ├── useEventFilters.ts        ← family/type toggles via disabledMembers Set
│   │   └── useScreenDim.ts           ← screen dimming based on schedule from Redis
│   └── lib/
│       ├── auth.ts                   ← HMAC-SHA256 session token creation/verification
│       ├── oauth-state.ts            ← HMAC-signed OAuth state + one-time nonce
│       ├── redis.ts                  ← Upstash Redis client + typed helpers (includes daily notes)
│       ├── sampleData.ts             ← sample events for demo/no-account-connected fallback
│       ├── utils.ts                  ← date helpers, formatters (formatTime, formatTimeCompact), eventSpansDay
│       └── calendar/
│           ├── types.ts              ← CalendarEvent, ConnectedAccount, FamilyMember, AppSettings
│           ├── google.ts             ← Google Calendar API client (token refresh, fetch)
│           ├── outlook.ts            ← Microsoft Graph API client (token refresh, fetch)
│           ├── apple.ts              ← CalDAV client (tsdav), iCal parser (VEVENT scoping)
│           ├── local.ts              ← normalizeLocalEvent(): LocalEvent → CalendarEvent for localOnly members
│           └── recurrence.ts         ← rrule-based recurring event expansion
```

---

## Environment Variables

`.env` holds **app-level credentials only** — no per-user tokens or passwords.

```bash
# .env.example

# ── Google Calendar (OAuth app credentials — one project for all users) ──
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ── Microsoft Outlook (Azure app registration — multitenant + personal) ──
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_TENANT_ID=common

# ── Upstash Redis (stores per-user tokens, family config, settings) ──
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# ── App ──
NEXTAUTH_SECRET=              # used to sign session cookies and OAuth state
NEXT_PUBLIC_APP_URL=http://localhost:3000  # base URL (set to Vercel URL in prod)

# ── Login ──
AUTH_USERNAME=                # username for app login
AUTH_PASSWORD=                # password for app login
```

**What lives in Redis instead of `.env`:**
- `APPLE_CALDAV_USERNAME` / `APPLE_CALDAV_APP_PASSWORD` → stored per-account in Redis
- `GOOGLE_REDIRECT_URI` / `AZURE_REDIRECT_URI` → computed from `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_REFRESH_INTERVAL`, dim schedule, weather config → stored in Redis settings, managed via UI
- Per-user OAuth tokens → stored per-account in Redis

---

## Configuration Model

All configuration is stored in **Upstash Redis** and managed via the **Settings UI**.

### Family Members (Redis key: `family:members`)

```json
[
  { "id": "dad", "name": "Dad", "color": "#6c8cff" },
  { "id": "mom", "name": "Mom", "color": "#ff6b8a" },
  { "id": "alex", "name": "Alex", "color": "#4ecdc4" }
]
```

### Connected Accounts (Redis key: `account:{id}`)

Each family member can have **multiple** connected accounts across **any** provider:

```json
{
  "id": "acc_a1b2c3",
  "provider": "google",
  "familyMemberId": "dad",
  "label": "Dad's Gmail",
  "email": "dad@gmail.com",
  "calendarType": "personal",
  "auth": {
    "type": "oauth",
    "accessToken": "ya29...",
    "refreshToken": "1//0e...",
    "expiresAt": 1712345678
  },
  "enabledCalendars": [
    { "calendarId": "primary", "name": "Dad's Calendar", "enabled": true },
    { "calendarId": "family@group.calendar.google.com", "name": "Family", "enabled": true }
  ],
  "status": "connected",
  "connectedAt": "2026-04-03T12:00:00Z",
  "lastSyncAt": "2026-04-03T14:30:00Z"
}
```

### App Settings (Redis key: `settings`)

```json
{
  "refreshInterval": 300000,
  "defaultView": "month",
  "dimSchedule": { "start": "22:00", "end": "06:00" },
  "weather": {
    "enabled": true,
    "latitude": 32.7767,
    "longitude": -96.7970,
    "label": "Dallas"
  },
  "settingsPin": ""
}
```

---

## Core Types

All calendar sources normalize events to a common shape. Accounts track per-user connections.

```typescript
// ── Enums ──
type CalendarProvider = 'google' | 'apple' | 'outlook' | 'local'
type CalendarType = 'personal' | 'work' | 'kids' | 'shared'

// ── Family Member ──
interface FamilyMember {
  id: string
  name: string
  color: string
  localOnly?: boolean                       // no external account; events stored in Redis
  defaultCalendarType?: 'kids' | 'shared'  // calendarType applied to all local events
}

// ── Connected Account (stored in Redis per-account) ──
interface ConnectedAccount {
  id: string
  provider: CalendarProvider
  familyMemberId: string
  label: string
  email: string
  calendarType: CalendarType
  auth:
    | { type: 'oauth'; accessToken: string; refreshToken: string; expiresAt: number }
    | { type: 'caldav'; username: string; appPassword: string }
  enabledCalendars: {
    calendarId: string
    name: string
    enabled: boolean
  }[]
  defaultWriteCalendarId: string     // target for new events; falls back to "primary"
  status: 'connected' | 'error' | 'reauth_needed'
  connectedAt: string
  lastSyncAt?: string
}

// ── Calendar Event (normalized from any provider) ──
interface CalendarEvent {
  id: string
  externalId?: string
  provider: CalendarProvider
  accountId: string              // which ConnectedAccount this came from
  title: string
  description?: string
  location?: string
  start: Date
  end: Date
  allDay: boolean
  recurring: boolean
  recurrenceRule?: string
  familyMemberId: string         // inherited from the account's owner
  calendarType: CalendarType     // inherited from the account's type
  color: string                  // inherited from the family member
  source: {
    calendarId: string
    calendarName: string
    provider: CalendarProvider
  }
}

// ── Local Event (Redis-stored for localOnly members — kids, family) ──
interface LocalEvent {
  id: string
  memberId: string
  calendarType: 'kids' | 'shared'
  title: string
  description?: string
  location?: string
  start: string   // ISO string
  end: string     // ISO string
  allDay: boolean
}

// ── Meal Plan (stored per-day in Redis, separate from CalendarEvents) ──
interface MealPlan {
  name: string                       // dinner name for that day
  // future: servings?: number; notes?: string; ingredients?: Ingredient[]
}

// ── App Settings ──
interface AppSettings {
  refreshInterval: number        // ms, default 300000 (5 min)
  defaultView: CalendarView
  dimSchedule: {
    start: string                // HH:MM
    end: string                  // HH:MM
  }
  weather: {
    enabled: boolean
    latitude: number
    longitude: number
    label: string                // city name for display
  }
  settingsPin: string            // numeric PIN, empty = disabled
}

// ── UI Types ──
interface FamilyMemberUI extends FamilyMember {
  enabled: boolean               // client-side toggle state, not stored in Redis
}

type CalendarView = 'month' | 'week' | 'day'
```

---

## Authentication & Security

### App Login
- Simple username/password login (`AUTH_USERNAME` / `AUTH_PASSWORD` env vars)
- HMAC-SHA256 signed session token stored in `familyhub_session` cookie (30-day expiry)
- Server-side verification via `crypto.timingSafeEqual`
- Edge middleware (`src/middleware.ts`) protects all routes except `/login`, `/api/auth/login`, OAuth callbacks, and static assets
- Uses Web Crypto API in middleware (Edge runtime compatible)

### OAuth CSRF Protection
- OAuth state params are HMAC-SHA256 signed with `NEXTAUTH_SECRET`
- One-time nonce stored in Redis with 10-minute TTL
- State payload encodes `memberId`, `calendarType`, and `nonce`
- Callback verifies signature AND consumes nonce (prevents replay)

### Settings PIN
- Optional numeric PIN (up to 8 digits) stored in Redis as part of AppSettings
- Settings page shows PIN gate modal when PIN is configured
- PIN verified server-side via `/api/settings/verify-pin`

### Apple Credentials
- CalDAV credentials (email + app-specific password) are tested and saved server-side only
- Credentials are never returned to the client (auth field stripped from GET /api/accounts)

---

## Kiosk Mode Setup (Display Device)

### Chromium Kiosk (Linux / Pi / Old Laptop)

```bash
#!/bin/bash
# kiosk.sh — run on boot via systemd or ~/.config/autostart

# Wait for network
sleep 10

# Disable screen blanking
xset s off
xset -dpms
xset s noblank

# Launch Chromium in kiosk mode
chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-translate \
  --no-first-run \
  --start-fullscreen \
  --autoplay-policy=no-user-gesture-required \
  "https://your-app.vercel.app"
```

### Android (Peloton / Tablet)

Use **Fully Kiosk Browser** (free for basic use) — locks device to a single URL with auto-refresh, motion-activated screen wake, and remote admin.

---

## Development Workflow

```bash
# Clone & install
git clone https://github.com/sdtalley/TalleyCalendar.git
cd TalleyCalendar
npm install

# Set up environment
cp .env.example .env.local
# Fill in API keys

# Development
npm run dev          # starts Next.js on localhost:3000

# Deploy
git add . && git commit -m "description"
git push origin main  # Vercel auto-deploys
```

### Working with Claude Code

This project is designed to be iterated on with Claude Code. Key conventions:

- All calendar integration logic lives in `src/lib/calendar/` — modify providers here
- UI components are in `src/components/calendar/` — modify views and interactions here
- API routes are in `src/app/api/` — modify backend endpoints here
- When adding a new feature, update this spec file's feature checklist
- Keep the `.env.example` in sync when adding new environment variables

---

## Data Flow

```
Settings UI                          Calendar UI
    │                                     │
    ▼                                     ▼
/api/accounts (CRUD)              /api/calendars (GET)
/api/family (CRUD)                      │
    │                                     ▼
    ▼                              For each ConnectedAccount in Redis:
Redis                               ├─ google.ts → Google Calendar API
  account:{id}                      ├─ outlook.ts → Microsoft Graph API
  accounts:byMember:{id}            └─ apple.ts → CalDAV (iCloud)
  family:members                          │
  settings                                ▼
                                   Normalize → CalendarEvent[]
                                          │
                                          ▼
                                   Return to UI → render on calendar
```

---

## Open Questions / Decisions

- [x] **Auth model**: ~~Single-family app vs. multi-user with login?~~ → **Multi-account, single-family app.** Simple username/password login protects the deployment. Each family member connects their own calendar accounts via the Settings UI.
- [x] **Family member management UI**: ~~Settings page vs. config file vs. KV editor?~~ → **Settings page** with full CRUD for family members and calendar accounts.
- [x] **Apple single-user limitation**: ~~One Apple account in .env~~ → **Per-user Apple credentials stored in Redis**, each family member connects their own.
- [x] **Microsoft work accounts**: ~~Personal accounts only~~ → **Multitenant + personal** Azure app registration, supports both work (Entra ID) and personal accounts.
- [x] **Settings access control**: ~~Should Settings require a PIN?~~ → **Yes**, optional numeric PIN gate implemented for kiosk mode.
- [x] **Event write-back**: When creating an event, which calendar does it write to? → **`defaultWriteCalendarId` per `ConnectedAccount`**, configurable in account settings UI as a dropdown of that account's enabled calendars; falls back to `"primary"`. No prompt at event creation time — keeps the flow simple.
- [x] **UI layout**: Is the left sidebar worth the real estate? → **No.** Left sidebar retired. Family member toggles move to TopBar avatar chips; calendar type filters behind a TopBar dropdown. Left space becomes a resizable/collapsible **Lists panel** (Meals / Shopping / To-Do). Right sidebar stays as Hours/Agenda.
- [x] **Dinner / Meals**: CalendarType or own data model? → **Own model.** `meal:{YYYY-MM-DD}` JSON in Redis, separate from the event system. Rendered as a pinned no-time amber pill at the bottom of day cells. Not a CalendarType.
- [ ] **Sync frequency**: 5 minutes default — is this fast enough? Could use webhooks for Google/Outlook for near-real-time.
- [ ] **Offline handling**: Should the app cache events locally (service worker) so it still shows data if internet drops?

---

## Reference Links

- [Google Calendar API](https://developers.google.com/calendar/api/v3/reference)
- [Apple CalDAV](https://developer.apple.com/library/archive/documentation/DataManagement/Conceptual/CloudKitWebServicesReference/)
- [Microsoft Graph Calendar](https://learn.microsoft.com/en-us/graph/api/resources/calendar)
- [tsdav (CalDAV client)](https://github.com/natelindev/tsdav)
- [Open-Meteo Weather API](https://open-meteo.com/en/docs)
- [Upstash Redis](https://upstash.com/docs/redis/overall/getstarted)
- [Fully Kiosk Browser](https://www.fully-kiosk.com/)
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- [Tailscale](https://tailscale.com/)
