import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { appCopy } from '@/content/site';
import { producerGuide } from '@/content/guide';

/**
 * The first morning's card.
 *
 * A producer with no events is not "all clear", they are before the
 * beginning, and the overview's empty state used to congratulate them on it.
 * This shows the book's own first steps instead, in the same gold numerals
 * the public site and the book use for "do these in order", with the first
 * action as the primary button.
 *
 * The steps come from the operating book rather than being written again, so
 * the card and the book cannot tell a new producer two different stories.
 */
export function BeginHere() {
  const c = appCopy.overview2.begin;
  return (
    <div className="card">
      <p className="text-[14.5px] text-ink-soft">{c.sub}</p>
      <ol className="mt-5 list-none space-y-4 p-0">
        {producerGuide.start.steps.map((step, i) => (
          <li key={step.title} className="flex items-baseline gap-3.5">
            <span aria-hidden className="font-display text-[26px] font-semibold leading-none text-accent-bright">
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-medium text-ink">{step.title}</span>
              <span className="mt-0.5 block text-[13.5px] leading-relaxed text-ink-soft">{step.body}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link href="/app/brand" className="btn-primary">{c.cta}</Link>
        <Link href="/app/guide" className="btn-quiet text-[14px]">
          {c.book}
          <ChevronLeft size={16} strokeWidth={1.5} aria-hidden className="chev-onward" />
        </Link>
      </div>
    </div>
  );
}
