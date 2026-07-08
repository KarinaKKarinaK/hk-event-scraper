import { getEvents } from "@/lib/events";

export const dynamic = "force-dynamic"; // re-fetch live on every page open

function fmtDate(s: string) {
  const d = new Date(s);
  if (isNaN(d.getTime())) return s; // Devpost gives a text range
  return d.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function Home() {
  const events = await getEvents();
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" className="h-9 w-9 rounded-lg" />
        <h1 className="text-2xl font-bold tracking-tight">
          Hong Kong &amp; Nearby Tech Events
        </h1>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        AI, startup, hackathon &amp; buildathon events. Biggest and most
        relevant first. {events.length} upcoming.
      </p>

      <ul className="mt-8 space-y-3">
        {events.map((e) => (
          <li key={e.id}>
            <a
              href={e.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-4 rounded-xl border border-neutral-200 p-4 transition hover:border-neutral-400 hover:shadow-sm dark:border-neutral-800 dark:hover:border-neutral-600"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <span>{fmtDate(e.start)}</span>
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-800">
                    {e.source}
                  </span>
                </div>
                <h2 className="mt-1 truncate text-base font-semibold">
                  {e.title}
                </h2>
                <p className="mt-0.5 truncate text-sm text-neutral-500">
                  By {e.host}
                </p>
                <p className="mt-0.5 flex items-center gap-3 text-sm text-neutral-500">
                  <span className="truncate">{e.city}</span>
                  {e.attendees ? (
                    <span className="shrink-0">+{e.attendees}</span>
                  ) : null}
                </p>
              </div>
              {e.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={e.image}
                  alt=""
                  className="h-20 w-20 shrink-0 rounded-lg object-cover"
                />
              ) : null}
            </a>
          </li>
        ))}
      </ul>

      {events.length === 0 && (
        <p className="mt-8 text-sm text-neutral-500">
          No events found right now. Check back later.
        </p>
      )}
    </main>
  );
}
