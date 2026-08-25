'use client';

import { useRef, useState } from 'react';

/**
 * One box per digit of the sign-in code, with a way out.
 *
 * The count comes from configuration rather than from this file. The length is
 * a Supabase project setting, and when the two disagree the screen fails in the
 * worst possible way: an eight digit code arrives, six boxes take six of them,
 * and the person typing is told their code is wrong. That happened, and boxes
 * alone cannot prevent it happening again — whoever changes that setting will
 * not be reading this component.
 *
 * So there is a plain field underneath, one link away, and it accepts a code of
 * any length. It also appears on its own the moment somebody pastes more digits
 * than there are boxes, which is exactly the situation a mismatch produces. The
 * server has never cared how long the code is; only the markup did.
 *
 * The real value is submitted in a hidden field either way, so nothing
 * downstream knows or cares which of the two was used.
 */
export function CodeInput({ name, label, length }: {
  name: string; label: string; length: number;
}) {
  const [digits, setDigits] = useState<string[]>(Array(length).fill(''));
  const [plain, setPlain] = useState<string | null>(null);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const value = plain !== null ? plain : digits.join('');
  const focus = (i: number) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();

  const write = (start: number, text: string) => {
    const chars = text.replace(/\D/g, '').split('');
    if (chars.length === 0) return;

    /* More digits than boxes means the boxes are the wrong shape for this
       code. Rather than silently dropping the tail, hand over to the field
       that can hold all of it. */
    if (start === 0 && chars.length > length) {
      setPlain(chars.join(''));
      return;
    }

    const next = [...digits];
    let i = start;
    for (const ch of chars) {
      if (i >= length) break;
      next[i] = ch;
      i += 1;
    }
    setDigits(next);
    focus(i);
  };

  /* A rule under each digit rather than a box around it. 46x60 from the
     handoff; the height is what keeps a bottom-border cell feeling like a
     place to type rather than an underline in a sentence, and it clears the
     44px target without any padding tricks. Narrower when the code is longer
     than six, so eight cells still fit a 320px phone. */
  const cell = length > 6
    ? 'h-[56px] w-[34px] text-[22px] sm:w-[40px]'
    : 'h-[60px] w-[38px] text-[26px] sm:w-[46px]';

  return (
    <div>
      <span className="label">{label}</span>
      <input type="hidden" name={name} value={value} />

      {plain !== null ? (
        <input
          autoFocus
          dir="ltr"
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label={label}
          value={plain}
          onChange={(e) => setPlain(e.target.value.replace(/\D/g, '').slice(0, 12))}
          className="field mt-1.5 w-full text-center font-display text-[26px] font-light tracking-[0.4em] tabular-nums"
        />
      ) : (
        /* Left to right inside a right-to-left page, because a number reads
           that way regardless of the language around it. */
        <div dir="ltr" className="mt-3 flex justify-center gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { refs.current[i] = el; }}
              /* The first box takes focus so the code can be typed the moment
                 the screen arrives. Only the first: autoFocus on every box
                 would fight the caret across all six. */
              autoFocus={i === 0}
              value={d}
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              aria-label={`${label} ${i + 1}`}
              /* The border is the whole control: it goes gold the moment the
                 cell holds a digit, which is the only feedback there is now
                 that the fill and the focus ring are gone. */
              className={[
                'rounded-none border-0 border-b bg-transparent p-0 text-center tabular-nums',
                'font-display font-light text-ink outline-none',
                'transition-colors duration-300 ease-out',
                d ? 'border-b-2 border-accent-line' : 'border-b border-line-strong',
                'focus:border-b-2 focus:border-accent',
                cell,
              ].join(' ')}
              onChange={(e) => write(i, e.target.value)}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === 'Backspace') {
                  e.preventDefault();
                  const next = [...digits];
                  /* Backspace on an empty box steps back and clears that one,
                     which is what everybody expects and almost nothing does. */
                  if (next[i]) next[i] = '';
                  else if (i > 0) { next[i - 1] = ''; focus(i - 1); }
                  setDigits(next);
                } else if (e.key === 'ArrowLeft') { e.preventDefault(); focus(i - 1); }
                else if (e.key === 'ArrowRight') { e.preventDefault(); focus(i + 1); }
              }}
              onPaste={(e) => { e.preventDefault(); write(i, e.clipboardData.getData('text')); }}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setPlain(plain === null ? digits.join('') : null)}
        className="mt-2.5 block w-full text-center text-[13px] text-ink-mute underline-offset-2 hover:text-ink hover:underline"
      >
        {plain === null ? 'הקוד שקיבלתי באורך אחר' : 'חזרה לריבועים'}
      </button>
    </div>
  );
}
