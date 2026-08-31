import Link from 'next/link';
import { termsCopy as c, privacyCopy, site } from '@/content/site';
import { publicEnv } from '@/lib/env';

export const metadata = { title: c.title, description: c.sub, alternates: { canonical: '/terms' } };

/**
 * What may be done here, and what is promised back.
 *
 * The privacy policy answers what is held about somebody. This answers the
 * other half, and it was the last public page missing: the footer linked two
 * of the three documents a site like this is expected to carry, and Google's
 * consent screen was pointing at the privacy policy for both.
 *
 * Written from the system rather than from a template, the same way the
 * privacy policy was. Two consequences of that are worth naming, because both
 * give something up rather than take it. The production agreement overrides
 * this page, so nothing here can quietly rewrite what he signed with a couple.
 * And nothing about charging a card appears anywhere, because the shop charges
 * none: an order is a request that reaches him in a second, and it says so.
 */
export default function Page() {
  const updated = new Intl.DateTimeFormat('he-IL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date('2026-08-31'));

  return (
    <main id="main" className="shell max-w-prose2 py-16 sm:py-24">
      <p className="eyebrow">{site.brand}</p>
      <h1 className="mt-4 font-display text-display font-light text-ink">{c.title}</h1>
      <p className="measure mt-4 text-[16.5px] leading-relaxed text-ink-soft">{c.sub}</p>

      <hr className="rule-gold my-10" />

      {/* Four lines, and the two that cost him something are among them. Most
          people read this block and nothing else, so it is where the promises
          belong rather than the definitions. */}
      <Section title={c.shortTitle}>
        <ul className="list-none space-y-0 p-0">
          {c.short.map((line) => (
            <li key={line} className="border-b border-line py-3 last:border-0">{line}</li>
          ))}
        </ul>
      </Section>

      <Section title={c.whoTitle}><p>{c.who}</p></Section>

      <Section title={c.scopeTitle}>
        <dl className="space-y-0">
          {c.scope.map(([term, body]) => (
            <div key={term} className="border-b border-line py-3 last:border-0">
              <dt className="text-ink">{term}</dt>
              <dd className="mt-1 text-ink-soft">{body}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title={c.contractTitle}><p>{c.contract}</p></Section>

      <Section title={c.accountTitle}>
        <List lines={c.account} />
      </Section>

      <Section title={c.useTitle}>
        <p>{c.useIntro}</p>
        <div className="mt-3"><List lines={c.use} /></div>
        <p className="mt-4">{c.useNote}</p>
      </Section>

      <Section title={c.contentTitle}>
        <List lines={c.content} />
      </Section>

      <Section title={c.photosTitle}><p>{c.photos}</p></Section>

      <Section title={c.shopTitle}>
        <List lines={c.shop} />
      </Section>

      <Section title={c.availabilityTitle}><p>{c.availability}</p></Section>
      <Section title={c.dataTitle}><p>{c.data}</p></Section>

      <Section title={c.liabilityTitle}>
        <List lines={c.liability} />
      </Section>

      <Section title={c.endTitle}><p>{c.end}</p></Section>
      <Section title={c.changesTitle}><p>{c.changes}</p></Section>
      <Section title={c.lawTitle}><p>{c.law}</p></Section>

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
        <p className="mt-4">
          {c.privacyLink}{' '}
          <Link href="/privacy" className="text-accent underline underline-offset-4">
            {privacyCopy.title}
          </Link>
        </p>
      </Section>

      <hr className="rule-gold my-10" />

      <p className="text-[13.5px] text-ink-mute">
        {c.updated}{' '}
        {/* Isolated because it is a numeric date rather than a Hebrew one.
            A date written as 31.08.2026 needs the isolate to stay in order;
            one written as 31 באוגוסט 2026 is broken by it. */}
        <span dir="ltr" style={{ unicodeBidi: 'isolate', whiteSpace: 'nowrap' }}>{updated}</span>
      </p>

      <p className="mt-8">
        <Link href="/" className="btn-ghost">{c.back}</Link>
      </p>
    </main>
  );
}

function List({ lines }: { lines: readonly string[] }) {
  return (
    <ul className="list-none space-y-0 p-0">
      {lines.map((line) => (
        <li key={line} className="border-b border-line py-3 last:border-0">{line}</li>
      ))}
    </ul>
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
