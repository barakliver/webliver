import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The shelf: closed events, grouped by the year they happened in.
 *
 * The year is read off the archive row rather than computed from a joined
 * event date, because that is what the folder listing is organised by and
 * joining to work it out is how a shelf becomes a table scan. It is written
 * once, when the event is closed.
 */

export type ArchivedEvent = {
  client_id: string;
  event_year: number | null;
  event_date: string | null;
  display_name: string;
  venue: string;
  guests_final: number | null;
  money: { budget?: number; paid?: number };
  vendors: { name?: string; category?: string; phone?: string }[];
  crew: { name?: string; role?: string; phone?: string; fee?: number }[];
  runsheet: { at?: string; title?: string }[];
  note: string;
  closed_at: string;
};

export type Shelf = {
  /** Descending, newest year first. `null` collects events with no date. */
  year: number | null;
  events: ArchivedEvent[];
};

const COLS =
  'client_id,event_year,event_date,display_name,venue,guests_final,money,vendors,crew,runsheet,note,closed_at';

export async function loadShelf(sb: SupabaseClient): Promise<Shelf[]> {
  const { data, error } = await sb
    .from('event_archives')
    .select(COLS)
    .order('event_year', { ascending: false, nullsFirst: false })
    .order('event_date', { ascending: false, nullsFirst: false })
    .limit(1000);

  if (error) {
    /* One failed read is an empty shelf and a line in the log, not a broken
       page. Everything else on this screen is navigation. */
    console.error('[archive] could not read the shelf', { message: error.message });
    return [];
  }

  const rows = (data ?? []) as ArchivedEvent[];
  const byYear = new Map<number | null, ArchivedEvent[]>();

  for (const r of rows) {
    /* A year of zero is what the database writes when an event had no date.
       Folded back to null here so the screen has one idea of "no year" rather
       than two that look different only in the sort. */
    const year = r.event_year && r.event_year > 1900 ? r.event_year : null;
    const list = byYear.get(year) ?? [];
    list.push(r);
    byYear.set(year, list);
  }

  return [...byYear.entries()]
    .map(([year, events]) => ({ year, events }))
    /* Undated last. It is a holding pen, not a year, and putting it above 2026
       would make the shelf look wrong at a glance. */
    .sort((a, b) => (b.year ?? -1) - (a.year ?? -1));
}
