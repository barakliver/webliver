import Link from 'next/link';
import { cookies } from 'next/headers';
import { LOCALE_COOKIE, readLocale } from '@/lib/locale';
import { getSiteCopy } from '@/lib/siteCopy';
import { supabasePublic } from '@/lib/supabase/public';
import { Nav } from '@/components/marketing/Nav';
import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { Prose } from '@/components/marketing/Prose';
import { Steps } from '@/components/marketing/Steps';
import { PhoneStage } from '@/components/marketing/PhoneStage';
import { DarkBand } from '@/components/marketing/DarkBand';
import { BudgetSimulator } from '@/components/marketing/BudgetSimulator';
import { LeadForm } from '@/components/marketing/LeadForm';
import { Portfolio } from '@/components/marketing/Portfolio';
import { Portrait } from '@/components/marketing/Portrait';
import { FabDock } from '@/components/marketing/FabDock';
import { BookMeeting } from '@/components/marketing/BookMeeting';
import { AiConcierge } from '@/components/marketing/AiConcierge';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import { StructuredData } from '@/components/marketing/StructuredData';

/* Rendered per request, because the language is read from a cookie and a page
   built once cannot be in two languages.

   The reason that used to be unacceptable has moved rather than disappeared:
   the five minute timer now sits on the copy lookup itself, in getSiteCopy, so
   the database is still read once every five minutes however many people
   visit. English reads nothing at all. What changed is that the timer no longer
   depends on how this page happens to be rendered. */
export const dynamic = 'force-dynamic';

/* The one address this page has, said out loud.
   Canonical is set per page rather than on the layout on purpose: a canonical
   inherited from a layout resolves to the same URL on every route, which tells
   a crawler that the privacy page and the shop are both this one. */
export const metadata = { alternates: { canonical: '/' }, openGraph: { url: '/' } };

export default async function HomePage() {
  const locale = readLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const site = await getSiteCopy(supabasePublic(), locale);

  return (
    <>
      <StructuredData site={site} />
      <Nav site={site} locale={locale} />
      <main id="main">
        <Hero site={site} />

        <Section id="philosophy" title={site.philosophy.title}>
          <Prose lines={site.philosophy.body} />
        </Section>

        {/* The product, shown. It sits directly after the argument for why the
            work matters, which is the first point on the page where somebody
            wonders what they would actually be handed. */}
        <PhoneStage
          kicker={site.tagline}
          title={site.value.title}
          body={site.value.body}
        />

        <Steps site={site} />

        <Section id="about" title={site.about.title}>
          <div className="grid items-start gap-8 sm:grid-cols-[minmax(0,260px)_1fr] sm:gap-10">
            <Portrait className="w-full max-w-[260px] rounded-xl2 object-cover" />
            <Prose lines={site.about.body} />
          </div>
        </Section>

        <Section title={site.dayOf.title} className="pt-0">
          <Prose lines={site.dayOf.body} />
        </Section>

        <Section id="work" title={site.work.title} sub={site.work.sub}>
          <Portfolio />
        </Section>

        <Section id="budget" title={site.budget.title} sub={site.budget.sub}>
          <BudgetSimulator />
        </Section>

        <Section title={site.academy.title}>
          <div className="card measure">
            <Prose lines={site.academy.body} className="max-w-none" />
            <Link href="#contact" className="btn-ghost mt-6">{site.academy.cta}</Link>
          </div>
        </Section>

        {/* The one place the page inverts, immediately before the ask. */}
        <DarkBand
          kicker={site.tagline}
          title={site.closing.title}
          body={site.closing.body[0]}
          cta={site.closing.cta}
          href="#contact"
        />

        <Section id="contact" title={site.lead.title} sub={site.lead.sub}>
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <Prose lines={site.closing.body} />
              {/* Two ways in, side by side and honestly labelled: pick a slot
                  now, or leave details and be called back. */}
              <div className="mt-7">
                <BookMeeting className="btn-primary inline-flex items-center gap-2" />
                <p className="mt-2.5 text-[13.5px] text-ink-mute">{site.fab.bookingNote}</p>
              </div>
            </div>
            <LeadForm />
          </div>
        </Section>

        <SiteFooter brand={site.brand} note={site.footer} />
      </main>
      <div className="h-24 sm:h-0" aria-hidden />
      <FabDock />
      <AiConcierge />
    </>
  );
}
