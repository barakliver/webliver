import type { Task } from '@/components/app/TaskList';
import type { Payment } from '@/components/app/PaymentsPanel';
import type { BudgetItem } from '@/components/app/BudgetPanel';
import type { BoardImage } from '@/components/app/WinningBoard';
import type { Guest } from '@/components/app/GuestList';
import type { SeatTable, SeatGuest } from '@/components/app/SeatingPlan';
import type { DayItem } from '@/components/app/DaySchedule';
import type { Vendor as PortalVendor } from '@/lib/portal';
import type { Message } from '@/components/app/Thread';
import type { Contract } from '@/components/app/Contracts';
import type { EventFile } from '@/components/app/EventFiles';
import type { Song, Kit, Person } from '@/components/app/EventFileLists';
import type { ShopItem } from '@/components/marketing/Shop';
import { MUSIC_MOMENTS, EQUIPMENT_CHECK, COUPLE_DETAIL_FIELDS } from '@/content/eventFile';

/**
 * One invented event, for looking at screens without a database.
 *
 * The reason this exists: every screen inside `/app` is behind sign in and
 * reads from Supabase, so the only way to see one was to have an account, a
 * network and real data. That is fine for testing and useless for design work,
 * which is looking at a screen and deciding whether it holds together. Half of
 * this product's surface could not be looked at at all.
 *
 * Deliberately not tidy. A design reviewed against three neat rows tells you
 * nothing: the questions worth answering are what a long supplier name does to
 * a column, what an empty list looks like, what happens when a payment is
 * overdue and another is paid, and whether a panel with fourteen rows still
 * reads. So the fixtures carry the awkward cases on purpose.
 *
 * Nobody real is in here. Noa and Itai are the same invented couple the home
 * page shows on its phone mock, and the numbers are what an event of this size
 * actually looks like halfway through.
 */

/** Relative to today, so a fixture never quietly becomes a screen full of
 *  events from two years ago. */
const day = (offset: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const hoursAgo = (n: number): string => new Date(Date.now() - n * 3_600_000).toISOString();

export const FIXTURE_CLIENT = '00000000-0000-4000-8000-000000000001';
export const FIXTURE_VIEWER = '00000000-0000-4000-8000-0000000000aa';

export const fixtureTasks: Task[] = [
  { id: 't1', title: 'לסגור טעימות עם הקייטרינג', due_on: day(4), done: false, owner: 'producer', created_by: FIXTURE_VIEWER, visible_to_client: true },
  { id: 't2', title: 'לשלוח להפקה את רשימת האורחים המעודכנת', due_on: day(-3), done: false, owner: 'client', created_by: FIXTURE_VIEWER, visible_to_client: true },
  { id: 't3', title: 'לבחור שיר לכניסה לחופה', due_on: null, done: false, owner: 'client', created_by: null, visible_to_client: true },
  { id: 't4', title: 'תיאום סופי עם הצלם על שעת ההגעה והלוקיישן לצילומי המגזין', due_on: day(11), done: false, owner: 'producer', created_by: FIXTURE_VIEWER, visible_to_client: true },
  { id: 't5', title: 'לחתום על הסכם ההפקה', due_on: day(-20), done: true, owner: 'client', created_by: FIXTURE_VIEWER, visible_to_client: true },
  { id: 't6', title: 'מקדמה לאולם', due_on: day(-14), done: true, owner: 'client', created_by: FIXTURE_VIEWER, visible_to_client: true },
];

export const fixturePayments: Payment[] = [
  { id: 'p1', title: 'מקדמה', amount: 15000, due_on: day(-30), paid: true, paid_on: day(-29) },
  { id: 'p2', title: 'תשלום שני', amount: 40000, due_on: day(-2), paid: false, paid_on: null },
  { id: 'p3', title: 'יתרה, שבוע לפני', amount: 55000, due_on: day(23), paid: false, paid_on: null },
];

export const fixtureBudget: BudgetItem[] = [
  { id: 'b1', category: 'מקום', label: 'אולם וקייטרינג', estimate: 150000, agreed: 162000, vendor: 'גני ורדים' },
  { id: 'b2', category: 'צילום', label: 'צילום ווידאו', estimate: 14000, agreed: 13500, vendor: 'סטודיו לביא' },
  { id: 'b3', category: 'מוזיקה', label: 'דיג׳יי והגברה', estimate: 9000, agreed: null, vendor: '' },
  { id: 'b4', category: 'עיצוב', label: 'חופה, שולחנות ופרחים', estimate: 22000, agreed: 24800, vendor: 'סטודיו פרח לבן בע״מ' },
  { id: 'b5', category: 'בר', label: 'בר ואלכוהול', estimate: 18000, agreed: null, vendor: '' },
];

export const fixtureGuests: Guest[] = [
  { id: 'g1', full_name: 'משפחת כהן', side: 'כלה', phone: '0501234567', status: 'attending', party_size: 4, diet: 'צמחוני', note: '', invite_token: 'demo-1' },
  { id: 'g2', full_name: 'דוד ורונית לוי', side: 'חתן', phone: '0521234567', status: 'attending', party_size: 2, diet: '', note: 'כיסא לתינוק', invite_token: 'demo-2' },
  { id: 'g3', full_name: 'יעל מהעבודה', side: 'כלה', phone: '', status: 'pending', party_size: 1, diet: '', note: '', invite_token: 'demo-3' },
  { id: 'g4', full_name: 'אבי', side: 'חתן', phone: '0531234567', status: 'declined', party_size: 1, diet: '', note: '', invite_token: 'demo-4' },
  { id: 'g5', full_name: 'סבתא מרים ובני משפחתה מחיפה', side: 'כלה', phone: '', status: 'attending', party_size: 6, diet: 'ללא גלוטן', note: 'להושיב קרוב לחופה', invite_token: 'demo-5' },
];

export const fixtureTables: SeatTable[] = [
  { id: 'tb1', name: 'שולחן 1', seats: 12 },
  { id: 'tb2', name: 'שולחן 2', seats: 12 },
  { id: 'tb3', name: 'משפחה קרובה', seats: 8 },
];

export const fixtureSeatGuests: SeatGuest[] = [
  { id: 'g1', full_name: 'משפחת כהן', party_size: 4, status: 'attending', table_id: 'tb1' },
  { id: 'g2', full_name: 'דוד ורונית לוי', party_size: 2, status: 'attending', table_id: 'tb1' },
  { id: 'g5', full_name: 'סבתא מרים ובני משפחתה מחיפה', party_size: 6, status: 'attending', table_id: 'tb3' },
  { id: 'g3', full_name: 'יעל מהעבודה', party_size: 1, status: 'attending', table_id: null },
];

/* The suppliers as the couple sees them: two closed, one still open. */
const quiet = { deposit: null, deposit_paid_on: null, balance_due_on: null, last_contact_on: null, waiting_on: null, next_action: '' } as const;
export const fixturePortalVendors: PortalVendor[] = [
  { id: 'pv1', client_id: FIXTURE_CLIENT, name: 'קייטרינג השדה', category: 'catering', phone: '0544444444', status: 'booked', notes: '', ...quiet },
  { id: 'pv2', client_id: FIXTURE_CLIENT, name: 'DJ אורי', category: 'music', phone: '0522222222', status: 'booked', notes: 'איש קשר: אורי', ...quiet },
  { id: 'pv3', client_id: FIXTURE_CLIENT, name: 'סטודיו לביא', category: 'photo', phone: '0521111111', status: 'shortlist', notes: '', ...quiet },
];

export const fixtureDay: DayItem[] = [
  { id: 'd1', track: 'partner_a', at_time: '08:00', title: 'איפור ושיער', note: 'בבית, עם רותי', owner: 'רותי', audience: [], duration_min: 180, key_moment: false },
  { id: 'd2', track: 'partner_b', at_time: '11:30', title: 'הלבשה וצילומי הכנות', note: '', owner: '', audience: ['photo'], duration_min: 60, key_moment: false },
  { id: 'd3', track: 'shared', at_time: '17:00', title: 'הגעת הספקים לאולם', note: 'הגברה, תאורה, עיצוב', owner: 'ברק', audience: ['vendors', 'crew'], duration_min: 90, key_moment: false },
  { id: 'd4', track: 'shared', at_time: '19:30', title: 'קבלת פנים', note: '', owner: '', audience: [], duration_min: 90, key_moment: false },
  { id: 'd5', track: 'shared', at_time: '21:00', title: 'חופה', note: 'שקיעה ב-21:12', owner: 'ברק', audience: ['couple', 'photo', 'vendors'], duration_min: 35, key_moment: true },
  { id: 'd6', track: 'shared', at_time: '22:15', title: 'ריקוד ראשון', note: '', owner: '', audience: ['couple', 'photo'], duration_min: 10, key_moment: true },
  { id: 'd7', track: 'shared', at_time: '01:30', title: 'סיום, פירוק והובלה', note: '', owner: 'צוות', audience: ['crew'], duration_min: 90, key_moment: false },
];

export const fixtureMessages: Message[] = [
  { id: 'm1', author_id: 'producer', body: 'שלחתי לכם את ההסכם לחתימה. תעברו עליו ותגידו לי אם משהו לא ברור.', created_at: hoursAgo(52), author_name: 'ברק ליור', author_avatar: null },
  { id: 'm2', author_id: FIXTURE_VIEWER, body: 'קראנו, הכל ברור. חתמנו.', created_at: hoursAgo(50), author_name: 'נועה', author_avatar: null },
  { id: 'm3', author_id: 'producer', body: 'מעולה. הטעימות אצל הקייטרינג ביום שלישי ב-18:00, נתראה שם.', created_at: hoursAgo(3), author_name: 'ברק ליור', author_avatar: null },
];

export const fixtureContracts: Contract[] = [
  {
    id: 'k1', title: 'הסכם הפקת חתונה', amount: 110000, status: 'signed',
    body: 'ההפקה כוללת ליווי מלא מהפגישה הראשונה ועד סוף האירוע, ניהול הספקים, בניית הלוז וניהול יום האירוע.',
    file_path: null, file_url: null, signed_at: hoursAgo(49), signed_name: 'נועה כהן', intact: true,
  },
  {
    id: 'k2', title: 'הסכם דיג׳יי', amount: 9000, status: 'sent',
    body: 'הגברה, תאורת רחבה ודיג׳יי לכל הערב.', party_name: 'אלון מזרחי', party_role: 'דיג׳יי',
    file_path: null, file_url: null, signed_at: null, signed_name: null, intact: true,
  },
];

export const fixtureFiles: EventFile[] = [
  { id: 'f1', name: 'הזמנה-סופית.pdf', note: 'הגרסה שיצאה לדפוס', tag: '', mime: 'application/pdf', size_bytes: 840_000, created_at: hoursAgo(70), uploader: 'נועה', mine: true, url: '#' },
  { id: 'f2', name: 'תוכנית-אולם.xlsx', note: '', tag: '', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size_bytes: 62_000, created_at: hoursAgo(30), uploader: 'ברק ליור', mine: false, url: '#' },
];

/* Pictures for the vault: inline SVG data addresses, so the harness needs no
   bucket and no network. Four tags and one untagged, which is what a real
   folder looks like after a site visit. */
const swatch = (a: string, b: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/></svg>`,
  )}`;

export const fixtureMedia: EventFile[] = [
  { id: 'm1', name: 'האולם-מהכניסה.jpg', note: 'הכניסה הראשית, שעת שקיעה', tag: 'venue', mime: 'image/jpeg', size_bytes: 2_400_000, created_at: hoursAgo(90), uploader: 'ברק ליור', mine: false, url: swatch('#c9b79c', '#7a6a55') },
  { id: 'm2', name: 'שולחן-ראשי.jpg', note: '', tag: 'design', mime: 'image/jpeg', size_bytes: 1_900_000, created_at: hoursAgo(80), uploader: 'נועה', mine: true, url: swatch('#e8dccb', '#b89b7a') },
  { id: 'm3', name: 'חופה-השראה.png', note: 'משהו בכיוון הזה, בלי הפרחים הכחולים', tag: 'inspiration', mime: 'image/png', size_bytes: 980_000, created_at: hoursAgo(60), uploader: 'נועה', mine: true, url: swatch('#d9e2dc', '#6f8a7c') },
  { id: 'm4', name: 'הצעת-מחיר-פרחים.jpg', note: '', tag: 'vendors', mime: 'image/jpeg', size_bytes: 1_200_000, created_at: hoursAgo(40), uploader: 'ברק ליור', mine: false, url: swatch('#f0e6e0', '#a07c74') },
  { id: 'm5', name: 'IMG_4412.jpg', note: '', tag: '', mime: 'image/jpeg', size_bytes: 3_100_000, created_at: hoursAgo(5), uploader: 'נועה', mine: true, url: swatch('#e6e9ee', '#7d8794') },
];

export const fixtureSongs: Song[] = [
  { moment: MUSIC_MOMENTS[0], song: 'Here Comes The Sun', artist: 'The Beatles', note: '' },
  { moment: MUSIC_MOMENTS[1], song: 'שיר אהבה', artist: 'שלמה ארצי', note: 'להתחיל מהפזמון' },
];

export const fixtureKit: Kit[] = [
  { item: EQUIPMENT_CHECK[0], needed: true, sorted: true },
  { item: EQUIPMENT_CHECK[1], needed: true, sorted: false },
  { item: EQUIPMENT_CHECK[3], needed: false, sorted: false },
];

export const fixturePeople: Person[] = [
  { person: 'a', name: 'נועה', fields: { [COUPLE_DETAIL_FIELDS[0]]: 'מרים ויוסי', [COUPLE_DETAIL_FIELDS[2]]: 'אספרסו כפול' } },
  { person: 'b', name: 'איתי', fields: {} },
];

export const fixtureBoard: BoardImage[] = [];

/** The shopfront, with the portfolio's own photographs standing in for product
 *  images so the cards can be looked at without a storage bucket. */
export const fixtureShopItems: ShopItem[] = [
  {
    id: 's1', kind: 'service', name: 'חבילת בר מלא',
    blurb: 'ברמנים, קרח, כלים ואלכוהול לכל הערב.',
    body: 'התמחור לפי מספר האורחים בפועל. כולל הקמה ופירוק.',
    price: 18000, image: '/portfolio/venue-9-w1400.webp',
  },
  {
    id: 's2', kind: 'service', name: 'עיצוב חופה',
    blurb: 'פרחים טריים, בנייה והתקנה ביום האירוע.',
    body: '', price: 6800, image: '/portfolio/dsc-8047-w1400.webp',
  },
  {
    id: 's3', kind: 'product', name: 'ערכת קבלת פנים',
    blurb: 'שילוט, סידורי שולחן וספר ברכות תואמים.',
    body: '', price: 1450, image: '/portfolio/chuppah-50-w1400.webp',
  },
];

/* ── The producer's own screens ─────────────────────────────────────────── */

import type { ClientStatus } from '@/lib/status';
import type { AttentionItem } from '@/lib/attention';
import type { Shelf } from '@/lib/archive';
import type { Order } from '@/components/app/OrdersBoard';
import type { CrewMember } from '@/components/app/CrewPanel';
import type { Lead, Call } from '@/components/app/LeadRow';
import type { Vendor } from '@/components/app/VendorDirectory';

export const fixtureStatus: ClientStatus[] = [
  {
    id: FIXTURE_CLIENT, name: 'נועה ואיתי', kind: 'wedding', eventDate: day(45),
    venue: 'גני ורדים', guestEstimate: 340, archivedAt: null, daysLeft: 45,
    gaps: [
      { code: 'runsheet', label: 'אין לוז ליום האירוע', level: 'now' },
      { code: 'seating', label: 'ההושבה עוד לא התחילה', level: 'soon' },
    ],
    nextTask: { title: 'לסגור טעימות עם הקייטרינג', dueOn: day(4) },
    guests: { invited: 340, attending: 218 },
    money: { owed: 95000, overdue: 40000 },
    needsClosing: false, color: null,
  },
  {
    id: '00000000-0000-4000-8000-000000000002', name: 'שיר ותומר', kind: 'wedding', eventDate: day(160),
    venue: '', guestEstimate: null, archivedAt: null, daysLeft: 160,
    gaps: [], nextTask: null,
    guests: { invited: 0, attending: 0 },
    money: { owed: 0, overdue: 0 },
    needsClosing: false, color: null,
  },
  {
    id: '00000000-0000-4000-8000-000000000003', name: 'ערב חברה, לקוח עסקי עם שם ארוך במיוחד בע״מ', kind: 'corporate',
    eventDate: day(-6), venue: 'חוף הצוק', guestEstimate: 120, archivedAt: null, daysLeft: -6,
    gaps: [], nextTask: null,
    guests: { invited: 120, attending: 104 },
    money: { owed: 12000, overdue: 12000 },
    needsClosing: true, color: null,
  },
];

export const fixtureAttention: AttentionItem[] = [
  { id: 'a1', kind: 'payment', title: 'תשלום שני של נועה ואיתי באיחור', detail: 'ארבעים אלף שקלים, היה אמור להיסגר שלשום', href: '#', urgency: 'now', rank: 0 },
  { id: 'a2', kind: 'gap', title: 'אין לוז ליום האירוע של נועה ואיתי', detail: '45 ימים לאירוע', href: '#', urgency: 'now', rank: 1 },
  { id: 'a3', kind: 'lead', title: 'ליד חדש מהאתר: רוני ועומר', detail: 'חתונה, קיץ הבא, עוד לא חזרו אליהם', href: '#', urgency: 'soon', rank: 2 },
  { id: 'a4', kind: 'task', title: 'תיאום סופי עם הצלם', detail: 'בעוד 11 ימים', href: '#', urgency: 'soon', rank: 3 },
];

export const fixtureOrders: Order[] = [
  {
    id: 'o1', number: 'LP-2026-014', buyer_name: 'רוני אזולאי', buyer_phone: '0521111111',
    buyer_email: 'roni@example.com', total: 24800, status: 'pending', note: '',
    created_at: hoursAgo(4),
    items: [{ id: 'ol1', line: 1, name: 'חבילת בר מלא', qty: 1, price: 18000 }, { id: 'ol2', line: 2, name: 'עיצוב חופה', qty: 1, price: 6800 }],
  },
  {
    id: 'o2', number: 'LP-2026-013', buyer_name: 'משפחת פרץ', buyer_phone: '0532222222',
    buyer_email: '', total: 1450, status: 'paid', note: 'שולם בהעברה',
    created_at: hoursAgo(30),
    items: [{ id: 'ol3', line: 1, name: 'ערכת קבלת פנים', qty: 1, price: 1450 }],
  },
  {
    id: 'o3', number: 'LP-2026-012', buyer_name: 'דנה', buyer_phone: '',
    buyer_email: 'dana@example.com', total: 6800, status: 'draft', note: '',
    created_at: hoursAgo(80),
    items: [{ id: 'ol4', line: 1, name: 'עיצוב חופה', qty: 1, price: 6800 }],
  },
];

export const fixtureShelf: Shelf[] = [
  {
    year: 2025,
    events: [
      {
        client_id: 'ar1', event_year: 2025, event_date: '2025-09-04', display_name: 'מאיה ועידו',
        venue: 'אחוזת רונית', guests_final: 280,
        money: { budget: 240000, paid: 240000 },
        vendors: [{ name: 'סטודיו לביא', category: 'צילום' }, { name: 'אלון מזרחי', category: 'דיג׳יי' }],
        crew: [{ name: 'רותם', role: 'מנהלת אירוע' }],
        runsheet: [{ at: '20:30', title: 'חופה' }],
        note: 'ירד גשם בערב, הועבר הכל פנימה בשעה', closed_at: '2025-09-10T10:00:00Z',
      },
      {
        client_id: 'ar2', event_year: 2025, event_date: '2025-06-19', display_name: 'הילה ורועי',
        venue: 'שדה ורד', guests_final: 195,
        money: { budget: 185000, paid: 185000 },
        vendors: [], crew: [], runsheet: [],
        note: '', closed_at: '2025-06-25T10:00:00Z',
      },
    ],
  },
];

export const fixtureCrew: CrewMember[] = [
  { id: 'c1', name: 'רותם ברזילי', role: 'מנהלת אירוע', phone: '0543333333', call_time: '15:00', fee: 1800, notes: '' },
  { id: 'c2', name: 'עידן', role: 'לוגיסטיקה', phone: '', call_time: null, fee: null, notes: 'מגיע עם הטנדר' },
];

export const fixtureLeads: Lead[] = [
  {
    id: 'l1', full_name: 'רוני ועומר', email: 'roni@example.com', phone: '0521111111',
    kind: 'wedding', event_date: day(300), guest_count: 250, location: 'שרון',
    message: 'מתחתנים בקיץ הבא, מחפשים הפקה מלאה לחתונת שטח באזור המרכז.',
    note: '', status: 'new', created_at: hoursAgo(6), source: 'site',
  },
  {
    id: 'l2', full_name: 'חברת אופק אנרגיה', email: 'events@ofek.example', phone: '036666666',
    kind: 'corporate', event_date: null, guest_count: null,
    message: 'ערב חברה לסוף השנה.', note: 'חזרו אליהם, ממתינים לתקציב',
    status: 'contacted', created_at: hoursAgo(120), source: 'referral',
  },
];

export const fixtureCalls: Call[] = [
  { id: 'call1', lead_id: 'l1', title: 'שיחת היכרות', remind_on: day(1), done: false },
];

export const fixtureVendors: Vendor[] = [
  { id: 'v1', name: 'סטודיו לביא', category: 'צילום', contact_name: 'אורי לביא', phone: '0544444444', email: 'uri@example.com', area: 'מרכז', notes: 'עובדים איתו קבוע', archived_at: null, agreed_price: 14000, deposit_paid: 4000 },
  { id: 'v2', name: 'אלון מזרחי', category: 'מוזיקה', contact_name: '', phone: '0525555555', email: '', area: 'כל הארץ', notes: '', archived_at: null, agreed_price: null, deposit_paid: null },
  { id: 'v3', name: 'פרח לבן', category: 'עיצוב', contact_name: 'נטע', phone: '', email: 'neta@example.com', area: 'שרון', notes: '', archived_at: '2026-01-01T00:00:00Z', agreed_price: 6500, deposit_paid: 0 },
];

/* ── The screens added in the second sweep ─────────────────────────────── */

import type { Anniversary } from '@/components/app/Anniversaries';
import type { EventSummary } from '@/lib/eventSummary';
import type { Funnel, SourceRow, Response, Cash } from '@/lib/analytics';
import type { ReferralRow } from '@/components/app/Referrals';
import type { Template } from '@/components/app/WorkflowTemplates';
import type { VenueRow } from '@/components/app/VenueCompare';
import type { MeetingLog } from '@/components/app/MeetingDrawer';
import type { MeetingTemplate } from '@/content/meetings';
import type { Line, Caller } from '@/lib/dayof';

export const fixtureAnniversaries: Anniversary[] = [
  {
    id: 'an1', clientId: FIXTURE_CLIENT, milestone: 'week', dueOn: day(4),
    eventDate: day(-361), couple: 'רותם ועידו', daysAway: 4,
    emails: ['rotem@example.com'],
  },
  {
    id: 'an2', clientId: '00000000-0000-4000-8000-000000000002', milestone: 'month', dueOn: day(19),
    eventDate: day(-346), couple: 'שיר ותומר', daysAway: 19, emails: [],
  },
];

export const fixtureEventSummary: EventSummary = {
  guests: { total: 214, confirmed: 141, pending: 58, declined: 15, seats: 132 },
  money: { paid: 96000, owed: 64000, overdue: 12000 },
  tasksOpen: 9,
  dayLines: 34,
  contracts: { total: 6, signed: 4 },
  next: [
    { id: 'n1', kind: 'payment', title: 'מקדמה לאולם, פעימה שנייה', due: day(-2), amount: 12000 },
    { id: 'n2', kind: 'task', title: 'סגירת תפריט סופי מול הקייטרינג', due: day(1) },
    { id: 'n3', kind: 'task', title: 'אישור נוסח הזמנה לדפוס', due: day(3) },
    { id: 'n4', kind: 'payment', title: 'צלם, תשלום שני', due: day(6), amount: 7000 },
  ],
};

export const fixtureFunnel: Funnel = {
  total: 38,
  steps: [
    { key: 'leads', count: 38, rate: null },
    { key: 'contacted', count: 29, rate: 76.3 },
    { key: 'meeting', count: 14, rate: 48.3 },
    { key: 'won', count: 8, rate: 57.1 },
  ],
};

export const fixtureSources: SourceRow[] = [
  { source: 'site', leads: 17, won: 4, rate: 23.5 },
  { source: 'ai_concierge', leads: 9, won: 2, rate: 22.2 },
  { source: 'referral', leads: 8, won: 2, rate: 25 },
  { source: 'unknown', leads: 4, won: 0, rate: 0 },
];

export const fixtureResponse: Response = { medianHours: 3, answered: 31, waiting: 4 };

export const fixtureCash: Cash = { collected: 312000, due: 148000, overdue: 19000, overdueCount: 2 };

export const fixtureReferrals: ReferralRow[] = [
  {
    producer_id: 'p1', brand: 'הפקות הצפון', referral_code: 'north1', referred_by: null,
    referred_brand: null, invited_total: 3, clients_total: 12,
  },
  {
    producer_id: 'p2', brand: 'אירועי שקד', referral_code: 'shaked', referred_by: 'p1',
    referred_brand: 'הפקות הצפון', invited_total: 0, clients_total: 5,
  },
];

export const fixtureTemplates: Template[] = [
  {
    id: 'tp1', name: 'חתונה, שנה מראש', kind: 'wedding', created_at: hoursAgo(2000),
    steps: [
      { title: 'פגישת היכרות וסגירת חוזה', offset_days: -365, owner: 'producer' },
      { title: 'סגירת אולם ותאריך', offset_days: -300, owner: 'producer' },
      { title: 'בחירת צלם ולהקה', offset_days: -240, owner: 'client', note: 'שווה לראות אותם באירוע חי' },
      { title: 'הזמנות לדפוס', offset_days: -90, owner: 'client' },
      { title: 'ספירת אורחים סופית', offset_days: -14, owner: 'producer' },
    ],
  },
  {
    id: 'tp2', name: 'אירוע עסקי, רבעון מראש', kind: 'corporate', created_at: hoursAgo(900),
    steps: [
      { title: 'אישור תקציב מול הנהלה', offset_days: -90, owner: 'client' },
      { title: 'סגירת מקום ותאריך', offset_days: -75, owner: 'producer' },
      { title: 'תוכן ולוח זמנים', offset_days: -30, owner: 'producer' },
    ],
  },
];

export const fixtureMeetings: MeetingLog[] = [
  {
    id: 'mt1', kind: 'production', template_id: null, title: 'פגישת הפקה', held_on: day(-12),
    answers: { guests_final: 214, arrive_from: '19:00', chuppah_at: '20:30' },
    summary: 'עוברים על הלוז המלא. החופה הוקדמה לחצי שמונה בגלל השקיעה, והוחלט על קבלת פנים בחוץ.',
    summary_by: 'person', visible_to_client: true, updated_at: hoursAgo(280),
  },
  {
    id: 'mt2', kind: 'tasting', template_id: null, title: 'טעימות', held_on: null,
    answers: {}, summary: '', summary_by: 'none', visible_to_client: false, updated_at: hoursAgo(4),
  },
  /* Written from the producer's own template below, so the drawer's second
     row of buttons and its pointer both get exercised. */
  {
    id: 'mt3', kind: 'custom', template_id: 'mtp1', title: 'שיחה ראשונה בטלפון', held_on: day(-200),
    answers: { names: 'מאיה ועידו', guests: 180, style: 'שקט, בחוץ, בלי הפתעות' },
    summary: 'מי אתם\nשמות: מאיה ועידו\n\nהאירוע\nכמה אורחים בערך: 180\nאיך זה אמור להרגיש: שקט, בחוץ, בלי הפתעות',
    summary_by: 'person', visible_to_client: false, updated_at: hoursAgo(4800),
  },
];

/* The producer's own meeting forms: one live, one archived because a log
   still points at it. */
export const fixtureMeetingTemplates: MeetingTemplate[] = [
  {
    kind: 'custom', id: 'mtp1', title: 'שיחה ראשונה בטלפון', when: 'לפני שסוגרים', offsetDays: null,
    blurb: 'עשר דקות. מי הם ומה הם רוצים.',
    sections: [
      { title: 'מי אתם', fields: [
        { id: 'names', label: 'שמות', kind: 'text' },
        { id: 'heard', label: 'איך הגעתם', kind: 'choice', options: ['המלצה', 'אינסטגרם', 'אולם'] },
      ] },
      { title: 'האירוע', fields: [
        { id: 'guests', label: 'כמה אורחים בערך', kind: 'number' },
        { id: 'booked', label: 'האולם סגור', kind: 'yesno' },
        { id: 'style', label: 'איך זה אמור להרגיש', kind: 'long', hint: 'במשפט' },
      ] },
    ],
  },
  {
    kind: 'custom', id: 'mtp2', title: 'סיור באולם', when: 'לפני שחותמים', offsetDays: null, blurb: '',
    sections: [{ title: '', fields: [{ id: 'q1', label: 'מה ראינו', kind: 'long' }] }],
    archived: true,
  },
];

/* The cockpit's evening: the event is "today", one line done, one running
   over, a key moment ahead, and the night crossing midnight. */
export const fixtureDayLines: Line[] = [
  { id: 'dl1', at_time: '17:00', title: 'הגעת ספקים ופריקה', duration_min: 90, done_at: hoursAgo(2), key_moment: false },
  { id: 'dl2', at_time: '19:00', title: 'קבלת פנים', duration_min: 90, done_at: null, key_moment: false },
  { id: 'dl3', at_time: '20:30', title: 'חופה', duration_min: 35, done_at: null, key_moment: true },
  { id: 'dl4', at_time: '21:30', title: 'ישיבה לארוחה', duration_min: 60, done_at: null, key_moment: false },
  { id: 'dl5', at_time: '23:00', title: 'רחבה', duration_min: 120, done_at: null, key_moment: false },
  { id: 'dl6', at_time: '01:00', title: 'סיום ופינוי', duration_min: 60, done_at: null, key_moment: false },
];

export const fixtureDayCrew: Caller[] = [
  { id: 'cc1', name: 'עמית שלו', role: 'מנהל שטח', phone: '+972521111111', call_time: '15:00', kind: 'crew', arrived_at: hoursAgo(3) },
  { id: 'cc2', name: 'דנה בר', role: 'מלווה זוג', phone: '+972522222222', call_time: '18:00', kind: 'crew', arrived_at: null },
];

export const fixtureDayVendors: Caller[] = [
  { id: 'cv1', name: 'הגברה ותאורה, צליל', role: 'הגברה', phone: '+972533333333', call_time: '16:00', kind: 'vendor', arrived_at: null },
  { id: 'cv2', name: 'קייטרינג השדה', role: 'קייטרינג', phone: '+972544444444', call_time: '16:30', kind: 'vendor', arrived_at: hoursAgo(1) },
];

import type { SheetGuest, SheetTable, SheetMoment, SheetArrival } from '@/components/app/NumbersSheet';

/* The numbers sheet: enough shape to exercise every section - special meals,
   a table over capacity, guests still unseated, and a mixed arrivals clock. */
export const fixtureSheetGuests: SheetGuest[] = [
  { id: 'sg1', full_name: 'משפחת כהן', status: 'attending', party_size: 4, diet: 'none', table_id: 'st1' },
  { id: 'sg2', full_name: 'רות ואבנר לוי', status: 'attending', party_size: 2, diet: 'vegetarian', table_id: 'st1' },
  { id: 'sg3', full_name: 'יעל ברק', status: 'attending', party_size: 1, diet: 'vegan', table_id: 'st2' },
  { id: 'sg4', full_name: 'החברים מהצבא', status: 'attending', party_size: 6, diet: 'none', table_id: 'st2' },
  { id: 'sg5', full_name: 'סבתא רחל', status: 'attending', party_size: 1, diet: 'gluten_free', table_id: null },
  { id: 'sg6', full_name: 'משפחת אזולאי', status: 'attending', party_size: 5, diet: 'kosher', table_id: null },
  { id: 'sg7', full_name: 'דוד ממילואים', status: 'pending', party_size: 2, diet: 'none', table_id: null },
  { id: 'sg8', full_name: 'שכנים מהבניין', status: 'declined', party_size: 2, diet: 'none', table_id: null },
];

export const fixtureSheetTables: SheetTable[] = [
  { id: 'st1', name: 'שולחן משפחה', seats: 10 },
  { id: 'st2', name: 'שולחן חברים', seats: 8 },
  { id: 'st3', name: 'שולחן עבודה', seats: 10 },
];

export const fixtureSheetMoments: SheetMoment[] = [
  { id: 'sm1', at_time: '19:00', title: 'קבלת פנים', key_moment: false },
  { id: 'sm2', at_time: '20:30', title: 'חופה', key_moment: true },
  { id: 'sm3', at_time: '21:30', title: 'ישיבה לארוחה', key_moment: true },
  { id: 'sm4', at_time: '01:00', title: 'סיום ופינוי', key_moment: true },
];

export const fixtureSheetArrivals: SheetArrival[] = [
  { id: 'sa1', name: 'עמית שלו', role: 'מנהל שטח', call_time: '15:00' },
  { id: 'sa2', name: 'הגברה ותאורה, צליל', role: 'הגברה', call_time: '16:00' },
  { id: 'sa3', name: 'קייטרינג השדה', role: 'קייטרינג', call_time: '16:30' },
  { id: 'sa4', name: 'דנה בר', role: 'מלווה זוג', call_time: '18:00' },
];

/* The prep sheet. Two faces and three references, which is roughly what an
   event has a fortnight out — enough that the grid has to hold together and
   few enough that the empty state is one click away. */
export const fixtureVips = [
  /* Pictures drawn rather than fetched. The first version of this fixture had
     a null image everywhere, which showed the reference grid as a row of empty
     boxes and invited a design decision about a state the column cannot be in.
     One face is deliberately left without a photograph, because that one is
     real: a name can be added before anybody has found a picture of her. */
  { id: 'v1', name: 'סבתא מרים', relation: 'סבתא של הכלה', note: 'לצלם איתה בכניסה לחופה, היא לא נשארת עד הסוף', url: 'data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%27240%27%20height=%27240%27%3E%3Cdefs%3E%3ClinearGradient%20id=%27g%27%20x1=%270%27%20y1=%270%27%20x2=%271%27%20y2=%271%27%3E%3Cstop%20offset=%270%27%20stop-color=%27%23e7ddd0%27/%3E%3Cstop%20offset=%271%27%20stop-color=%27%23a98f6d%27/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width=%27240%27%20height=%27240%27%20fill=%27url(%23g)%27/%3E%3C/svg%3E' },
  { id: 'v2', name: 'דוד אריק', relation: 'דוד של החתן', note: '', url: null },
  { id: 'v3', name: 'נועה בן דוד', relation: 'שושבינה', note: 'מחזיקה את הטבעות', url: 'data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%27240%27%20height=%27240%27%3E%3Cdefs%3E%3ClinearGradient%20id=%27g%27%20x1=%270%27%20y1=%270%27%20x2=%271%27%20y2=%271%27%3E%3Cstop%20offset=%270%27%20stop-color=%27%23dfe3ea%27/%3E%3Cstop%20offset=%271%27%20stop-color=%27%238b97ab%27/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width=%27240%27%20height=%27240%27%20fill=%27url(%23g)%27/%3E%3C/svg%3E' },
];

export const fixtureLooks = [
  { id: 'l1', category: 'hair' as const, note: 'אסוף נמוך', url: 'data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%27240%27%20height=%27240%27%3E%3Cdefs%3E%3ClinearGradient%20id=%27g%27%20x1=%270%27%20y1=%270%27%20x2=%271%27%20y2=%271%27%3E%3Cstop%20offset=%270%27%20stop-color=%27%23c9b8a4%27/%3E%3Cstop%20offset=%271%27%20stop-color=%27%238a6136%27/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width=%27240%27%20height=%27240%27%20fill=%27url(%23g)%27/%3E%3C/svg%3E' },
  { id: 'l2', category: 'hair' as const, note: '', url: 'data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%27240%27%20height=%27240%27%3E%3Cdefs%3E%3ClinearGradient%20id=%27g%27%20x1=%270%27%20y1=%270%27%20x2=%271%27%20y2=%271%27%3E%3Cstop%20offset=%270%27%20stop-color=%27%23e3d9cb%27/%3E%3Cstop%20offset=%271%27%20stop-color=%27%23b09777%27/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width=%27240%27%20height=%27240%27%20fill=%27url(%23g)%27/%3E%3C/svg%3E' },
  { id: 'l3', category: 'makeup' as const, note: 'טבעי, בלי נצנצים', url: 'data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%27240%27%20height=%27240%27%3E%3Cdefs%3E%3ClinearGradient%20id=%27g%27%20x1=%270%27%20y1=%270%27%20x2=%271%27%20y2=%271%27%3E%3Cstop%20offset=%270%27%20stop-color=%27%23e8d6d0%27/%3E%3Cstop%20offset=%271%27%20stop-color=%27%23c08d80%27/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width=%27240%27%20height=%27240%27%20fill=%27url(%23g)%27/%3E%3C/svg%3E' },
  { id: 'l4', category: 'outfit' as const, note: 'לשושבינות', url: 'data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%27240%27%20height=%27240%27%3E%3Cdefs%3E%3ClinearGradient%20id=%27g%27%20x1=%270%27%20y1=%270%27%20x2=%271%27%20y2=%271%27%3E%3Cstop%20offset=%270%27%20stop-color=%27%23d6dcd8%27/%3E%3Cstop%20offset=%271%27%20stop-color=%27%237e938a%27/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width=%27240%27%20height=%27240%27%20fill=%27url(%23g)%27/%3E%3C/svg%3E' },
];

export const fixtureShares = [
  { id: 's1', token: 'aaaaaaaabbbbbbbbccccccccdddddddd', scope: 'faces' as const,
    label: 'סטודיו לביא', expiresAt: '2026-12-01', revokedAt: null },
];

/* Four halls, which is what a couple has toured by the time this screen is
   worth opening. Deliberately quoted four different ways: one before VAT with
   a flat bar, one after VAT with the bar per head, one that leaves sound and
   lighting to the DJ, and one that is dearer per plate and cheaper in total.
   That last one is the whole point of the screen. */
export const fixtureVenues: VenueRow[] = [
  {
    id: 'h1', venueName: 'אחוזת הכפר', location: 'שרון',
    platePrice: 320, isVatIncluded: false,
    barCost: 22000, barType: 'flat',
    soundLightingCost: 14000, ancillaryFees: 9000,
    servicePercent: 0, serviceFlat: 6000, contingencyPercent: 10,
    prosCons: ['licence', 'kosher', 'parking', 'suite'],
    quotePath: '', isSelected: false,
    contact: 'מירב', phone: '0521111111', touredOn: '2026-07-14',
    notes: 'אקוסטיקה טובה, חניה צמודה. גמישים עד 01:00 בתוספת תשלום.',
  },
  {
    id: 'h2', venueName: 'בית הבאר', location: 'מרכז',
    platePrice: 401, isVatIncluded: true,
    barCost: 95, barType: 'per_person',
    soundLightingCost: 0, ancillaryFees: 6500,
    servicePercent: 12, serviceFlat: 0, contingencyPercent: 10,
    prosCons: ['licence', 'volume', 'accessible'],
    quotePath: '', isSelected: false,
    contact: 'אבי', phone: '0522222222', touredOn: '2026-07-28',
    notes: 'הגברה ותאורה דרך הדיג׳יי שלנו. מגבילים ווליום אחרי 23:00.',
  },
  {
    id: 'h3', venueName: 'הגן הצפוני', location: 'צפון',
    platePrice: 270, isVatIncluded: false,
    barCost: 18000, barType: 'flat',
    soundLightingCost: 21000, ancillaryFees: 15500,
    servicePercent: 10, serviceFlat: 0, contingencyPercent: 15,
    prosCons: ['kosher', 'generator', 'parking'],
    quotePath: '', isSelected: false,
    contact: 'תמר', phone: '0523333333', touredOn: '2026-08-09',
    notes: 'המנה הכי זולה מהארבע. הנלוות מכסות ניקיון, אבטחה וחימום.',
  },
  {
    id: 'h4', venueName: 'טרסה', location: 'ירושלים והסביבה',
    platePrice: 355, isVatIncluded: false,
    barCost: 70, barType: 'per_person',
    soundLightingCost: 9000, ancillaryFees: 4000,
    servicePercent: 0, serviceFlat: 4500, contingencyPercent: 10,
    prosCons: ['licence', 'kosher', 'suite', 'accessible', 'generator'],
    quotePath: '', isSelected: false,
    contact: 'יונתן', phone: '0524444444', touredOn: '2026-08-21',
    notes: '',
  },
];
