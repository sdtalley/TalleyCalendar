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
- [ ] Google Calendar OAuth integration (read + write)
- [ ] Apple iCloud CalDAV integration (read + write)
- [ ] Outlook / Microsoft Graph integration (read + write)
- [ ] Persistent storage (Upstash Redis for tokens & config)
- [ ] Auto-refresh / polling for calendar updates (configurable interval)
- [x] PWA manifest (installable on phones, add-to-homescreen)

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

## Calendar Integration Details

### Google Calendar

- **Auth**: OAuth 2.0 via Google Cloud Console (free tier)
- **Setup required**: Create a Google Cloud project, enable Calendar API, create OAuth credentials
- **Scopes**: `https://www.googleapis.com/auth/calendar.readonly` (read), `https://www.googleapis.com/auth/calendar.events` (write)
- **Endpoints**: `GET /calendars/{id}/events`, `POST /calendars/{id}/events`
- **Refresh**: OAuth refresh tokens stored in Vercel KV

### Apple iCloud Calendar

- **Auth**: App-specific password (generated at appleid.apple.com)
- **Protocol**: CalDAV (WebDAV extension)
- **Server**: `https://caldav.icloud.com`
- **Library**: `tsdav` (TypeScript CalDAV client) or raw HTTP
- **Notes**: No OAuth — uses basic auth with app-specific password. Simpler but requires manual password rotation if revoked.

### Microsoft Outlook

- **Auth**: OAuth 2.0 via Azure AD app registration (free)
- **Setup required**: Register app in Azure Portal, configure redirect URIs
- **Scopes**: `Calendars.ReadWrite`
- **Endpoints**: Microsoft Graph API `/me/calendar/events`
- **Library**: `@azure/msal-node` for auth, raw fetch for Graph API

---

## Project Structure

```
familyhub/
├── README.md
├── FAMILYHUB-PROJECT.md          ← this file
├── package.json
├── next.config.js
├── tailwind.config.js
├── .env.local                    ← secrets (never committed)
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
│   │   │   │   │   ├── route.ts        ← Google OAuth callback
│   │   │   │   │   └── connect/route.ts ← initiate Google OAuth
│   │   │   │   ├── outlook/
│   │   │   │   │   ├── route.ts
│   │   │   │   │   └── connect/route.ts
│   │   │   │   └── apple/
│   │   │   │       └── route.ts        ← save CalDAV credentials
│   │   │   ├── calendars/
│   │   │   │   ├── route.ts            ← GET all events (aggregated)
│   │   │   │   ├── google/route.ts     ← fetch Google events
│   │   │   │   ├── apple/route.ts      ← fetch iCloud events
│   │   │   │   └── outlook/route.ts    ← fetch Outlook events
│   │   │   └── events/
│   │   │       └── route.ts            ← POST create event
│   │   └── settings/
│   │       └── page.tsx                ← family members, calendar config
│   ├── components/
│   │   ├── calendar/
│   │   │   ├── MonthView.tsx
│   │   │   ├── WeekView.tsx
│   │   │   ├── DayView.tsx
│   │   │   ├── AgendaSidebar.tsx
│   │   │   ├── EventCard.tsx
│   │   │   ├── EventModal.tsx          ← quick-add / edit
│   │   │   └── MiniCalendar.tsx
│   │   ├── layout/
│   │   │   ├── TopBar.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Clock.tsx
│   │   └── ui/                         ← shared UI primitives
│   ├── lib/
│   │   ├── calendar/
│   │   │   ├── google.ts               ← Google Calendar API client
│   │   │   ├── apple.ts                ← CalDAV client for iCloud
│   │   │   ├── outlook.ts              ← Microsoft Graph client
│   │   │   └── types.ts               ← unified CalendarEvent type
│   │   ├── store.ts                    ← Vercel KV helpers
│   │   └── utils.ts                    ← date helpers, formatters
│   ├── hooks/
│   │   ├── useCalendarEvents.ts        ← data fetching + caching
│   │   ├── useCalendarNavigation.ts    ← view state, date navigation
│   │   └── useEventFilters.ts          ← family/type toggle state
│   └── styles/
│       └── globals.css
└── docs/
    ├── SETUP.md                        ← step-by-step setup guide
    ├── HARDWARE.md                     ← display/Pi setup guide
    ├── GOOGLE-SETUP.md                 ← Google Cloud project walkthrough
    ├── APPLE-SETUP.md                  ← iCloud app-specific password guide
    └── OUTLOOK-SETUP.md                ← Azure app registration guide
```

---

## Environment Variables

```bash
# .env.example

# Google Calendar
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://your-app.vercel.app/api/auth/google

# Microsoft Outlook
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_TENANT_ID=common
AZURE_REDIRECT_URI=https://your-app.vercel.app/api/auth/outlook

# Apple iCloud (stored per-user, but defaults can go here)
APPLE_CALDAV_USERNAME=
APPLE_CALDAV_APP_PASSWORD=

# Upstash Redis (create free DB at upstash.com, copy REST URL + token)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# App
NEXTAUTH_SECRET=
NEXTAUTH_URL=https://your-app.vercel.app
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# Display settings
NEXT_PUBLIC_REFRESH_INTERVAL=300000   # poll interval in ms (5 min default)
NEXT_PUBLIC_DIM_START=22:00           # screen dim start time
NEXT_PUBLIC_DIM_END=06:00             # screen dim end time
```

---

## Configuration Model

Family members and their calendar mappings are stored in Vercel KV:

```json
{
  "family": [
    {
      "id": "you",
      "name": "Dad",
      "color": "#6c8cff",
      "calendars": [
        { "provider": "google", "calendarId": "primary", "type": "personal" },
        { "provider": "outlook", "calendarId": "AAA...", "type": "work" }
      ]
    },
    {
      "id": "partner",
      "name": "Mom",
      "color": "#ff6b8a",
      "calendars": [
        { "provider": "apple", "calendarId": "personal", "type": "personal" },
        { "provider": "outlook", "calendarId": "BBB...", "type": "work" }
      ]
    },
    {
      "id": "kid1",
      "name": "Alex",
      "color": "#4ecdc4",
      "calendars": [
        { "provider": "google", "calendarId": "family-shared-id", "type": "kids" }
      ]
    }
  ],
  "calendarTypes": ["personal", "work", "kids", "shared"],
  "settings": {
    "refreshInterval": 300000,
    "defaultView": "month",
    "dimSchedule": { "start": "22:00", "end": "06:00" }
  }
}
```

---

## Unified Event Type

All calendar sources normalize to this shape:

```typescript
interface CalendarEvent {
  id: string;
  externalId: string;           // original ID from provider
  provider: 'google' | 'apple' | 'outlook';
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  allDay: boolean;
  recurring: boolean;
  recurrenceRule?: string;       // RRULE string
  familyMemberId: string;        // maps to family[].id
  calendarType: string;          // personal | work | kids | shared
  color: string;                 // inherited from family member
  source: {
    calendarId: string;
    calendarName: string;
    provider: string;
  };
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

- [ ] **Auth model**: Single-family app (one set of credentials) vs. multi-user with login? Leaning single-family since this is a private deployment.
- [ ] **Event write-back**: When creating an event on the display, which calendar should it write to by default? Probably configurable per family member.
- [ ] **Sync frequency**: 5 minutes default — is this fast enough? Could use webhooks for Google/Outlook for near-real-time.
- [ ] **Offline handling**: Should the app cache events locally (service worker) so it still shows data if internet drops?
- [ ] **Family member management UI**: Settings page vs. config file vs. KV editor?

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
