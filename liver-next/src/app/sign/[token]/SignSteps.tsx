'use client';

import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { useCopy } from '@/components/app/CopyProvider';

/**
 * Three steps above the agreement - read, sign, done - and a line under them
 * that fills as the terms go past.
 *
 * It reads the page and gates nothing: the button is never disabled because a
 * scrollbar has not reached the end, which would be a rule about how people
 * read dressed up as a safeguard. What it does is tell somebody where they are
 * in a document that is longer than a phone, and move the second step to the
 * front when they have seen the whole of the first. The terms are found by
 * their id, so this file does not have to wrap them.
 */
export function SignSteps({ signed }: { signed: boolean }) {
  const c = useCopy().sign;
  const line = useRef<HTMLSpanElement>(null);
  const [read, setRead] = useState(false);

  useEffect(() => {
    if (signed) return;
    const terms = document.getElementById('terms');
    if (!terms) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const r = terms.getBoundingClientRect();
      const seen = Math.min(1, Math.max(0, (window.innerHeight - r.top) / Math.max(1, r.height)));
      if (line.current) line.current.style.transform = `scaleX(${seen})`;
      if (r.bottom <= window.innerHeight + 4) setRead(true);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [signed]);

  const at = signed ? 2 : read ? 1 : 0;
  const steps = [c.stepRead, c.stepSign, c.stepDone];

  return (
    <div className="sticky top-0 z-10 -mx-5 border-b border-line bg-surface/90 px-5 py-3 backdrop-blur sm:mx-0 sm:rounded-control sm:border">
      <ol className="mx-auto flex max-w-2xl list-none items-center justify-center gap-3 p-0 text-body">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-3" aria-current={i === at ? 'step' : undefined}>
            <span className={`flex items-center gap-2 ${i <= at ? 'text-ink' : 'text-ink-mute'}`}>
              <span className={`grid size-6 place-items-center rounded-full text-meta transition-colors duration-slow ${
                i < at ? 'bg-tone-rubine text-tone-rubine-on' : i === at ? 'bg-ink text-surface' : 'border border-line-strong'
              }`}>
                {i < at ? <Check size={13} strokeWidth={2.25} aria-hidden /> : i + 1}
              </span>
              {s}
            </span>
            {i < steps.length - 1 && <span aria-hidden className="h-px w-8 bg-line-strong sm:w-12" />}
          </li>
        ))}
      </ol>
      {!signed && (
        <span aria-hidden className="mt-3 block h-[3px] overflow-hidden rounded-full bg-line">
          <span ref={line} className="block h-full origin-[100%_50%] rounded-full bg-tone-rubine will-change-transform ltr:origin-[0_50%]" style={{ transform: 'scaleX(0)' }} />
        </span>
      )}
    </div>
  );
}
