import Link from 'next/link';
import type { SiteCopy } from '@/content/site';
import { Section } from './Section';

export function Journey({ site }: { site: SiteCopy }) {
  return (
    <Section id="journey" title={site.journey.title}>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {site.journey.steps.map((step, i) => (
          <li key={i} className="group rounded-none glass p-6 transition hover:shadow-lift">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-wash font-display text-[15px] font-light text-accent">
              {i + 1}
            </span>
            <p className="mt-4 text-[16.5px] font-medium text-ink">{step}</p>
          </li>
        ))}
      </ol>
      <div className="mt-9">
        <Link href="#contact" className="btn-ghost">{site.journey.link}</Link>
      </div>
    </Section>
  );
}
