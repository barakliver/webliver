import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Song, Kit, Person } from '@/components/app/EventFileLists';

/**
 * The three lists for one event.
 *
 * All three come back possibly empty and that is the normal state: the screen
 * renders from the shipped list of moments, items and fields, and these rows
 * are only the answers somebody has given so far. A missing row is a question
 * still open, not missing data.
 */
export async function loadEventFile(sb: SupabaseClient, clientId: string): Promise<{
  songs: Song[]; kit: Kit[]; people: Person[];
}> {
  const [music, equipment, couple] = await Promise.all([
    sb.from('event_music').select('moment,song,artist,note').eq('client_id', clientId),
    sb.from('event_equipment').select('item,needed,sorted').eq('client_id', clientId),
    sb.from('couple_details').select('person,name,fields').eq('client_id', clientId),
  ]);

  for (const [label, r] of [['music', music], ['equipment', equipment], ['couple', couple]] as const) {
    /* One failed read is an empty list and a line in the log, not a blank tab:
       the other two are still worth showing. */
    if (r.error) console.error(`[eventFile] ${label} failed`, { message: r.error.message });
  }

  return {
    songs: (music.data ?? []) as Song[],
    kit: (equipment.data ?? []) as Kit[],
    people: (couple.data ?? []) as Person[],
  };
}
