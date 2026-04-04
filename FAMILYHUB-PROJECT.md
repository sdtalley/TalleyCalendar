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
│  │   React App)  │    │  /api/google-calendar   │  │
│  │               │    │  /api/apple-calendar    │  │
│  │  Month View   │    │  /api/outlook-calendar  │  │
│  │  Week View    │    │  /api/events (CRUD)     │  │
│  │  Day View     │    │  /api/auth/*            │  │
│  │  Agenda       │    │                        │  │
│  └──────────────┘    └────────────────────────┘  │
│                              │                    │
│                     ┌────────┴────────┐           │
│                     │  Upstash Redis  │           │
│                     │  (free tier)    │           │
│                     │  - OAuth tokens │           │
│                     │  - User config  │           │
│                     │  - Cached events│           │
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

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | **Next.js 14+ (App Router)** | Vercel-native, SSR for fast loads, API routes built-in |
| UI | **React + Tailwind CSS** | Rapid iteration, responsive, dark theme |
| Calendar Lib | **Custom grid components** | Full control over touch interactions and display density |
| Google Integration | **Google Calendar API v3** | OAuth 2.0, full CRUD |
| Apple Integration | **CalDAV (via `tsdav` or raw)** | App-specific password auth, read/write |
| Outlook Integration | **Microsoft Graph API** | OAuth 2.0 via MSAL, full CRUD |
| Data Store | **Upstash Redis** (`@upstash/redis`) | Token storage, event cache, user preferences — Vercel KV deprecated in 2024 |
| Auth | **NextAuth.js** | Multi-provider OAuth, session management |
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

### Phase 1 — Core Calendar (MVP)

- [x] Month view with event indicators
- [x] Week view with time blocks
- [x] Day view with timeline
- [x] Agenda sidebar (selected day + upcoming)
- [x] Per-family-member color coding and toggle
- [x] Per-calendar-type filtering (Personal / Work / Kids / Shared)
- [x] Quick-add event modal (touch-friendly)
- [x] Live clock display
- [x] Keyboard shortcuts (arrow keys, T for today, N for new event)
- [x] Dark theme optimized for always-on display
- [x] PWA manifest (installable on phones, add-to-homescreen)
- [ ] Upstash Redis integration (store family members, accounts, settings)
- [ ] Settings page — family member management (add/edit/remove, pick color)
- [ ] Settings page — "Add Calendar Account" flow (pick provider + member)
- [ ] Google Calendar OAuth flow (connect → discover calendars → pick which to show)
- [ ] Microsoft Outlook OAuth flow (multitenant: personal + work/Entra accounts)
- [ ] Apple iCloud CalDAV flow (enter creds in UI → test connection → discover calendars)
- [ ] Account management (status indicators, toggle, reconnect, remove)
- [ ] Aggregated event fetching (all connected accounts → unified CalendarEvent list)
- [ ] Auto-refresh / polling for calendar updates (configurable via Settings)

### Phase 2 — Polish & Usability

- [ ] Multi-day / all-day event rendering
- [ ] Event detail view / edit modal
- [ ] Drag-to-create events (touch + mouse)
- [ ] Drag-to-reschedule events
- [ ] Recurring event display
- [ ] Search / filter events
- [ ] Mini calendar in sidebar for quick navigation
- [ ] Screen dimming schedule (dim at night, bright in morning)
- [ ] Weather widget in header or sidebar
- [ ] Today's meal plan or notes section

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
- [ ] Shared family to-do list / grocery list
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
```

```typescript
interface ConnectedAccount {
  id: string                          // uuid
  provider: 'google' | 'outlook' | 'apple'
  familyMemberId: string              // which family member owns this
  label: string                       // display name, e.g. "Dad's Work Gmail"
  email: string                       // the account email (for display)
  calendarType: CalendarType          // personal | work | kids | shared

  // Provider-specific auth (encrypted at rest in Redis)
  auth:
    | { type: 'oauth'; accessToken: string; refreshToken: string; expiresAt: number }
    | { type: 'caldav'; username: string; appPassword: string }

  // Which calendars from this account are enabled
  enabledCalendars: {
    calendarId: string                // e.g. "primary", "family@group.calendar.google.com"
    name: string                      // display name from provider
    enabled: boolean
  }[]

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

### Provider Details

#### Google Calendar
- **App setup** (one-time, by you): Google Cloud Console → project → enable Calendar API → OAuth 2.0 credentials
- **Auth flow**: OAuth 2.0 with refresh tokens. State param encodes `memberId` so callback knows who to associate
- **Scopes**: `calendar.readonly` (read), `calendar.events` (write)
- **Endpoints**: Google Calendar API v3 — `GET /users/me/calendarList` (discover calendars), `GET /calendars/{id}/events` (fetch events)
- **Token refresh**: Automatic — refresh token stored in Redis, access token refreshed server-side when expired
- **Gotcha**: App starts in "Testing" mode (100 users max). Fine for family use. Google verification needed only if you want to open it to others.

#### Microsoft Outlook (personal + work accounts)
- **App setup** (one-time, by you): Azure Portal → App Registration
  - **Supported account types: "Accounts in any organizational directory AND personal Microsoft accounts"** (multitenant + personal)
  - This allows both personal Outlook.com accounts AND work/school Entra ID accounts
- **Auth flow**: OAuth 2.0 via MSAL. State param encodes `memberId`
- **Scopes**: `Calendars.ReadWrite`, `User.Read`
- **Endpoints**: Microsoft Graph API — `GET /me/calendars` (discover), `GET /me/calendars/{id}/events` (fetch)
- **Work account gotcha**: Some organizations require admin consent for third-party apps. If your Entra tenant blocks it, you (as admin) can grant consent in Azure Portal → Enterprise Applications → your app → Permissions → "Grant admin consent"
- **Tenant ID**: Use `common` to support all account types

#### Apple iCloud Calendar
- **Auth**: No OAuth available. Each user generates an **app-specific password** at appleid.apple.com
- **Protocol**: CalDAV (WebDAV extension) via `tsdav` library
- **Server**: `https://caldav.icloud.com`
- **Flow**: User enters iCloud email + app-specific password in Settings UI → app tests connection server-side → on success, discovers calendars via CalDAV PROPFIND → saves credentials to Redis
- **Multiple users**: Each family member can add their own Apple account (credentials stored per-account in Redis, not in `.env`)
- **Gotcha**: Credentials can't be validated until we try to connect. The UI must test on save and show clear success/failure. If Apple revokes the app-specific password, the account status changes to `reauth_needed`

---

## Project Structure

```
familyhub/
├── README.md
├── FAMILYHUB-PROJECT.md          ← this file
├── package.json
├── next.config.js
├── tailwind.config.js
├── .env.local                    ← app-level secrets only (never committed)
├── .env.example                  ← template for required env vars
├── public/
│   ├── manifest.json             ← PWA manifest
│   └── icons/                    ← PWA icons
├── src/
│   ├── app/
│   │   ├── layout.tsx            ← root layout, global styles
│   │   ├── page.tsx              ← main calendar page
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── google/
│   │   │   │   │   ├── route.ts         ← Google OAuth callback (saves tokens to Redis)
│   │   │   │   │   └── connect/route.ts ← initiate Google OAuth (encodes memberId in state)
│   │   │   │   ├── outlook/
│   │   │   │   │   ├── route.ts         ← Outlook OAuth callback
│   │   │   │   │   └── connect/route.ts ← initiate Outlook OAuth
│   │   │   │   └── apple/
│   │   │   │       └── test/route.ts    ← POST: test CalDAV creds + discover calendars
│   │   │   ├── accounts/
│   │   │   │   ├── route.ts             ← GET all accounts, POST create, DELETE remove
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts         ← PATCH update account (toggle calendars, relabel)
│   │   │   │       └── calendars/route.ts ← GET discover calendars for this account
│   │   │   ├── family/
│   │   │   │   └── route.ts             ← CRUD family members
│   │   │   ├── calendars/
│   │   │   │   └── route.ts             ← GET all events (aggregated across all accounts)
│   │   │   ├── events/
│   │   │   │   └── route.ts             ← POST create event (writes to provider)
│   │   │   └── settings/
│   │   │       └── route.ts             ← GET/PUT app settings
│   │   └── settings/
│   │       └── page.tsx                 ← Settings UI: family members + calendar accounts
│   ├── components/
│   │   ├── calendar/
│   │   │   ├── MonthView.tsx
│   │   │   ├── WeekView.tsx
│   │   │   ├── DayView.tsx
│   │   │   ├── AgendaSidebar.tsx
│   │   │   ├── EventCard.tsx
│   │   │   ├── EventModal.tsx           ← quick-add / edit
│   │   │   └── MiniCalendar.tsx
│   │   ├── settings/
│   │   │   ├── FamilyMemberList.tsx     ← manage family members (add/edit/remove)
│   │   │   ├── AccountList.tsx          ← list connected accounts per member
│   │   │   ├── AddAccountFlow.tsx       ← provider picker + OAuth redirect / Apple form
│   │   │   └── CalendarPicker.tsx       ← toggle which calendars from an account to show
│   │   ├── layout/
│   │   │   ├── TopBar.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Clock.tsx
│   │   └── ui/                          ← shared UI primitives
│   ├── lib/
│   │   ├── calendar/
│   │   │   ├── google.ts                ← Google Calendar API client
│   │   │   ├── apple.ts                 ← CalDAV client for iCloud
│   │   │   ├── outlook.ts              ← Microsoft Graph client
│   │   │   └── types.ts                ← CalendarEvent, ConnectedAccount, FamilyMember
│   │   ├── redis.ts                     ← Upstash Redis client + typed helpers
│   │   └── utils.ts                     ← date helpers, formatters
│   ├── hooks/
│   │   ├── useCalendarEvents.ts         ← fetches aggregated events from /api/calendars
│   │   ├── useCalendarNavigation.ts     ← view state, date navigation
│   │   └── useEventFilters.ts           ← family/type toggle state
│   └── styles/
│       └── globals.css
└── docs/
    ├── SETUP.md                         ← step-by-step setup guide
    ├── HARDWARE.md                      ← display/Pi setup guide
    ├── GOOGLE-SETUP.md                  ← Google Cloud project walkthrough
    ├── APPLE-SETUP.md                   ← iCloud app-specific password guide
    └── OUTLOOK-SETUP.md                 ← Azure app registration guide
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
NEXTAUTH_SECRET=              # used to encrypt session cookies
NEXT_PUBLIC_APP_URL=http://localhost:3000  # base URL (set to Vercel URL in prod)
```

**What moved out of `.env`:**
- `APPLE_CALDAV_USERNAME` / `APPLE_CALDAV_APP_PASSWORD` → stored per-account in Redis
- `GOOGLE_REDIRECT_URI` / `AZURE_REDIRECT_URI` → computed from `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_REFRESH_INTERVAL`, `NEXT_PUBLIC_DIM_START/END` → stored in Redis settings, managed via UI
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
  "dimSchedule": { "start": "22:00", "end": "06:00" }
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
```

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
git clone https://github.com/your-username/familyhub.git
cd familyhub
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

## Open Questions / Decisions

- [x] **Auth model**: ~~Single-family app vs. multi-user with login?~~ → **Multi-account, single-family app.** No login required (private deployment), but each family member connects their own calendar accounts via the Settings UI.
- [x] **Family member management UI**: ~~Settings page vs. config file vs. KV editor?~~ → **Settings page** with full CRUD for family members and calendar accounts.
- [x] **Apple single-user limitation**: ~~One Apple account in .env~~ → **Per-user Apple credentials stored in Redis**, each family member connects their own.
- [x] **Microsoft work accounts**: ~~Personal accounts only~~ → **Multitenant + personal** Azure app registration, supports both work (Entra ID) and personal accounts.
- [ ] **Event write-back**: When creating an event on the display, which calendar should it write to by default? Probably configurable per family member (default write-back calendar in Settings).
- [ ] **Sync frequency**: 5 minutes default — is this fast enough? Could use webhooks for Google/Outlook for near-real-time.
- [ ] **Offline handling**: Should the app cache events locally (service worker) so it still shows data if internet drops?
- [ ] **Settings access control**: Should the Settings page require a PIN to prevent kids from accidentally disconnecting accounts?

---

## Reference Links

- [Google Calendar API](https://developers.google.com/calendar/api/v3/reference)
- [Apple CalDAV](https://developer.apple.com/library/archive/documentation/DataManagement/Conceptual/CloudKitWebServicesReference/)
- [Microsoft Graph Calendar](https://learn.microsoft.com/en-us/graph/api/resources/calendar)
- [tsdav (CalDAV client)](https://github.com/natelindev/tsdav)
- [NextAuth.js](https://next-auth.js.org/)
- [Upstash Redis](https://upstash.com/docs/redis/overall/getstarted) — replaces deprecated Vercel KV
- [Fully Kiosk Browser](https://www.fully-kiosk.com/)
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- [Tailscale](https://tailscale.com/)
