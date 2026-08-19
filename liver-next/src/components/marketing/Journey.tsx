import Link from 'next/link';
import { site } from '@/content/site';
import { Section } from './Section';

export function Journey() {
  return (
    <Section id="journey" title={site.journey.title}>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {site.journey.steps.map((step, i) => (
          <li key={i} className="group rounded-4xl glass p-6 transition hover:shadow-lift">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-azure-50 font-display text-[15px] font-semibold text-azure-600">
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
