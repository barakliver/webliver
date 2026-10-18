/**
 * What is in the production book, and how much of it is there.
 *
 * The book is printed three months out as often as the week before, so most of
 * it is allowed to be empty and says so. This reads the same rows the book is
 * drawn from and answers one question per section: nothing, something still
 * open, or all there. A blank running order is information, which is why
 * "empty" is a state of its own rather than a section that is left off.
 *
 * Pure, and tested, because each rule is obviously right and quietly wrong:
 * a supplier list with an unsigned supplier is partial and not full, a guest
 * list with unanswered invitations likewise, and a task list is full when
 * nothing is left open - which is the opposite of how a count usually reads.
 */
export type SectionKey = 'order' | 'suppliers' | 'guests' | 'crew' | 'money' | 'open';
export type SectionState = 'full' | 'partial' | 'empty';
export type BookSection = { key: SectionKey; n: number; state: SectionState };

export function bookSections(i: {
  moments: number;
  vendors: { total: number; booked: number };
  guests: { invited: number; pending: number };
  crew: number;
  payments: { total: number; unpaid: number };
  tasks: { total: number; open: number };
}): BookSection[] {
  const rule = (key: SectionKey, n: number, total: number, complete: boolean): BookSection => ({
    key, n, state: total === 0 ? 'empty' : complete ? 'full' : 'partial',
  });
  return [
    rule('order', i.moments, i.moments, true),
    rule('suppliers', i.vendors.total, i.vendors.total, i.vendors.booked === i.vendors.total),
    rule('guests', i.guests.invited, i.guests.invited, i.guests.pending === 0),
    rule('crew', i.crew, i.crew, true),
    rule('money', i.payments.total, i.payments.total, i.payments.unpaid === 0),
    rule('open', i.tasks.open, i.tasks.total, i.tasks.open === 0),
  ];
}
