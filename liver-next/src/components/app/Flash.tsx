import { TriangleAlert } from 'lucide-react';
import { readFlash, FLASH_COOKIE } from '@/lib/flash';
import { FlashClear } from './FlashClear';

/**
 * The sentence an action left behind, shown once.
 *
 * It sits in the shell rather than in a panel because the actions that leave
 * one are spread over a dozen screens and half of them are bare form
 * submissions with nowhere local to put a message. One place that renders it
 * means a new action gets honest feedback by calling one function.
 *
 * Same visual language as the line above a screen whose data half arrived:
 * this is the other half of the same promise, that the screen does not quietly
 * claim everything is fine.
 */
export async function Flash() {
  const text = await readFlash();
  if (!text) return null;
  return <FlashLine text={text} />;
}

/**
 * The part that draws, split from the part that reads the cookie — for the
 * same reason the load-trouble line was split. This shows on almost no
 * morning, so it can only be looked at if it can be handed a sentence.
 */
export function FlashLine({ text }: { text: string }) {
  return (
    <p
      role="status"
      className="mb-5 flex items-start gap-2.5 rounded-xl2 border border-bad/30 bg-bad-wash px-4 py-3 text-[14px] leading-relaxed text-ink"
    >
      <TriangleAlert size={17} strokeWidth={1.5} aria-hidden className="mt-0.5 shrink-0 text-bad" />
      <span>{text}</span>
      <FlashClear name={FLASH_COOKIE} />
    </p>
  );
}
