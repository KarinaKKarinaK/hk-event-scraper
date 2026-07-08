// Aggregates tech/startup/hackathon events for HK + nearby cities.
// Sources: Luma discover (HK city page) + Devpost hackathons. No API keys.
// ponytail: no DB, no cache. Page is force-dynamic, so every open re-fetches live.

export type Event = {
  id: string;
  title: string;
  host: string;
  city: string;
  start: string; // ISO
  url: string;
  image: string | null;
  attendees: number | null;
  source: "Luma" | "Devpost" | "Meetup";
  score: number;
  featured?: boolean; // top-ranked (big/prestigious) -> highlighted in the UI
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Meetup find-page keywords (Hong Kong local groups: AI, robotics, dev, startup...).
const MEETUP_KEYWORDS = [
  "artificial intelligence",
  "robotics",
  "startup",
  "blockchain",
  "developer",
];

// Luma discover place IDs (resolved from luma.com/<slug> pages).
// Only cities Luma actually has a discover page for. SZ/GZ/Macau aren't on Luma.
const LUMA_PLACES: Record<string, string> = {
  "Hong Kong": "discplace-z9B5Guglh2WINA1",
  Taipei: "discplace-fi7MDZq99wfKWfa",
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
    cache: "no-store",
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
    DEVPOST_TERMS.flatMap((q) =>
      [1, 2].map(async (page) => {
        const res = await fetch(
          `https://devpost.com/api/hackathons?search=${encodeURIComponent(q)}&status[]=upcoming&status[]=open&page=${page}`,
          { headers: { Accept: "application/json" }, cache: "no-store" },
        );
        return res.ok ? ((await res.json()).hackathons ?? []) : [];
      }),
    ),
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

async function meetup(): Promise<Event[]> {
  // Meetup has no open API; scrape the Hong Kong find pages' embedded __NEXT_DATA__.
  // ponytail: regex-resolve photo/group refs from the raw blob instead of walking Apollo cache.
  const now = Date.now();
  const results = await Promise.all(
    MEETUP_KEYWORDS.map(async (kw) => {
      try {
        const res = await fetch(
          `https://www.meetup.com/find/?keywords=${encodeURIComponent(kw)}&location=hk--Hong%20Kong&source=EVENTS`,
          { headers: { "User-Agent": UA, Accept: "text/html" }, cache: "no-store" },
        );
        if (!res.ok) return [];
        const html = await res.text();
        const m = html.match(
          /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
        );
        if (!m) return [];
        const raw = m[1];
        const data = JSON.parse(raw);
        const nodes: any[] = [];
        const walk = (o: any) => {
          if (o && typeof o === "object") {
            if (o.__typename === "Event" && o.title) nodes.push(o);
            for (const v of Object.values(o)) walk(v);
          }
        };
        walk(data);
        const resolve = (ref: string, field: string) => {
          const r = raw.match(
            new RegExp(`"${ref}":\\{[^}]*"${field}":"([^"]+)"`),
          );
          return r ? r[1].replace(/\\u002F/g, "/") : null;
        };
        return nodes.map((e) => {
          const image = e.featuredEventPhoto?.__ref
            ? resolve(e.featuredEventPhoto.__ref, "highResUrl")
            : null;
          const host = e.group?.__ref
            ? (resolve(e.group.__ref, "name") ?? "Meetup")
            : "Meetup";
          const attendees = e.rsvps?.totalCount ?? null;
          return {
            id: `mu-${e.id}`,
            title: e.title,
            host,
            city: e.venue?.city || "Hong Kong",
            start: e.dateTime,
            url: e.eventUrl,
            image,
            attendees,
            source: "Meetup" as const,
            score: rank(e.title, host, attendees ?? 0) + 10, // home turf
          };
        });
      } catch {
        return [];
      }
    }),
  );
  return results.flat().filter((e) => !e.start || new Date(e.start).getTime() > now);
}

function rank(title: string, host: string, attendees: number): number {
  // Big/prestigious to the top: attendee count (log) + keyword/host boosts.
  let s = Math.log10(attendees + 1) * 20; // 0..~60
  const text = `${title} ${host}`;
  if (PRESTIGE.test(text)) s += 25;
  return Math.round(s);
}

export async function getEvents(): Promise<Event[]> {
  // Run every source in parallel; total latency = slowest source.
  const [lumaResults, devpostResults, meetupResults] = await Promise.all([
    Promise.all(Object.entries(LUMA_PLACES).map(([city, id]) => luma(city, id))),
    devpost(),
    meetup(),
  ]);
  const all = [...lumaResults.flat(), ...devpostResults, ...meetupResults];
  const seen = new Set<string>();
  const unique = all.filter((e) => e.id && !seen.has(e.id) && seen.add(e.id));
  // Flag the 8 highest-scoring (biggest/most prestigious) as featured.
  const topIds = new Set(
    [...unique].sort((a, b) => b.score - a.score).slice(0, 8).map((e) => e.id),
  );
  // Display chronologically, soonest first.
  return unique
    .map((e) => ({ ...e, featured: topIds.has(e.id) }))
    .sort((a, b) => startMs(a.start) - startMs(b.start));
}

// Parse a sortable timestamp. Luma/Meetup give ISO; Devpost gives text like
// "Mar 09 - 31, 2026" -> pull the first month/day + trailing year. Unknown -> end.
function startMs(s: string): number {
  const t = Date.parse(s);
  if (!isNaN(t)) return t;
  const m = s.match(/^([A-Za-z]{3}\s+\d{1,2}).*?(\d{4})/);
  if (m) {
    const t2 = Date.parse(`${m[1]} ${m[2]}`);
    if (!isNaN(t2)) return t2;
  }
  return Infinity;
}
