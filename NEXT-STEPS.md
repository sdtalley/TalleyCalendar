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

## Immediate Next Steps (do in order)

### 1. Connect Vercel to GitHub
- Go to **vercel.com** → sign in with GitHub
- **Add New → Project → Import** `sdtalley/TalleyCalendar`
- Vercel auto-detects Next.js — click **Deploy**
- Note your live URL (e.g. `talleycalendar.vercel.app`)

### 2. Provision Upstash Redis
- Go to **upstash.com** → create a free Redis database (free tier: 10k req/day)
- In Upstash dashboard → **REST API** tab → copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- In Vercel project → **Settings → Environment Variables** → add both vars
- Also add them to your local `.env.local` for dev

### 3. Set up Google Calendar OAuth
1. Go to **console.cloud.google.com** → New Project → name it "FamilyHub"
2. **APIs & Services → Enable APIs** → enable "Google Calendar API"
3. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: Web application
   - Authorized redirect URIs: `https://your-app.vercel.app/api/auth/google` AND `http://localhost:3000/api/auth/google`
4. Copy Client ID and Client Secret into `.env.local`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=https://your-app.vercel.app/api/auth/google
   ```
5. Also add them to Vercel Environment Variables
6. Then ask Claude Code to **implement the Google Calendar OAuth flow** — the API routes are stubbed at `src/app/api/auth/google/`

### 4. Set up Apple iCloud CalDAV
1. Go to **appleid.apple.com** → Sign-In & Security → App-Specific Passwords → Generate
2. Label it "FamilyHub"
3. Add to `.env.local`:
   ```
   APPLE_CALDAV_USERNAME=your@icloud.com
   APPLE_CALDAV_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
   ```
4. Ask Claude Code to **implement the Apple CalDAV integration** using the `tsdav` package

### 5. Set up Microsoft Outlook OAuth
1. Go to **portal.azure.com** → Azure Active Directory → App Registrations → New Registration
   - Name: FamilyHub
   - Supported account types: Personal Microsoft accounts only (or multitenant if needed)
   - Redirect URI: `https://your-app.vercel.app/api/auth/outlook`
2. After creating: note the Application (client) ID
3. **Certificates & Secrets → New client secret** → copy the value immediately
4. Add to `.env.local`:
   ```
   AZURE_CLIENT_ID=...
   AZURE_CLIENT_SECRET=...
   AZURE_TENANT_ID=common
   AZURE_REDIRECT_URI=https://your-app.vercel.app/api/auth/outlook
   ```
5. Ask Claude Code to **implement the Outlook OAuth + Microsoft Graph integration**

---

## Phase 2 Backlog (after integrations work)

- [ ] Multi-day / all-day event rendering
- [ ] Event detail view / edit modal (currently clicking an event does nothing)
- [ ] Auto-refresh polling (configurable, default 5 min)
- [ ] PWA icons — need `public/icons/icon-192.png` and `public/icons/icon-512.png`
- [ ] Settings page (`src/app/settings/page.tsx`) — family member management UI
- [ ] Screen dimming schedule (dim at night, bright in morning)
- [ ] Weather widget

## Phase 3 Backlog

- [ ] Home Assistant integration
- [ ] Migration path to on-prem Pi + Cloudflare Tunnel

---

## Architecture Notes

```
src/
  app/
    page.tsx              ← main page — all state lives here
    layout.tsx
    globals.css           ← design system (CSS vars + Tailwind)
    api/                  ← serverless functions (stubs, not yet implemented)
  components/
    layout/               ← TopBar, Sidebar, Clock
    calendar/             ← MonthView, WeekView, DayView, AgendaSidebar, EventModal
  hooks/
    useCalendarNavigation ← view state + date navigation
    useEventFilters       ← family/type toggles, visible event filtering
  lib/
    calendar/types.ts     ← CalendarEvent, FamilyMember, etc.
    utils.ts              ← date helpers
    sampleData.ts         ← sample events (replace with real API calls)
```

When wiring real calendar data, the pattern is:
1. Add API route in `src/app/api/calendars/{provider}/route.ts`
2. Fetch + normalize events to `CalendarEvent` shape (see `src/lib/calendar/types.ts`)
3. Replace `generateSampleEvents()` call in `src/app/page.tsx` with a `useCalendarEvents` hook that calls the API

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
