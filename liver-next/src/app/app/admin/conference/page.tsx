import Link from 'next/link';
import QRCode from 'qrcode';
import { Download, Printer, MessageCircle, Mail, Phone } from 'lucide-react';
import { requireRoot } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import { EVENT_ZONE } from '@/lib/clock';
import { normalizePhone } from '@/lib/phone';
import { joinUrl } from '@/lib/campaign';
import { TONE } from '@/lib/tone';
import { PageHead } from '@/components/app/PageHead';
import { IssueReporter } from '@/components/app/IssueReporter';
import { CampaignForm } from '@/components/app/CampaignForm';
import { BroadcastPanel } from '@/components/app/BroadcastPanel';
import { CopyUrl } from '@/components/app/CopyUrl';
import { Live } from '@/components/app/Live';
import { DeleteForm } from '@/components/app/ConfirmDelete';
import { setCampaignActive, deleteContact, saveContactNote } from '@/app/actions/conference';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'כנס והרשמות' };

type Campaign = { id: string; token: string; name: string; kind: 'producer' | 'dj'; expires_at: string | null; max_signups: number; active: boolean };
type Contact = {
  id: string; campaign_id: string | null; name: string; phone: string; email: string; terms_version: string;
  broadcast_consent: boolean; broadcast_consent_at: string | null; broadcast_revoked_at: string | null;
  note: string; created_at: string;
};
type Broadcast = { id: string; subject: string; recipients: number; sent: number; failed: number; status: string; created_at: string };

const day = new Intl.DateTimeFormat('he-IL', { timeZone: EVENT_ZONE, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * The conference: the codes, the people who came through them, and a way to
 * write to those who said they would like that.
 *
 * Root only, by the page and by the policies behind it. The QR is made here, on
 * the server, from the address; no third party is asked to draw it, because
 * every scan sent to somebody else's service is a list of who was at the stand.
 */
export default async function ConferencePage({ searchParams }: { searchParams: Promise<{ c?: string; list?: string }> }) {
  const account = await requireRoot();
  const { c: only = '', list = '' } = await searchParams;
  const sb = await supabaseServer();

  const [{ data: campaignRows }, { data: contactRows }, { data: sentRows }] = await Promise.all([
    sb.from('signup_campaigns').select('id,token,name,kind,expires_at,max_signups,active').order('created_at', { ascending: false }),
    sb.from('contacts')
      .select('id,campaign_id,name,phone,email,terms_version,broadcast_consent,broadcast_consent_at,broadcast_revoked_at,note,created_at')
      .order('created_at', { ascending: false }).limit(2000),
    sb.from('broadcasts').select('id,subject,recipients,sent,failed,status,created_at').order('created_at', { ascending: false }).limit(8),
  ]);
  const campaigns = (campaignRows ?? []) as Campaign[];
  const contacts = (contactRows ?? []) as Contact[];
  const sent = (sentRows ?? []) as Broadcast[];

  const name = (id: string | null) => campaigns.find((k) => k.id === id)?.name ?? '';
  const shown = contacts.filter((k) => (!only || k.campaign_id === only) && (list !== '1' || (k.broadcast_consent && !k.broadcast_revoked_at)));
  const consenting = contacts.filter((k) => k.broadcast_consent && !k.broadcast_revoked_at).length;

  const qrs = await Promise.all(campaigns.map(async (k) => {
    const url = joinUrl(publicEnv.appUrl, k.token);
    const svg = await QRCode.toString(url, { type: 'svg', margin: 2, color: { dark: '#000000', light: '#ffffff' } });
    const png = await QRCode.toDataURL(url, { margin: 2, width: 1024, color: { dark: '#000000', light: '#ffffff' } });
    return { id: k.id, url, svg, png, svgUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` };
  }));

  const exportHref = `/app/admin/conference/export${only ? `?c=${only}` : ''}`;

  return (
    <>
      <PageHead
        title="כנס והרשמות"
        sub="קוד QR להדפסה, מי נכנס דרכו, ורשימת תפוצה עם הוכחה למה כל אחד אישר."
        report={<IssueReporter userId={account.id} context="conference" />}
      />

      {/* The count goes up on the day, so the page listens: a person arriving
          refreshes it without anybody pressing anything. */}
      <Live sources={[{ table: 'contacts' }, { table: 'signup_campaigns' }]} />

      <div className="space-y-10">
        <section aria-labelledby="conf-codes" className="space-y-4">
          <h2 id="conf-codes" className="head-section">הקודים</h2>
          <CampaignForm />

          {campaigns.length === 0 ? (
            <p className="text-body text-ink-mute">עוד אין קוד. צרו אחד, והוא יופיע כאן עם ה-QR שלו.</p>
          ) : (
            <ul className="grid list-none gap-4 p-0 lg:grid-cols-2">
              {campaigns.map((k, i) => {
                const q = qrs[i];
                const people = contacts.filter((x) => x.campaign_id === k.id).length;
                const closed = !k.active || (k.expires_at && new Date(k.expires_at).getTime() < Date.now()) || people >= k.max_signups;
                return (
                  <li key={k.id} className="card flex flex-col gap-4 sm:flex-row">
                    <div
                      role="img" aria-label={`QR: ${k.name}`}
                      className="mx-auto w-44 shrink-0 overflow-hidden rounded-card-sm bg-white p-1 [&>svg]:h-auto [&>svg]:w-full"
                      dangerouslySetInnerHTML={{ __html: q.svg }}
                    />
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="head-sub">{k.name}</h3>
                        <span className={`rounded-full px-2.5 py-0.5 text-meta ${k.kind === 'dj' ? TONE.rubine.wash : TONE.camel.wash}`}>
                          {k.kind === 'dj' ? 'DJ' : 'מפיקים'}
                        </span>
                        <span className={`rounded-full px-2.5 py-0.5 text-meta ${closed ? 'bg-surface-200 text-ink-mute' : TONE.tamarind.wash}`}>
                          {closed ? 'סגור' : 'פתוח'}
                        </span>
                      </div>
                      <p className="text-body text-ink-soft">
                        {people} מתוך {k.max_signups}
                        {k.expires_at ? ` · נסגר ${day.format(new Date(k.expires_at))}` : ' · בלי תאריך סגירה'}
                      </p>
                      <CopyUrl url={q.url} label="העתקת הקישור" done="הועתק" />
                      <div className="flex flex-wrap items-center gap-2">
                        <a href={q.png} download={`qr-${k.name}.png`} className="btn-ghost inline-flex items-center gap-1.5 text-body">
                          <Download size={14} strokeWidth={1.5} aria-hidden />PNG
                        </a>
                        <a href={q.svgUrl} download={`qr-${k.name}.svg`} className="btn-ghost inline-flex items-center gap-1.5 text-body">
                          <Download size={14} strokeWidth={1.5} aria-hidden />SVG
                        </a>
                        <Link href={`/app/admin/conference/${k.id}/print`} className="btn-ghost inline-flex items-center gap-1.5 text-body">
                          <Printer size={14} strokeWidth={1.5} aria-hidden />דף להדפסה
                        </Link>
                        <form action={setCampaignActive}>
                          <input type="hidden" name="id" value={k.id} />
                          <input type="hidden" name="active" value={k.active ? '0' : '1'} />
                          <button type="submit" className="btn-quiet text-body">{k.active ? 'כיבוי הקוד' : 'הפעלה מחדש'}</button>
                        </form>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="conf-people" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="conf-people" className="head-section">מי נכנס</h2>
              <p className="mt-1 text-body text-ink-soft">
                {contacts.length} אנשים, מהם {consenting} אישרו רשימת תפוצה.
              </p>
            </div>
            <a href={exportHref} className="btn-ghost inline-flex items-center gap-1.5 text-body">
              <Download size={14} strokeWidth={1.5} aria-hidden />ייצוא ל-Excel (CSV)
            </a>
          </div>

          <nav aria-label="סינון" className="flex flex-wrap gap-2 text-body">
            <Link href="/app/admin/conference" className={`rounded-full border px-3 py-1 ${!only && !list ? 'border-accent text-ink' : 'border-line text-ink-mute'}`}>הכול</Link>
            <Link href={`/app/admin/conference?${only ? `c=${only}&` : ''}list=1`} className={`rounded-full border px-3 py-1 ${list === '1' ? 'border-accent text-ink' : 'border-line text-ink-mute'}`}>רק מי שאישר רשימה</Link>
            {campaigns.map((k) => (
              <Link key={k.id} href={`/app/admin/conference?c=${k.id}${list ? '&list=1' : ''}`} className={`rounded-full border px-3 py-1 ${only === k.id ? 'border-accent text-ink' : 'border-line text-ink-mute'}`}>{k.name}</Link>
            ))}
          </nav>

          {shown.length === 0 ? (
            <p className="text-body text-ink-mute">אף אחד עדיין.</p>
          ) : (
            <ul className="rows list-none divide-y divide-line p-0">
              {shown.map((k) => {
                const tel = normalizePhone(k.phone);
                const on = k.broadcast_consent && !k.broadcast_revoked_at;
                return (
                  <li key={k.id} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-lead font-medium text-ink">{k.name}</p>
                        <p className="text-meta text-ink-mute">
                          {name(k.campaign_id)} · {day.format(new Date(k.created_at))} · תנאים {k.terms_version}
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-meta ${on ? TONE.tamarind.wash : 'bg-surface-200 text-ink-mute'}`}>
                        {on ? 'ברשימה' : k.broadcast_revoked_at ? 'הסיר את עצמו' : 'לא ברשימה'}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-body">
                      <a href={`mailto:${k.email}`} dir="ltr" className="btn-ghost inline-flex items-center gap-1.5">
                        <Mail size={14} strokeWidth={1.5} aria-hidden />{k.email}
                      </a>
                      {tel && (
                        <>
                          <a href={`tel:${tel}`} dir="ltr" className="btn-ghost inline-flex items-center gap-1.5">
                            <Phone size={14} strokeWidth={1.5} aria-hidden />{k.phone}
                          </a>
                          <a href={`https://wa.me/${tel.replace('+', '')}`} target="_blank" rel="noopener noreferrer" className="btn-ghost inline-flex items-center gap-1.5">
                            <MessageCircle size={14} strokeWidth={1.5} aria-hidden />WhatsApp
                          </a>
                        </>
                      )}
                    </div>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-meta text-ink-mute">{k.note ? `הערה: ${k.note.slice(0, 60)}` : 'הערה ומחיקה'}</summary>
                      <form action={saveContactNote} className="mt-2 flex gap-2">
                        <input type="hidden" name="id" value={k.id} />
                        <input name="note" defaultValue={k.note} maxLength={2000} className="field min-w-0 flex-1" aria-label="הערה" autoComplete="off" />
                        <button type="submit" className="btn-ghost">שמירה</button>
                      </form>
                      <DeleteForm action={deleteContact} ask="למחוק את האיש הזה לגמרי? הפרטים וההסכמות שלו יימחקו." className="mt-2">
                        <input type="hidden" name="id" value={k.id} />
                        <button type="submit" className="btn-quiet text-bad">מחיקה לגמרי</button>
                      </DeleteForm>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="conf-send" className="space-y-4">
          <h2 id="conf-send" className="head-section">הודעה לרשימה</h2>
          <BroadcastPanel campaigns={campaigns.map((k) => ({ id: k.id, name: k.name }))} />
          {sent.length > 0 && (
            <ul className="list-none space-y-1 p-0 text-body text-ink-soft">
              {sent.map((b) => (
                <li key={b.id}>
                  {day.format(new Date(b.created_at))} · {b.subject} · {b.status === 'done' ? `${b.sent} נשלחו${b.failed ? `, ${b.failed} נכשלו` : ''}` : `נשלחת ל-${b.recipients}`}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
