import { site } from '@/content/site';

const shell = (inner: string) => `
<div dir="rtl" style="font-family:Assistant,Heebo,Arial,sans-serif;background:#f4f8fd;padding:28px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:20px;padding:28px;border:1px solid #e6eef8">
    ${inner}
    <hr style="border:none;border-top:1px solid #eef2f7;margin:22px 0">
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
