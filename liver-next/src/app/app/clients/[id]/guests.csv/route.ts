import { NextResponse } from 'next/server';
import { requireAccount } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { toCsv } from '@/lib/csv';
import { RSVP_LABELS, DIETS } from '@/content/lists';

/**
 * The guest list as a file, for the caterer, the venue or a phone call round.
 *
 * A route rather than a button that builds the file in the browser: the data
 * is already behind row level security on the server, and a download served
 * from here needs no copy of the list shipped to the page first. Whoever asks
 * gets exactly the guests their policies allow — a workspace they are not on
 * produces an empty file, not somebody else's list.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAccount();
  const { id } = await params;

  const sb = await supabaseServer();
  const [{ data: client }, { data: guests }, { data: tables }] = await Promise.all([
    sb.from('clients').select('display_name').eq('id', id).maybeSingle(),
    sb.from('guests_rsvp')
      .select('full_name,side,phone,status,party_size,diet,note,table_id')
      .eq('client_id', id).order('full_name'),
    sb.from('tables_seating').select('id,name').eq('client_id', id),
  ]);

  const tableName = new Map((tables ?? []).map((t) => [t.id, t.name]));
  const dietLabel = (v: string) => DIETS.find((d) => d.value === v)?.label ?? v ?? '';

  const rows = [
    ['שם מלא', 'צד', 'טלפון', 'סטטוס', 'כמות', 'העדפת אוכל', 'שולחן', 'הערה'],
    ...(guests ?? []).map((g) => [
      g.full_name ?? '',
      g.side ?? '',
      g.phone ?? '',
      RSVP_LABELS[g.status] ?? g.status ?? '',
      String(g.party_size ?? ''),
      dietLabel(g.diet),
      g.table_id ? (tableName.get(g.table_id) ?? '') : '',
      g.note ?? '',
    ]),
  ];

  /* The name goes in the filename because these land in a downloads folder
     next to four other guest lists. Non-ASCII is given both ways: filename*
     carries the Hebrew for anything modern, and the plain filename is a safe
     fallback rather than a mangled one. */
  const safe = (client?.display_name ?? 'guests').replace(/[^\p{L}\p{N} _-]/gu, '').trim();
  const ascii = /^[\x20-\x7E]+$/.test(safe) ? safe : 'guest-list';

  return new NextResponse(toCsv(rows), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition':
        `attachment; filename="${ascii}.csv"; filename*=UTF-8''${encodeURIComponent(safe)}.csv`,
      'cache-control': 'no-store',
    },
  });
}
