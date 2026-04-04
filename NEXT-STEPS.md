# FamilyHub — Next Steps

Last updated: 2026-04-03

---

## Current State

The Phase 1 UI scaffold is **complete and running**. The app renders with sample data:
- Month / Week / Day views
- Agenda sidebar (selected day + next 6 days)
- Family member toggles + calendar-type filters
- Add Event modal (saves to local state)
- Live clock, keyboard shortcuts (←/→ navigate, T=today, N=new event, m/w/d=switch view)
- Dark theme matching the prototype in `family-calendar.html`

No real calendar data yet — all events are randomly seeded sample data from `src/lib/sampleData.ts`.

---

## Completed Steps

- [x] **1. Upstash Redis** — Free Redis DB provisioned at upstash.com. Credentials in `.env.local`.
- [x] **2. Google Cloud project** — OAuth 2.0 client created, Calendar API enabled, credentials in `.env.local`.

---

## Next Steps (do in order)

### 3. Connect Vercel to GitHub
- Go to **vercel.com** → sign in with GitHub
- **Add New → Project → Import** `sdtalley/TalleyCalendar`
- Vercel auto-detects Next.js — click **Deploy**
- Note your live URL (e.g. `talleycalendar.vercel.app`)
- Add environment variables in Vercel Settings (same as `.env.local`, minus Apple/display vars)

### 4. Set up Azure App Registration (for Outlook)
1. Go to **portal.azure.com** → Entra ID → App Registrations → New Registration
   - Name: FamilyHub
   - **Supported account types: "Accounts in any organizational directory AND personal Microsoft accounts"** (this enables both work/school Entra accounts AND personal Outlook.com)
   - Redirect URI (Web): `http://localhost:3000/api/auth/outlook` AND `https://your-app.vercel.app/api/auth/outlook`
2. After creating: note the **Application (client) ID**
3. **Certificates & Secrets → New client secret** → copy the value immediately
4. Add to `.env.local`:
   ```
   AZURE_CLIENT_ID=...
   AZURE_CLIENT_SECRET=...
   AZURE_TENANT_ID=common
   ```
5. Also add to Vercel Environment Variables
6. **If using your work account**: In Azure Portal → Enterprise Applications → find your app → Permissions → "Grant admin consent for [your org]". This is only needed if your org blocks third-party app consent by default.

### 5. Build the Redis layer + Settings backend
Ask Claude Code to:
- **Implement `src/lib/redis.ts`** — Upstash Redis client with typed helpers for family members, connected accounts, and app settings
- **Implement API routes**: `/api/family`, `/api/accounts`, `/api/settings`
- This is the foundation everything else builds on

### 6. Build the Settings UI
Ask Claude Code to:
- **Implement `src/app/settings/page.tsx`** with two sections:
  1. **Family Members** — add/edit/remove members (name + color picker)
  2. **Calendar Accounts** — list connected accounts per member, with status, toggle, and remove
- **Implement "Add Calendar Account" flow** (`src/components/settings/AddAccountFlow.tsx`):
  - Step 1: Pick a family member
  - Step 2: Pick a provider (Google / Microsoft / Apple)
  - Step 3a (Google/Microsoft): Redirect to OAuth consent screen
  - Step 3b (Apple): Inline form for iCloud email + app-specific password
  - Step 4: After connection, show discovered calendars → user picks which to enable
- Add a **Settings gear icon** to the TopBar that links to `/settings`

### 7. Implement Google Calendar OAuth flow
Ask Claude Code to:
- **Implement `/api/auth/google/connect`** — builds the Google OAuth URL with `state` param encoding `memberId` + `calendarType`, redirects user to Google consent
- **Implement `/api/auth/google` (callback)** — exchanges auth code for tokens, saves `ConnectedAccount` to Redis, fetches calendar list, redirects back to Settings
- **Implement `src/lib/calendar/google.ts`** — fetch events for a given account, handle token refresh

### 8. Implement Microsoft Outlook OAuth flow
Ask Claude Code to:
- **Implement `/api/auth/outlook/connect`** — builds the Microsoft OAuth URL (using `tenant=common` for multitenant support), state param encodes `memberId`
- **Implement `/api/auth/outlook` (callback)** — exchanges code for tokens via MSAL, saves account to Redis, fetches calendar list
- **Implement `src/lib/calendar/outlook.ts`** — fetch events via Microsoft Graph API, handle token refresh

### 9. Implement Apple iCloud CalDAV
Ask Claude Code to:
- **Implement `/api/auth/apple/test`** — POST endpoint that takes email + app-specific password, tests CalDAV connection, returns discovered calendars (or error)
- **Implement `src/lib/calendar/apple.ts`** — CalDAV client using `tsdav`, fetch events for a given account
- Wire into the AddAccountFlow so Apple accounts go through the inline form → test → calendar picker

### 10. Wire up aggregated event fetching
Ask Claude Code to:
- **Implement `/api/calendars`** — loops through all `ConnectedAccount`s in Redis, fetches events from each provider, normalizes to `CalendarEvent[]`, returns unified list
- **Implement `useCalendarEvents` hook** — calls `/api/calendars` on mount + on interval, replaces `generateSampleEvents()` in `page.tsx`
- **Update Sidebar** to pull family members from Redis instead of hardcoded sample data

### 11. Test each provider end-to-end
- Connect a Google account from Settings → verify events appear on calendar
- Connect a Microsoft account (personal) → verify events appear
- Connect a Microsoft work account (Entra) → verify events appear (may need admin consent)
- Connect an Apple iCloud account → verify events appear
- Connect multiple accounts for the same family member → verify all show up
- Toggle accounts/calendars on and off → verify filtering works

---

## Phase 2 Backlog (after integrations work)

- [x] Multi-day / all-day event rendering
- [x] Event detail view / edit modal
- [x] Auto-refresh polling (5-min interval in useCalendarEvents hook)
- [ ] PWA icons — need `public/icons/icon-192.png` and `public/icons/icon-512.png`
- [ ] Screen dimming schedule (dim at night, bright in morning — configurable in Settings)
- [ ] Weather widget
- [ ] Settings PIN protection (prevent accidental disconnects on kiosk)

## Phase 3 Backlog

- [ ] Home Assistant integration
- [ ] Migration path to on-prem Pi + Cloudflare Tunnel

---

## Architecture Notes

```
src/
  app/
    page.tsx              ← main calendar — fetches events from /api/calendars
    settings/page.tsx     ← Settings UI — family members + calendar accounts
    layout.tsx
    globals.css           ← design system (CSS vars + Tailwind)
    api/
      auth/               ← OAuth flows (Google, Outlook) + Apple CalDAV test
      accounts/           ← CRUD for ConnectedAccount objects in Redis
      family/             ← CRUD for FamilyMember objects in Redis
      calendars/          ← GET aggregated events from all connected accounts
      events/             ← POST create event (writes to provider)
      settings/           ← GET/PUT app settings in Redis
  components/
    layout/               ← TopBar, Sidebar, Clock
    calendar/             ← MonthView, WeekView, DayView, AgendaSidebar, EventModal
    settings/             ← FamilyMemberList, AccountList, AddAccountFlow, CalendarPicker
  hooks/
    useCalendarEvents     ← fetches + polls /api/calendars
    useCalendarNavigation ← view state + date navigation
    useEventFilters       ← family/type toggles, visible event filtering
  lib/
    calendar/types.ts     ← CalendarEvent, ConnectedAccount, FamilyMember
    calendar/google.ts    ← Google Calendar API client
    calendar/outlook.ts   ← Microsoft Graph API client
    calendar/apple.ts     ← CalDAV client (tsdav)
    redis.ts              ← Upstash Redis client + typed helpers
    utils.ts              ← date helpers
```

### Data flow

```
Settings UI                          Calendar UI
    │                                     │
    ▼                                     ▼
/api/accounts (CRUD)              /api/calendars (GET)
    │                                     │
    ▼                                     ▼
Redis                              For each ConnectedAccount in Redis:
  account:{id}                       ├─ google.ts → Google Calendar API
  accounts:byMember:{id}            ├─ outlook.ts → Microsoft Graph API
  family:members                     └─ apple.ts → CalDAV (iCloud)
  settings                                │
                                          ▼
                                   Normalize → CalendarEvent[]
                                          │
                                          ▼
                                   Return to UI → render on calendar
```

---

## Kiosk Setup (when ready)

```bash
chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --no-first-run \
  "https://your-app.vercel.app"
```

Or use **Fully Kiosk Browser** on Android (Peloton / tablet).
