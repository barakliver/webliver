import { cn } from '@/lib/utils';

/**
 * A state, as a dot and a word.
 *
 * The brief's default for a status anywhere in a list or a table: eight
 * pixels of colour and the word beside it in the muted ink, never a
 * filled badge. A row of filled badges is a row that has stopped meaning
 * anything by being coloured all at once; a dot is read, a badge is seen.
 * The filled chip stays for the two places the brief allows it, the board
 * and the filters.
 */
export type DotTone = 'faint' | 'info' | 'warn' | 'ok' | 'bad' | 'accent';

const DOT: Record<DotTone, string> = {
  faint: 'bg-ink-mid',
  info: 'bg-accent-bright',
  warn: 'bg-warn',
  ok: 'bg-ok',
  bad: 'bg-bad',
  accent: 'bg-accent',
};

/** The product's own states, mapped once so two screens cannot colour the
 *  same word two ways. */
export const TONE_OF: Record<string, DotTone> = {
  idea: 'faint', new: 'faint', draft: 'faint', shortlist: 'faint', pending: 'faint',
  quoted: 'info', contacted: 'info', sent: 'info', meeting: 'warn', proposal_sent: 'info',
  booked: 'warn', meeting_set: 'warn', nurture: 'faint',
  paid: 'ok', won: 'ok', signed: 'ok', applied: 'ok', done: 'ok', attending: 'ok',
  lost: 'bad', cancelled: 'bad', void: 'bad', failed: 'bad', declined: 'bad', rejected: 'bad',
};

export function StatusDot({ tone, label, className }: { tone: DotTone | string; label: string; className?: string }) {
  const t: DotTone = (tone in DOT ? tone : TONE_OF[tone] ?? 'faint') as DotTone;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-body text-ink-soft', className)}>
      <span aria-hidden className={cn('size-2 shrink-0 rounded-full', DOT[t])} />
      {label}
    </span>
  );
}
