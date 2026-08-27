import { site, PROMISE } from '@/content/site';

const shell = (inner: string) => `
<div dir="rtl" style="font-family:Assistant,Heebo,Arial,sans-serif;background:#f4f8fd;padding:28px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:20px;padding:28px;border:1px solid #e6eef8">
    ${inner}
    <hr style="border:none;border-top:1px solid #eef2f7;margin:22px 0">
    <!-- The line, once, at the foot of every letter this business sends. In
         the accent and tracked open, so it reads as a signature rather than as
         another line of small print. Above the name, because it is what the
         name is for. -->
    <p style="margin:0 0 6px;color:#a3814f;font-size:12px;font-weight:600;letter-spacing:.14em">${PROMISE}</p>
    <p style="color:#6b7686;font-size:12.5px;margin:0">${site.brand} · ${site.tagline}</p>
  </div>
</div>`;

const row = (k: string, v: string) =>
  v ? `<tr><td style="padding:5px 0;color:#6b7686;width:120px">${k}</td><td style="padding:5px 0;color:#0b1220">${v}</td></tr>` : '';

export type LeadPayload = {
  full_name: string; email: string; phone: string;
  kind: string; event_date: string; guest_count: string; message: string;
};

export function adminLeadEmail(l: LeadPayload) {
  return shell(`
    <h2 style="margin:0 0 4px;font-size:20px;color:#0b1220">פנייה חדשה מהאתר</h2>
    <p style="margin:0 0 16px;color:#6b7686;font-size:14px">התקבלה דרך טופס יצירת הקשר</p>
    <table style="width:100%;font-size:14.5px;border-collapse:collapse">
      ${row('שם', l.full_name)}${row('טלפון', l.phone)}${row('אימייל', l.email)}
      ${row('סוג האירוע', l.kind === 'corporate' ? 'אירוע עסקי' : 'חתונה')}
      ${row('תאריך', l.event_date)}${row('אורחים', l.guest_count)}
      ${row('הודעה', l.message)}
    </table>`);
}

export function clientConfirmEmail(name: string) {
  return shell(`
    <h2 style="margin:0 0 10px;font-size:20px;color:#0b1220">תודה ${name}, קיבלנו את הפרטים</h2>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.8;color:#3c4657">
      הפנייה שלכם הגיעה לברק והוא יחזור אליכם בדרך כלל תוך יום עסקים.
    </p>
    <p style="margin:0;font-size:15px;line-height:1.8;color:#3c4657">
      בינתיים, אם יש משהו דחוף אפשר פשוט להשיב למייל הזה.
    </p>`);
}

export function adminLeadWhatsApp(l: LeadPayload) {
  return [
    'פנייה חדשה מהאתר',
    `שם: ${l.full_name}`,
    l.phone ? `טלפון: ${l.phone}` : '',
    l.email ? `אימייל: ${l.email}` : '',
    `סוג: ${l.kind === 'corporate' ? 'אירוע עסקי' : 'חתונה'}`,
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
    </p>` : ''}`);
}

