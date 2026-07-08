# Hong Kong & Nearby Tech Events

A simple web app that scrapes tech, startup, hackathon, buildathon and robotics
events across Hong Kong and nearby hubs (Taipei), ranked with the biggest and
most relevant ones on top.

**Live app:** https://hk-event-scraper.vercel.app

## Sources

- **Luma** discover pages — Hong Kong and Taipei (the nearby cities Luma actually
  covers; Shenzhen/Guangzhou/Macau have no Luma discover page).
- **Devpost** — hackathons across robotics, hardware, AI, blockchain and fintech,
  including big online ones (500+ signups) that HK builders realistically join.

No API keys required.

## Ranking

Events are scored by attendee/registration count plus keyword and host boosts
(hackathon, summit, robotics, AI House, etc.), with a home boost so Hong Kong
events stay near the top. Only upcoming events are shown — the page re-fetches
live on every open, so nothing is stale.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy

Deployed on Vercel. `main` is the source of truth; deploys are triggered with:

```bash
vercel --prod
```

## Tweaking

Everything lives in `lib/events.ts`:

- `LUMA_PLACES` — add/remove cities (needs the Luma `discplace-...` id).
- `DEVPOST_TERMS` — hackathon search topics.
- `PRESTIGE` / `rank()` — ranking keywords and scoring.
