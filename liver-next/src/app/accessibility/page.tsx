import Link from 'next/link';
import { a11yCopy } from '@/content/site';
import { site } from '@/content/site';
import { publicEnv } from '@/lib/env';

const c = a11yCopy.page;

export const metadata = {
  title: c.title,
  description: c.sub,
};

/**
 * The statement, on a page of its own.
 *
 * A summary lives inside the accessibility menu, which is where somebody
 * already struggling with the page will look first. This is the version that
 * can be linked to, sent, and read by somebody checking the site against the
 * standard, which is what ת"י 5568 actually asks for. The footer links here
 * on every screen.
 */
export default function Page() {
  const updated = new Intl.DateTimeFormat('he-IL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date('2026-08-25'));

  return (
    <main id="main" className="shell max-w-prose2 py-16 sm:py-24">
      <p className="eyebrow">{site.brand}</p>
      <h1 className="mt-4 font-display text-display font-light text-ink">{c.title}</h1>
      <p className="measure mt-4 text-[16.5px] leading-relaxed text-ink-soft">{c.sub}</p>

      <hr className="rule-gold my-10" />

      <Section title={c.standardTitle}>
        <p>{c.standard}</p>
      </Section>

      <Section title={c.doneTitle}>
        <ul className="list-none space-y-0 p-0">
          {c.done.map((line) => (
            <li key={line} className="border-b border-line py-3 last:border-0">{line}</li>
          ))}
        </ul>
      </Section>

      <Section title={c.limitsTitle}>
        <p>{c.limits}</p>
      </Section>

      <Section title={c.contactTitle}>
        <p>{c.contact}</p>
        <p className="mt-3">
          <a
            href={`mailto:${publicEnv.contactEmail}`}
            dir="ltr"
            className="text-accent underline underline-offset-4"
          >
            {publicEnv.contactEmail}
          </a>
        </p>
      </Section>

      <hr className="rule-gold my-10" />

      <p className="text-[13.5px] text-ink-mute">
        {c.updated}{' '}
        <span dir="ltr" style={{ unicodeBidi: 'isolate', whiteSpace: 'nowrap' }}>{updated}</span>
      </p>

      <p className="mt-8">
        <Link href="/" className="btn-ghost">חזרה לעמוד הבית</Link>
      </p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="font-display text-title font-light text-ink">{title}</h2>
      <div className="measure mt-4 text-[15.5px] leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}
