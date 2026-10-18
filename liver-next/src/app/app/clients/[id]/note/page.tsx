import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Plus } from 'lucide-react';
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

  /* The other pages written on this event, beside the one that is open: a
     producer keeps several, and finding the one from Tuesday should not mean
     going back to the file. Newest first, and capped, because this is a margin
     and not a library. */
  const { data: others } = await sb
    .from('meeting_logs')
    .select('id,title,held_on,updated_at')
    .eq('client_id', clientId)
    .eq('kind', 'note')
    .order('updated_at', { ascending: false })
    .limit(30);
  const c = (await serverCopy()).note;
  const dots = ['bg-tone-camel', 'bg-tone-boho', 'bg-tone-rubine', 'bg-tone-tamarind'];

  /* The shell above this page already put the copy in context, in whichever
     language the producer is reading. */
  return (
    <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
      {/* From a laptop up only. On a phone the page is the whole screen, which
          is what it was asked to be. */}
      <aside className="no-print hidden self-start lg:block" aria-label={c.others}>
        <p className="mb-2 px-3 text-meta text-ink-mute">{c.others}</p>
        <ul className="list-none space-y-0.5 p-0">
          {(others ?? []).map((n, i) => {
            const open = n.id === noteId;
            return (
              <li key={n.id as string}>
                <Link
                  href={`/app/clients/${clientId}/note?id=${n.id}`}
                  aria-current={open ? 'page' : undefined}
                  className={`flex min-h-[44px] items-center gap-2.5 rounded-control px-3 text-body transition ${open ? 'bg-surface-200 text-ink' : 'text-ink-soft hover:bg-surface-200 hover:text-ink'}`}
                >
                  <span aria-hidden className={`size-2 shrink-0 rounded-full ${dots[i % dots.length]}`} />
                  <span className="truncate">{(n.title as string) || c.untitled}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <Link href={`/app/clients/${clientId}/note`} className="btn-quiet mt-2 inline-flex items-center gap-1.5 px-3 text-body">
          <Plus size={15} strokeWidth={1.5} aria-hidden />
          {c.newNote}
        </Link>
      </aside>
      <NotePad clientId={clientId} eventName={client.display_name as string} note={note} />
    </div>
  );
}
