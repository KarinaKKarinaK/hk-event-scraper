// Aggregates tech/startup/hackathon events for HK + nearby cities.
// Sources: Luma discover (HK city page) + Devpost hackathons. No API keys.
// ponytail: no DB, no cron. Next ISR (revalidate) refreshes this on a timer.

export type Event = {
  id: string;
  title: string;
  host: string;
  city: string;
  start: string; // ISO
  url: string;
  image: string | null;
  attendees: number | null;
  source: "Luma" | "Devpost";
  score: number;
};

// Luma discover place IDs (resolved from luma.com/<slug> pages).
// Only cities Luma actually has a discover page for. SZ/GZ/Macau aren't on Luma.
const LUMA_PLACES: Record<string, string> = {
  "Hong Kong": "discplace-z9B5Guglh2WINA1",
  Taipei: "discplace-fi7MDZq99wfKWfa",
  Singapore: "discplace-mUbtdfNjfWaLQ72",
};

// Home turf — nudge HK/Shenzhen events above equally-sized regional ones.
const HOME = /hong kong|shenzhen|guangzhou|macau|macao/i;

// Hosts/keywords that signal a big/prestigious event -> ranking boost.
const PRESTIGE = /hackathon|buildathon|summit|flagship|keynote|conference|demo day|founder|startup|ai house|web3|token2049|cyberport|hkstp|consensus|robot|robotics|hardware|deep tech|embodied/i;

const CITY_MATCH = /hong kong|shenzhen|guangzhou|macau|macao|greater bay|china/i;

// Devpost search terms — broad enough to pull tech/AI/robotics/hardware hackathons.
const DEVPOST_TERMS = [
  "hong kong",
  "shenzhen",
  "robotics",
  "hardware",
  "artificial intelligence",
  "blockchain",
  "fintech",
];

async function luma(city: string, placeId: string): Promise<Event[]> {
  const url = `https://api.lu.ma/discover/get-paginated-events?discover_place_api_id=${placeId}&period=future&pagination_limit=200`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 21600 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const entries: any[] = data.entries ?? [];
  return entries.map((en) => {
    const e = en.event ?? {};
    const host = en.hosts?.[0]?.name ?? en.calendar?.name ?? "Unknown host";
    const cityStr = e.geo_address_info?.city_state ?? city;
    return {
      id: e.api_id,
      title: e.name,
      host,
      city: cityStr,
      start: e.start_at,
      url: `https://luma.com/${e.url}`,
      image: e.cover_url ?? null,
      attendees: en.guest_count ?? null,
      source: "Luma" as const,
      score: rank(e.name, host, en.guest_count ?? 0) + (HOME.test(cityStr) ? 15 : 0),
    };
  });
}

async function devpost(): Promise<Event[]> {
  // Devpost has no geo filter. Keep in-region events, plus BIG online hackathons
  // (>=500 registrations) which HK builders realistically join. Drops student-hack noise.
  const results = await Promise.all(
    DEVPOST_TERMS.map(async (q) => {
      const res = await fetch(
        `https://devpost.com/api/hackathons?search=${encodeURIComponent(q)}&status[]=upcoming&status[]=open&page=1`,
        { headers: { Accept: "application/json" }, next: { revalidate: 21600 } },
      );
      return res.ok ? ((await res.json()).hackathons ?? []) : [];
    }),
  );
  const out: Event[] = [];
  const seen = new Set<string>();
  for (const h of results.flat()) {
    if (seen.has(h.id)) continue;
    const loc = h.displayed_location?.location ?? "";
    const reg = h.registrations_count ?? 0;
    const inRegion = CITY_MATCH.test(loc);
    const bigOnline = /online/i.test(loc) && reg >= 500;
    if (!inRegion && !bigOnline) continue;
    seen.add(h.id);
    out.push({
      id: `dp-${h.id}`,
      title: h.title,
      host: h.organization_name ?? "Devpost",
      city: loc,
      start: h.submission_period_dates ?? "",
      url: h.url,
      image: h.thumbnail_url?.startsWith("http") ? h.thumbnail_url : null,
      attendees: reg,
      source: "Devpost" as const,
      score: rank(h.title, h.organization_name ?? "", reg) + 15, // hackathons are what the user wants
    });
  }
  return out;
}

function rank(title: string, host: string, attendees: number): number {
  // Big/prestigious to the top: attendee count (log) + keyword/host boosts.
  let s = Math.log10(attendees + 1) * 20; // 0..~60
  const text = `${title} ${host}`;
  if (PRESTIGE.test(text)) s += 25;
  return Math.round(s);
}

export async function getEvents(): Promise<Event[]> {
  const lumaResults = await Promise.all(
    Object.entries(LUMA_PLACES).map(([city, id]) => luma(city, id)),
  );
  const all = [...lumaResults.flat(), ...(await devpost())];
  // dedupe by id, sort by score desc then soonest
  const seen = new Set<string>();
  return all
    .filter((e) => e.id && !seen.has(e.id) && seen.add(e.id))
    .sort((a, b) => b.score - a.score || (a.start > b.start ? 1 : -1));
}
