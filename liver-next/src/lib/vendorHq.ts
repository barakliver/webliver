/**
 * Every supplier on one event, with an honest status.
 *
 * One row per supplier: contract, deposit, balance, when we last spoke,
 * whose turn it is, what to do this week, and a colour that says whether
 * to worry. The rules are the brief's: green when everything is current,
 * amber when the producer owes a reply, red when a payment or a signed
 * document is due within a week or the supplier has gone quiet for two
 * weeks after we reached out.
 *
 * Pure, tested, and shared by the producer's tab, the couple's screen and
 * the Monday letter, so the three cannot disagree about who is red.
 */

export type HqVendor = {
  id: string;
  name: string;
  category: string;
  status: string;
  phone: string;
  notes: string;
  deposit: number | null;
  deposit_paid_on: string | null;
  balance_due_on: string | null;
  last_contact_on: string | null;
  waiting_on: 'me' | 'them' | null;
  next_action: string;
};

export type HqContract = { party_name: string; status: string; signed_at: string | null };
export type HqLine = { event_vendor_id: string | null; estimate: number | string; agreed: number | string | null };

export type ContractState = 'signed' | 'pending' | 'none';
export type DepositState = 'paid' | 'pending' | 'notDue' | 'none';
export type Tone = 'green' | 'yellow' | 'red';
export type ActionKey = 'sendContract' | 'chaseContract' | 'payDeposit' | 'payBalance' | 'nudge' | 'reply' | 'own' | 'wait';
export type FlagKey = 'balanceSoon' | 'depositSoon' | 'silent' | 'noContract' | 'contractPending' | 'noPrice';

export type HqRow = {
  vendor: HqVendor;
  contract: ContractState;
  agreed: number | null;
  deposit: number | null;
  depositState: DepositState;
  balance: number | null;
  balanceDue: string | null;
  /** Days since we last spoke. Null when never recorded. */
  silentDays: number | null;
  waitingOn: 'me' | 'them' | null;
  action: ActionKey;
  /** The producer's own words, when they wrote some. */
  ownAction: string;
  flags: FlagKey[];
  tone: Tone;
  /** Higher is worse. */
  risk: number;
};

const num = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const daysApart = (from: string, to: string): number =>
  Math.round((Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10))
    - Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))) / 86_400_000);

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** A contract belongs to a supplier when it names them. Names are matched
 *  loosely, because "סטודיו לביא" on the contract and "לביא" on the row are
 *  the same photographer. */
export function contractFor(v: HqVendor, contracts: readonly HqContract[]): ContractState {
  const name = norm(v.name);
  if (!name) return 'none';
  const mine = contracts.filter((c) => {
    const p = norm(c.party_name);
    return p && (p === name || p.includes(name) || name.includes(p));
  });
  if (mine.length === 0) return 'none';
  if (mine.some((c) => c.status === 'signed' || c.signed_at)) return 'signed';
  return 'pending';
}

export const SOON = 7;
export const SILENT = 14;

export function hqRows(
  vendors: readonly HqVendor[],
  contracts: readonly HqContract[],
  lines: readonly HqLine[],
  today: string,
): HqRow[] {
  return vendors
    .filter((v) => v.status !== 'cancelled')
    .map((v) => {
      const contract = contractFor(v, contracts);
      const line = lines.find((l) => l.event_vendor_id === v.id);
      const agreed = line ? (num(line.agreed) ?? num(line.estimate)) : null;
      const deposit = num(v.deposit);
      const depositState: DepositState =
        deposit === null ? 'none' : v.deposit_paid_on ? 'paid' : contract === 'signed' ? 'pending' : 'notDue';
      const balance = agreed === null ? null : Math.max(0, agreed - (v.deposit_paid_on && deposit ? deposit : 0));
      const balanceDue = v.balance_due_on;
      const silentDays = v.last_contact_on ? daysApart(v.last_contact_on, today) : null;
      const dueIn = balanceDue ? daysApart(today, balanceDue) : null;

      const flags: FlagKey[] = [];
      if (balance !== null && balance > 0 && dueIn !== null && dueIn <= SOON) flags.push('balanceSoon');
      if (depositState === 'pending') flags.push('depositSoon');
      if (v.waiting_on === 'them' && silentDays !== null && silentDays > SILENT) flags.push('silent');
      if (contract === 'none' && v.status === 'booked') flags.push('noContract');
      if (contract === 'pending') flags.push('contractPending');
      if (agreed === null && v.status === 'booked') flags.push('noPrice');

      let action: ActionKey = 'wait';
      if (v.next_action.trim()) action = 'own';
      else if (flags.includes('balanceSoon')) action = 'payBalance';
      else if (flags.includes('depositSoon')) action = 'payDeposit';
      else if (flags.includes('silent')) action = 'nudge';
      else if (flags.includes('contractPending')) action = 'chaseContract';
      else if (v.waiting_on === 'me') action = 'reply';
      else if (flags.includes('noContract')) action = 'sendContract';

      const red = flags.includes('balanceSoon') || flags.includes('silent')
        || (contract === 'pending' && dueIn !== null && dueIn <= SOON);
      const tone: Tone = red ? 'red' : v.waiting_on === 'me' ? 'yellow' : 'green';

      const risk = (silentDays ?? 0) * 2 + (contract !== 'signed' && v.status === 'booked' ? 10 : 0)
        + (balance ?? 0) / 1000 + (red ? 20 : 0);

      return {
        vendor: v, contract, agreed, deposit, depositState, balance, balanceDue,
        silentDays, waitingOn: v.waiting_on, action, ownAction: v.next_action.trim(), flags, tone, risk,
      };
    })
    .sort((a, b) => order(b.tone) - order(a.tone) || b.risk - a.risk || a.vendor.name.localeCompare(b.vendor.name));
}

const order = (t: Tone) => (t === 'red' ? 2 : t === 'yellow' ? 1 : 0);

/** The three relationships most likely to bite. */
export const atRisk = (rows: readonly HqRow[], n = 3): HqRow[] =>
  [...rows].filter((r) => r.risk > 0).sort((a, b) => b.risk - a.risk).slice(0, n);

export type HqSummary = {
  locked: number;
  total: number;
  depositsPaid: number;
  dueSoon: number;
  /** The single most important row, red first. */
  first: HqRow | null;
};

export function summary(rows: readonly HqRow[], today: string): HqSummary {
  const until = daysApart(today, today) + 30;
  return {
    locked: rows.filter((r) => r.vendor.status === 'booked' && r.contract === 'signed').length,
    total: rows.length,
    depositsPaid: rows.filter((r) => r.depositState === 'paid').length,
    dueSoon: rows.reduce((a, r) => {
      if (r.balance === null || !r.balanceDue) return a;
      const d = daysApart(today, r.balanceDue);
      return d >= 0 && d <= until ? a + r.balance : a;
    }, 0),
    first: rows.find((r) => r.tone === 'red') ?? rows.find((r) => r.tone === 'yellow') ?? null,
  };
}

/** The message that clears a row, ready to paste. Plain text, in the
 *  producer's voice, with the facts filled in and nothing invented. */
export function suggestedMessage(r: HqRow, opts: { couple: string; date: string; signAs: string }): string {
  const to = r.vendor.name || '[שם]';
  const who = `${opts.couple || '[הזוג]'}${opts.date ? `, ${opts.date}` : ''}`;
  const sign = opts.signAs || '[שם]';
  switch (r.action) {
    case 'sendContract':
      return `היי ${to}, לקראת ${who}: שולח/ת לכם את ההסכם לחתימה. תעברו עליו, ואם משהו לא ברור, מתקשרים. תודה, ${sign}`;
    case 'chaseContract':
      return `היי ${to}, ההסכם ל${who} עדיין ממתין לחתימה אצלכם. אפשר לסגור אותו השבוע? תודה, ${sign}`;
    case 'payDeposit':
      return `היי ${to}, סוגרים את המקדמה ל${who} השבוע. תשלחו לי פרטי העברה או קישור לתשלום. תודה, ${sign}`;
    case 'payBalance':
      return `היי ${to}, היתרה ל${who} מגיעה ${r.balanceDue ? `ב-${r.balanceDue.split('-').reverse().join('.')}` : 'השבוע'}. רק לוודא שהסכום אצלכם תואם למה שסיכמנו, ומסדרים. תודה, ${sign}`;
    case 'nudge':
      return `היי ${to}, כתבתי לכם לפני ${r.silentDays ?? 'כמה'} ימים לגבי ${who} ולא קיבלתי תשובה. רק מוודא/ת שהכל בסדר ושאנחנו על אותו עמוד. ${sign}`;
    case 'reply':
      return `היי ${to}, סליחה על העיכוב. לגבי ${who}: [התשובה שלכם]. ${sign}`;
    case 'own':
      return `היי ${to}, לגבי ${who}: ${r.ownAction}. ${sign}`;
    default:
      return '';
  }
}
