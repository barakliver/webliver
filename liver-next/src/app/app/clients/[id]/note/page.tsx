import { notFound } from 'next/navigation';
import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { serverCopy } from '@/lib/serverLocale';
import { NotePad, type Note } from '@/components/app/NotePad';
import { todayInZone } from '@/lib/clock';

export async function generateMetadata() {
  return { title: (await serverCopy()).note.title };
}

/**
 * The blank page.
 *
 * Its own screen rather than a panel on the event's page, because the whole
 * request was for somewhere with nothing else on it. What is here is a date,
 * a line for a title and the rest of the screen: no tabs, no summary strip,
 * no eleven panels rebuilding behind the cursor.
 *
 * `?id=` opens a page already written. Without it the screen starts empty and
 * the row is created by the first save, so opening this and changing your
 * mind leaves nothing behind.
 *
 * Nothing here trusts the id in the address. The read is under row level
 * security, so a note belonging to another producer's event comes back as
 * nothing and this is a page not found — and the client id is checked as
 * well, so a real note of this producer's cannot be opened under the wrong
 * event and then saved into it.
 */
export default async function NotePage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  await requireLiveProducer();
  const { id: clientId } = await params;
  const { id: noteId } = await searchParams;

  const sb = await supabaseServer();
  const { data: client } = await sb
    .from('clients')
    .select('id,display_name')
    .eq('id', clientId)
    .maybeSingle();
  if (!client) notFound();

  let note: Note = {
    id: null, title: '', held_on: todayInZone(), body: '', updated_at: null,
  };

  if (noteId) {
    const { data: row } = await sb
      .from('meeting_logs')
      .select('id,title,held_on,summary,updated_at,kind')
      .eq('id', noteId)
      .eq('client_id', clientId)
      .eq('kind', 'note')
      .maybeSingle();
    if (!row) notFound();
    note = {
      id: row.id as string,
      title: (row.title as string) ?? '',
      held_on: (row.held_on as string | null) ?? todayInZone(),
      body: (row.summary as string) ?? '',
      updated_at: (row.updated_at as string | null) ?? null,
    };
  }

  /* The shell above this page already put the copy in context, in whichever
     language the producer is reading. */
  return <NotePad clientId={clientId} eventName={client.display_name as string} note={note} />;
}
