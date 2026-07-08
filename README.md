<img src="app/icon.svg" width="72" alt="logo" />

# Hong Kong & Nearby Tech Events

Ready to use: **[hk-event-scraper.vercel.app](https://hk-event-scraper.vercel.app)**

Finds tech, startup, hackathon and robotics events in Hong Kong and nearby Taipei,
with the biggest and most relevant ones at the top. Live data, no setup, no API keys.

## Where the events come from

- **Luma** for Hong Kong and Taipei local events.
- **Devpost** for hackathons in robotics, hardware, AI, blockchain and fintech,
  including large online ones that Hong Kong builders can join.

The page re-fetches every time you open it, so events are always current and past
ones never show.

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Change what it shows

Everything lives in `lib/events.ts`:

- `LUMA_PLACES` for which cities to include.
- `DEVPOST_TERMS` for hackathon topics.
- `rank()` for how events are scored and ordered.
