'use client';

import { useRef, useState } from 'react';

const LENGTH = 6;

/**
 * Six boxes for a six digit code.
 *
 * One field per digit rather than one long field, because a code arriving by
 * mail is read in glances — look, type two, look again — and boxes hold your
 * place while a single field does not. Everything a person might do with it is
 * handled: typing forwards, backspacing through, pasting the whole code from
 * the mail, and the browser's own one-time-code autofill, which delivers all
 * six characters into the first box at once.
 *
 * The real value is submitted in a hidden field, so the server sees one string
 * and never has to know the input was split up.
 */
export function CodeInput({ name, label }: { name: string; label: string }) {
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(''));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const focus = (i: number) => refs.current[Math.max(0, Math.min(LENGTH - 1, i))]?.focus();

  const write = (start: number, text: string) => {
    const chars = text.replace(/\D/g, '').split('');
    if (chars.length === 0) return;

    const next = [...digits];
    let i = start;
    for (const ch of chars) {
      if (i >= LENGTH) break;
      next[i] = ch;
      i += 1;
    }
    setDigits(next);
    focus(i);
  };

  return (
    <div>
      <span className="label">{label}</span>
      <input type="hidden" name={name} value={digits.join('')} />
      {/* dir=ltr because a numeric code reads left to right even on a
          right-to-left page, and flex-row-reverse would put the first digit
          under the last box. */}
      <div dir="ltr" className="mt-1.5 flex justify-center gap-2">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            value={d}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            aria-label={`${label} ${i + 1}`}
            className="field size-12 p-0 text-center text-[22px] font-semibold tabular-nums sm:size-14"
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
    </div>
  );
}
