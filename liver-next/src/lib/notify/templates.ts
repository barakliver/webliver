/* Relative rather than aliased, so the letters can be rendered by a test.
   `node --test` does not resolve `@/`, and the one letter here that leaves the
   business is worth being able to look at without a browser. */
import { site, PROMISE } from '../../content/site.ts';
import { siteEn } from '../../content/site.en.ts';
import type { Locale } from '../locale.ts';

/**
 * The identity at the foot of a letter.
 *
 * Every email closes with a name, and whose name it is depends on whose
 * business the reader is dealing with. The platform's own mail signs with the
 * promise line above the brand; a producer's mail signs with their name and
 * their tagline, and never with the platform's signature — a couple invited by
 * another producer must not receive a letter that closes in somebody else's
 * voice. `promise` is therefore part of the identity rather than a constant of
 * the shell.
 */
export type MailBrand = { name: string; tagline?: string; promise?: string };

/* The platform's own signature, in the language the letter is written in.
   Signing an English letter in Hebrew was the residual half of the same bug:
   the body was translated and the name at the bottom was not, so the first
   thing the business ever said to an English enquirer ended in a script they
   cannot read. The English promise is the English hero line, which is where
   that sentence is already written for this language. */
const platformMail = (locale: Locale): MailBrand => (locale === 'en'
  ? { name: siteEn.brand, tagline: siteEn.tagline, promise: siteEn.hero.headline }
  : { name: site.brand, tagline: site.tagline, promise: PROMISE });

/* The language is one argument rather than two, so the direction cannot
   disagree with the words. Everything sent inward is Hebrew and always will
   be; the confirmation that lands in an enquirer's inbox is in whatever
   language they filled the form in, and an English paragraph laid out right to
   left is a letter that looks broken before it is read. */
function shell(inner: string, brand?: MailBrand, locale: Locale = 'he'): string {
  const sign = brand ?? platformMail(locale);
  return `
<div dir="${locale === 'en' ? 'ltr' : 'rtl'}" style="font-family:Assistant,Heebo,Arial,sans-serif;background:#f4f8fd;padding:28px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:20px;padding:28px;border:1px solid #e6eef8">
    ${inner}
    <hr style="border:none;border-top:1px solid #eef2f7;margin:22px 0">
    <!-- The signature line, when the sender has one. In the accent and tracked
         open, so it reads as a signature rather than as another line of small
         print. Above the name, because it is what the name is for. -->
    ${sign.promise ? `<p style="margin:0 0 6px;color:#a3814f;font-size:12px;font-weight:600;letter-spacing:.14em">${sign.promise}</p>` : ''}
    <p style="color:#6b7686;font-size:12.5px;margin:0">${sign.name}${sign.tagline ? ` · ${sign.tagline}` : ''}</p>
  </div>
</div>`;
}

const row = (k: string, v: string) =>
  v ? `<tr><td style="padding:5px 0;color:#6b7686;width:120px">${k}</td><td style="padding:5px 0;color:#0b1220">${v}</td></tr>` : '';

export type LeadPayload = {
  full_name: string; email: string; phone: string;
  kind: string; event_date: string; guest_count: string; message: string;
  location?: string;
};

export function adminLeadEmail(l: LeadPayload) {
  return shell(`
    <h2 style="margin:0 0 4px;font-size:20px;color:#0b1220">פנייה חדשה מהאתר</h2>
    <p style="margin:0 0 16px;color:#6b7686;font-size:14px">התקבלה דרך טופס יצירת הקשר</p>
    <table style="width:100%;font-size:14.5px;border-collapse:collapse">
      ${row('שם', l.full_name)}${row('טלפון', l.phone)}${row('אימייל', l.email)}
      ${row('סוג האירוע', l.kind === 'corporate' ? 'אירוע עסקי' : 'חתונה')}
      ${l.location ? `<tr><td style="padding:5px 0;color:#6b7686;width:120px">מיקום</td><td style="padding:5px 0;color:#0b1220;font-weight:600">${l.location}</td></tr>` : ''}
      ${row('תאריך', l.event_date)}${row('אורחים', l.guest_count)}
      ${row('הודעה', l.message)}
    </table>`);
}

/** The only letter here that goes to somebody outside the business, and so the
 *  only one written in the reader's language rather than the office's. */
export function clientConfirmEmail(name: string, brand?: MailBrand, locale: Locale = 'he') {
  const p = 'margin:0 0 10px;font-size:15px;line-height:1.8;color:#3c4657';
  const inner = locale === 'en'
    ? `
    <h2 style="margin:0 0 10px;font-size:20px;color:#0b1220">Thank you ${name}, we have your details</h2>
    <p style="${p}">
      Your enquiry has reached us, and we usually come back within one business day.
    </p>
    <p style="margin:0;font-size:15px;line-height:1.8;color:#3c4657">
      If anything is urgent in the meantime, simply reply to this email.
    </p>`
    : `
    <h2 style="margin:0 0 10px;font-size:20px;color:#0b1220">תודה ${name}, קיבלנו את הפרטים</h2>
    <p style="${p}">
      הפנייה שלכם התקבלה, ונחזור אליכם בדרך כלל תוך יום עסקים.
    </p>
    <p style="margin:0;font-size:15px;line-height:1.8;color:#3c4657">
      בינתיים, אם יש משהו דחוף אפשר פשוט להשיב למייל הזה.
    </p>`;
  return shell(inner, brand, locale);
}

/** The subject line of that same letter, in the same language as its body. */
export const clientConfirmSubject = (locale: Locale): string =>
  locale === 'en' ? 'We have your enquiry' : 'קיבלנו את הפנייה שלכם';

export function adminLeadWhatsApp(l: LeadPayload) {
  return [
    'פנייה חדשה מהאתר',
    `שם: ${l.full_name}`,
    l.phone ? `טלפון: ${l.phone}` : '',
    l.email ? `אימייל: ${l.email}` : '',
    `סוג: ${l.kind === 'corporate' ? 'אירוע עסקי' : 'חתונה'}`,
    l.location ? `מיקום: ${l.location}` : '',
    l.event_date ? `תאריך: ${l.event_date}` : '',
    l.guest_count ? `אורחים: ${l.guest_count}` : '',
    l.message ? `הודעה: ${l.message}` : '',
  ].filter(Boolean).join('\n');
}

/** Sent to a couple the moment their address is authorised on a workspace.
 *  There is no password to deliver: the address itself is the credential,
 *  and a code arrives per sign in. */
export function clientInviteEmail(opts: {
  eventName: string;
  producerName: string;
  signInUrl: string;
  /** True when the button signs them in on its own. False when it only opens
   *  the sign-in screen, which is what happens without a service role key. */
  oneClick: boolean;
  installUrl: string;
  producerPhone?: string;
  /** The identity the letter signs with. A tenant producer's invitations must
   *  close with their own name; without this the shell signs as the platform. */
  brand?: MailBrand;
}) {
  /* Two different promises, so the button never overstates what it does. A
     button that says "press to enter" and then asks for a code is the kind of
     small lie that makes somebody stop trusting the rest of the email. */
  const buttonLabel = opts.oneClick ? 'כניסה לאזור שלכם' : 'פתיחת האזור שלכם';
  const howItWorks = opts.oneClick
    ? 'הקישור הזה מכניס אתכם ישירות, בלחיצה אחת. הוא אישי, לשימוש חד פעמי, ותקף ליממה.'
    : 'לחיצה על הכפתור פותחת את מסך הכניסה עם הכתובת שלכם. נשלח אליכם קוד קצר וזהו.';

  return shell(`
    <h2 style="margin:0 0 10px;font-size:20px;color:#0e1620">האזור האישי שלכם מוכן</h2>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.8;color:#47566a">
      ${opts.producerName} פתח עבורכם מרחב עבודה ל<b>${opts.eventName}</b>.
    </p>

    <p style="margin:0 0 6px;font-size:15px;line-height:1.8;color:#47566a">מה תמצאו שם:</p>
    <ul style="margin:0 0 18px;padding-inline-start:20px;font-size:15px;line-height:1.9;color:#47566a">
      <li>המשימות שלכם ומה מחכה להחלטה</li>
      <li>לוח התשלומים</li>
      <li>רשימת האורחים ואישורי ההגעה</li>
      <li>לוז יום האירוע</li>
      <li>לוח ההשראה, להעלות אליו תמונות</li>
      <li>וספר הפעלה קצר שמסביר איך הכל עובד</li>
    </ul>

    <a href="${opts.signInUrl}"
       style="display:inline-block;background:#0e1620;color:#fff;text-decoration:none;
              border-radius:999px;padding:14px 28px;font-size:15px;font-weight:600">
      ${buttonLabel}
    </a>

    <p style="margin:16px 0 0;font-size:13.5px;line-height:1.8;color:#5b697c">
      ${howItWorks} אין סיסמה לזכור. הכניסה תמיד עם הכתובת הזאת.
    </p>

    <hr style="margin:22px 0;border:0;border-top:1px solid #dbe2ec" />

    <p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#0e1620">
      שווה להתקין את זה בטלפון
    </p>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.8;color:#47566a">
      זה נפתח כמו אפליקציה רגילה, עם אייקון במסך הבית, ובלי להוריד כלום מחנות.
      לוקח פחות מדקה.
    </p>
    <a href="${opts.installUrl}"
       style="display:inline-block;border:1px solid #c4cedb;color:#0e1620;text-decoration:none;
              border-radius:999px;padding:11px 22px;font-size:14px;font-weight:600">
      איך מתקינים
    </a>
    ${opts.producerPhone ? `
    <p style="margin:22px 0 0;font-size:13.5px;line-height:1.8;color:#5b697c">
      שאלה בדרך? ${opts.producerName}, ${opts.producerPhone}.
    </p>` : ''}`, opts.brand);
}


/** The alert that a report from inside the platform sends to the account
 *  that answers them. Everything the reporter could not be asked to gather
 *  is already here: which screen, which browser, which business. */
export function supportTicketEmail(t: {
  id: string; category: string; body: string; route: string; agent: string;
  reporter: string; email: string; role: string; producer: string;
  screenshotUrl: string; consoleUrl: string;
}) {
  const category: Record<string, string> = {
    visual: 'באג ויזואלי', auth: 'תקלת התחברות', data: 'שגיאת נתונים', other: 'אחר',
  };
  const esc = (v: string) => v.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] ?? ch));
  return shell(`
    <h2 style="margin:0 0 4px;font-size:20px;color:#0b1220">דיווח על תקלה</h2>
    <p style="margin:0 0 16px;color:#6b7686;font-size:14px">${esc(category[t.category] ?? t.category)}</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.8;color:#0b1220;white-space:pre-wrap">${esc(t.body)}</p>
    <table style="width:100%;font-size:14px;border-collapse:collapse">
      ${row('דווח על ידי', esc(t.reporter))}${row('אימייל', esc(t.email))}${row('תפקיד', esc(t.role))}
      ${row('עסק', esc(t.producer))}
      ${row('מסך', `<span dir="ltr">${esc(t.route)}</span>`)}
      ${row('דפדפן', `<span dir="ltr" style="font-size:12.5px">${esc(t.agent)}</span>`)}
      ${t.screenshotUrl ? row('צילום מסך', `<a href="${t.screenshotUrl}" style="color:#a3814f">פתיחה</a>`) : ''}
    </table>
    <a href="${t.consoleUrl}"
       style="display:inline-block;margin-top:18px;background:#0e1620;color:#fff;text-decoration:none;
              border-radius:999px;padding:12px 24px;font-size:14px;font-weight:600">
      לרשימת הדיווחים
    </a>
    <p style="margin:14px 0 0;font-size:12px;color:#9aa4b2" dir="ltr">${esc(t.id)}</p>`);
}

/* ── the Sunday budget letter ────────────────────────────────────────────
   Hebrew, and the figures come already formatted so the sentence reads the
   same here as on the money screen. The flag goes first, before the good
   news, because the whole point of a weekly letter about money is that
   nobody drifts past the budget without it being named. */
const shekels = (n: number) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);
const heDate = (iso: string) =>
  new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', timeZone: 'Asia/Jerusalem' }).format(new Date(`${iso}T12:00:00Z`));

const AREA: Record<string, string> = {
  venue: 'אולם וקייטרינג', bar: 'בר ואלכוהול', photo: 'צילום ווידאו', music: 'מוזיקה', design: 'עיצוב ופרחים',
  look: 'לבוש, איפור ושיער', invites: 'הזמנות ואישורי הגעה', transport: 'הסעות', other: 'שונות', contingency: 'מרווח ביטחון',
};

export function budgetDigestEmail(opts: {
  eventName: string;
  week: import('../budgetPlan.ts').Weekly;
  url: string;
  brand?: MailBrand;
}) {
  const w = opts.week;
  const p = (t: string) => `<p style="margin:0 0 10px;font-size:15px;line-height:1.8;color:#47566a">${t}</p>`;
  const li = (t: string) => `<li>${t}</li>`;

  const flag = w.flagged.length === 0 ? '' : `
    <div style="margin:0 0 16px;padding:12px 14px;border-radius:12px;background:#fdecec;border:1px solid #f3b6b6">
      ${w.flagged.map((r) => `<p style="margin:0 0 6px;font-size:15px;line-height:1.7;color:#a12626"><b>חריגה: ${AREA[r.key]} ב-${r.pct - 100}% מעל המתוכנן.</b> נסגרו ${shekels(r.actual)} מול ${shekels(r.planned)} מתוכננים.</p>`).join('')}
      <p style="margin:6px 0 0;font-size:14.5px;line-height:1.7;color:#0e1620">${
        w.tradeOff
          ? `המלצה: לקצץ ב${AREA[w.tradeOff.cut]}, שם נשארו ${shekels(w.tradeOff.headroom)} לא מנוצלים.`
          : 'אין תחום עם מרווח לספוג את זה. או שהתקציב עולה, או שמורידים משהו שנסגר.'
      }</p>
    </div>`;

  const changes = w.added.length === 0 && w.paid.length === 0
    ? p('השבוע לא נוסף סעיף ולא נרשם תשלום.')
    : `<ul style="margin:0 0 14px;padding-inline-start:20px;font-size:15px;line-height:1.9;color:#47566a">
        ${w.added.map((a) => li(`נוסף <b>${a.label}</b> תחת ${AREA[a.category]}, ${shekels(a.amount)}.`)).join('')}
        ${w.paid.map((x) => li(`שולם <b>${x.title}</b>, ${shekels(x.amount)}, ב-${heDate(x.on)}.`)).join('')}
      </ul>`;

  const overall = w.overall.target && w.overall.pct !== null
    ? `התחייבויות של ${shekels(w.overall.committed)} מתוך ${shekels(w.overall.target)}, ${w.overall.pct}% מהתקציב.`
    : `התחייבויות של ${shekels(w.overall.committed)}. עוד לא נקבע תקציב יעד.`;
  const watch = w.watch ? `לשים עין על ${AREA[w.watch.key]}: ${w.watch.pct}% מהמתוכנן כבר נסגר.` : 'אין תחום שדורש עין השבוע.';
  const due = w.nextDue
    ? `התשלום הבא: ${w.nextDue.title}, ${shekels(w.nextDue.amount)}, עד ${heDate(w.nextDue.on)}.`
    : 'אין תשלום שמגיע בשלושים הימים הקרובים.';

  return shell(`
    <h2 style="margin:0 0 12px;font-size:20px;color:#0e1620">התקציב של ${opts.eventName}, השבוע</h2>
    ${flag}
    <p style="margin:0 0 6px;font-size:13px;letter-spacing:.06em;color:#8a97a8">מה השתנה</p>
    ${changes}
    <p style="margin:0 0 6px;font-size:13px;letter-spacing:.06em;color:#8a97a8">השורה התחתונה</p>
    <ol style="margin:0 0 18px;padding-inline-start:20px;font-size:15px;line-height:1.9;color:#0e1620">
      ${li(overall)}${li(watch)}${li(due)}
    </ol>
    <p style="margin:0"><a href="${opts.url}" style="display:inline-block;padding:10px 18px;border-radius:12px;background:#0e1620;color:#fff;text-decoration:none;font-size:14.5px">למעקב המלא</a></p>
  `, opts.brand);
}
