import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { receiveInbox, processInbox, type Attachment } from '@/lib/inbox/intake';
import { ensureInboxBucket } from '@/lib/inbound';

/**
 * A file dropped on an event, read as if it had been sent.
 *
 * A route rather than a server action, because a server action is a
 * request body with a limit measured in single megabytes and a quote as a
 * scanned PDF is past it. The session decides who is asking; the event is
 * read through that session, so row level security answers whether it is
 * theirs; only the bytes go through the service role, into a bucket no
 * browser reads directly.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX = 25_000_000;
const ALLOWED = /^(application\/pdf|image\/(png|jpeg|webp|gif|heic)|text\/plain)$/;

export async function POST(req: Request) {
  const account = await currentAccount();
  if (!account?.producer) return NextResponse.json({ ok: false, error: 'צריך להתחבר' }, { status: 401 });

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ ok: false, error: 'בקשה לא תקינה' }, { status: 400 }); }
  const clientId = String(form.get('client_id') ?? '');
  const note = String(form.get('note') ?? '').trim().slice(0, 4000);
  const files = form.getAll('file').filter((f): f is File => f instanceof File && f.size > 0);
  if (!clientId) return NextResponse.json({ ok: false, error: 'חסר אירוע' }, { status: 400 });
  if (!files.length && !note) return NextResponse.json({ ok: false, error: 'אין מה לקרוא' }, { status: 400 });

  /* The event, through the session: not theirs is not found. */
  const own = await supabaseServer();
  const { data: client } = await own.from('clients').select('id,display_name').eq('id', clientId).maybeSingle();
  if (!client) return NextResponse.json({ ok: false, error: 'האירוע לא נמצא' }, { status: 404 });

  const sb = supabaseAdmin();
  await ensureInboxBucket(sb);
  const attachments: Attachment[] = [];
  for (const f of files.slice(0, 5)) {
    if (f.size > MAX) return NextResponse.json({ ok: false, error: `${f.name}: הקובץ גדול מ-25MB` }, { status: 400 });
    if (!ALLOWED.test(f.type)) return NextResponse.json({ ok: false, error: `${f.name}: סוג קובץ לא נתמך` }, { status: 400 });
    const safe = f.name.replace(/[^\w.\-֐-׿]+/g, '_').slice(0, 80) || 'file';
    const path = `${account.producer.id}/${clientId}/${Date.now()}-${safe}`;
    const { error } = await sb.storage.from('inbox').upload(path, Buffer.from(await f.arrayBuffer()), { contentType: f.type, upsert: false });
    if (error) return NextResponse.json({ ok: false, error: 'העלאה נכשלה' }, { status: 500 });
    attachments.push({ name: safe, mime: f.type, path, size: f.size });
  }

  const got = await receiveInbox(sb, {
    producerId: account.producer.id, channel: 'upload', clientId,
    fromIdentity: account.email, fromName: account.fullName,
    subject: files.map((f) => f.name).join(', ').slice(0, 500),
    bodyText: note || (files.length ? `קובץ שהועלה על ${String((client as { display_name?: string }).display_name ?? '')}` : ''),
    attachments,
  });
  if (!got) return NextResponse.json({ ok: false, error: 'לא הצלחנו לשמור' }, { status: 500 });
  await processInbox(sb, got.id);

  const { data: item } = await sb.from('inbox_items').select('status,ai_summary').eq('id', got.id).maybeSingle();
  const { count } = await sb.from('suggested_actions').select('id', { count: 'exact', head: true }).eq('inbox_item_id', got.id).eq('status', 'pending');
  return NextResponse.json({ ok: true, id: got.id, status: (item as { status?: string } | null)?.status, summary: (item as { ai_summary?: string } | null)?.ai_summary ?? '', pending: count ?? 0 });
}
