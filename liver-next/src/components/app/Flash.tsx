import { Check, TriangleAlert } from 'lucide-react';
import { readFlash, FLASH_COOKIE, type FlashTone } from '@/lib/flash';
import { FlashClear } from './FlashClear';
import { FlashToast } from './FlashToast';

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
 * claim everything is fine. The quiet variant is the same line saying a write
 * landed, for the few writes whose effect is somewhere the screen cannot show.
 */
export async function Flash() {
  const { text, tone } = await readFlash();
  if (!text) return null;
  /* Floating at the foot of the screen, beside the thumb, rather than at the
     top of the content where a long screen hid it. See FlashToast. */
  return (
    <FlashToast tone={tone}>
      <FlashLine text={text} tone={tone} className="mb-0 bg-card" />
    </FlashToast>
  );
}

/**
 * The part that draws, split from the part that reads the cookie — for the
 * same reason the load-trouble line was split. This shows on almost no
 * morning, so it can only be looked at if it can be handed a sentence.
 */
export function FlashLine({ text, tone = 'bad', className = 'mb-5' }: { text: string; tone?: FlashTone; className?: string }) {
  const ok = tone === 'ok';
  const Icon = ok ? Check : TriangleAlert;
  return (
    <p
      role="status"
      className={`${className} flex items-start gap-2.5 rounded-xl2 border px-4 py-3 text-[14px] leading-relaxed text-ink ${
        ok ? 'border-ok/30 bg-ok-wash' : 'border-bad/30 bg-bad-wash'
      }`}
    >
      <Icon size={17} strokeWidth={1.5} aria-hidden className={`mt-0.5 shrink-0 ${ok ? 'text-ok' : 'text-bad'}`} />
      <span>{text}</span>
      <FlashClear name={FLASH_COOKIE} />
    </p>
  );
}
