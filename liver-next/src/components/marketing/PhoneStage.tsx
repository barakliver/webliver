'use client';

import { useEffect, useRef, useState } from 'react';
import { Ltr, Money } from '@/components/Ltr';
import { Prose } from './Prose';

/**
 * The product, shown rather than described.
 *
 * A phone standing in space with the couple's own screen on it, and the
 * numeral behind it set enormous at four and a half percent. That number is
 * the section: it is the same `200` the portal shows, blown up until it stops
 * being a figure and becomes a texture, and it is the reason the block reads
 * as a stage rather than as a screenshot in a box.
 *
 * The phone leans with the cursor on two axes inside its own perspective, over
 * a slow float that runs regardless. Both stop for reduced motion, and the
 * listener stays attached so turning that on mid-session takes effect without
 * a reload.
 *
 * The screen inside is real markup rather than an image: it is the same tokens
 * and the same isolate wrapper as the app, so it cannot drift away from what
 * the product actually looks like the way a mockup screenshot does.
 */
export function PhoneStage({
  kicker, title, body, screen,
}: {
  /* The whole passage, not its opening line. It used to take one line and a
     second section underneath repeated the heading and that same line, so the
     page carried the h2 twice and the sentence directly under itself. Handing
     the stage all of it also balances the column against the phone, which is
     what left a screen of empty space beside it before. */
  kicker: string; title: string; body: readonly string[];
  /* The words on the mock screen, in the language the page is in. They were
     literals in here, which put a Hebrew screenshot next to an English
     argument. */
  screen: { couple: string; days: string; rows: readonly [string, string, string, string] };
}) {
  const stage = useRef<HTMLDivElement>(null);
  const phone = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)');
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    const decide = () => setLive(fine.matches && !still.matches);
    decide();
    fine.addEventListener('change', decide);
    still.addEventListener('change', decide);
    return () => {
      fine.removeEventListener('change', decide);
      still.removeEventListener('change', decide);
    };
  }, []);

  useEffect(() => {
    const box = stage.current;
    const el = phone.current;
    if (!box || !el) return;

    if (!live) { el.style.transform = ''; return; }

    let frame = 0;
    const rest = () => {
      cancelAnimationFrame(frame);
      el.style.transform = 'rotateY(-14deg) rotateX(7deg)';
    };
    rest();

    const move = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = box.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `rotateY(${-14 + x * 16}deg) rotateX(${7 - y * 12}deg)`;
      });
    };

    box.addEventListener('pointermove', move);
    box.addEventListener('pointerleave', rest);
    return () => {
      cancelAnimationFrame(frame);
      box.removeEventListener('pointermove', move);
      box.removeEventListener('pointerleave', rest);
    };
  }, [live]);

  return (
    <section
      ref={stage}
      className="relative isolate overflow-hidden py-24 sm:py-32"
      style={{ perspective: '1500px' }}
    >
      {/* The numeral, large enough to stop being a number. Behind everything,
          never read, and never in the way of a pointer. */}
      {/* Centred on its own width rather than inside a full-width box. At
          this size the glyphs are wider than the viewport, and a centred box
          then clips asymmetrically: the first digit disappeared off the edge
          and the section read as "00". */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2
                   select-none whitespace-nowrap font-display font-semibold leading-none text-ink"
        style={{ fontSize: 'clamp(220px, 38vw, 520px)', opacity: 0.045 }}
      >
        200
      </span>

      <div className="shell grid items-center gap-14 lg:grid-cols-[1fr_auto] lg:gap-20">
        <div>
          <p className="eyebrow">{kicker}</p>
          <h2 className="mt-4 max-w-[14ch] font-display text-display font-semibold text-ink">{title}</h2>
          <Prose lines={body} className="mt-5 leading-relaxed" />
        </div>

        <div className="justify-self-center lg:justify-self-end">
          <div
            ref={phone}
            className="animate-floatSlow transition-transform duration-stage ease-out"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <PortalScreen screen={screen} />
          </div>
        </div>
      </div>
    </section>
  );
}

/** The couple's own screen, built from the same tokens as the real one so it
 *  cannot drift away from the product. */
function PortalScreen({ screen }: {
  screen: { couple: string; days: string; rows: readonly [string, string, string, string] };
}) {
  const rows: [string, React.ReactNode][] = [
    [screen.rows[0], <Money key="b" value={228000} />],
    [screen.rows[1], <Ltr key="r">218 / 340</Ltr>],
    [screen.rows[2], <Ltr key="m">24</Ltr>],
    [screen.rows[3], <Ltr key="v">7</Ltr>],
  ];

  return (
    <div
      className="w-[268px] border border-line-strong bg-surface-100 p-6 shadow-fab sm:w-[300px]"
      style={{ borderRadius: '44px' }}
    >
      <p className="text-[11.5px] tracking-[.14em] text-ink-mute">{screen.couple}</p>
      <p className="mt-6 font-display text-[86px] font-semibold leading-none text-ink">
        <Ltr>200</Ltr>
      </p>
      <p className="mt-1 text-[13.5px] text-ink-soft">{screen.days}</p>
      <hr className="rule-gold my-6" />
      <ul className="list-none space-y-0 p-0">
        {rows.map(([label, value]) => (
          <li key={label} className="flex items-baseline justify-between border-b border-line py-3 last:border-0">
            <span className="text-[14px] text-ink-soft">{label}</span>
            <span className="font-display text-[17px] font-semibold text-ink">{value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
