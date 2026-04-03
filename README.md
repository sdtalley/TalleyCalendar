# FamilyHub Calendar

A self-hosted family calendar web application that aggregates Google Calendar, Apple iCloud, and Microsoft Outlook into a single touch-friendly interface. Designed for a wall-mounted kitchen display but accessible from any device.

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** — dark theme, DM Sans + JetBrains Mono fonts
- **Upstash Redis** — OAuth token storage, event cache, user config
- **Vercel** — hosting + auto-deploy from GitHub

## Quick Start

```bash
# Install dependencies
npm install

# Copy env template and fill in secrets
cp .env.example .env.local

# Run dev server
npm run dev
# → http://localhost:3000
```

## Project Status

See [NEXT-STEPS.md](NEXT-STEPS.md) for the current state and what to work on next.

See [FAMILYHUB-PROJECT.md](FAMILYHUB-PROJECT.md) for the full product specification.

## Deploy

```bash
git add -A && git commit -m "your message"
git push origin main   # Vercel auto-deploys
```
