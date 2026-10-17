import { supabaseServer } from '@/lib/supabase/server';
import { EVENT_ZONE } from '@/lib/clock';

/**
 * What the producer did this week, on the couple's own screen.
 *
 * Two to four lines from the activity log, only the ones a producer marked
 * for the couple, with the day beside each. This is the part of the screen
 * that says the system is alive between the couple's own visits: a quote
 * came in, a supplier was booked, a payment was recorded. Nothing on it is
 * pressed; it is read. Drawn empty as one quiet sentence rather than not
 * at all, because a section that appears only once something happened
 * teaches nobody to look for it.
 *
 * The drawing and the reading are two functions, the split the harness
 * check asks for: `WeekLogView` takes rows and can be looked at against a
 * fixture, `WeekLog` fetches them.
 */
export type WeekRow = { id: string; title: string; actor: string; created_at: string };

export function WeekLogView({ rows, title, empty, producer }: {
  rows: WeekRow[]; title: string; empty: string; producer: string;
}) {
  const day = new Intl.DateTimeFormat('he-IL', { timeZone: EVENT_ZONE, weekday: 'long' });
  return (
    <section aria-labelledby="week-log" className="mt-8">
      <h2 id="week-log" className="eyebrow">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-body text-ink-mute">{empty}</p>
      ) : (
        <ul className="mt-2 list-none space-y-1.5 p-0">
          {rows.map((r) => (
            <li key={r.id} className="flex items-baseline gap-3 text-body text-ink-soft">
              <span className="shrink-0 text-meta text-ink-mute">{day.format(new Date(r.created_at))}</span>
              <span className="min-w-0">
                {r.actor === 'producer' || r.actor === 'system' ? `${producer}: ` : ''}{r.title}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export async function WeekLog({ clientId, title, empty, producer }: {
  clientId: string; title: string; empty: string; producer: string;
}) {
  const sb = await supabaseServer();
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data } = await sb.from('activity_log')
    .select('id,title,actor,created_at')
    .eq('client_id', clientId).eq('visible_to_couple', true)
    .gte('created_at', since).order('created_at', { ascending: false }).limit(4);
  return <WeekLogView rows={(data ?? []) as WeekRow[]} title={title} empty={empty} producer={producer} />;
}
