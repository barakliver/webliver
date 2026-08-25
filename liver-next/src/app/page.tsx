import Link from 'next/link';
import { site } from '@/content/site';
import { Nav } from '@/components/marketing/Nav';
import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { Prose } from '@/components/marketing/Prose';
import { Journey } from '@/components/marketing/Journey';
import { BudgetSimulator } from '@/components/marketing/BudgetSimulator';
import { LeadForm } from '@/components/marketing/LeadForm';
import { Portfolio } from '@/components/marketing/Portfolio';
import { Portrait } from '@/components/marketing/Portrait';
import { FabDock } from '@/components/marketing/FabDock';
import { BookMeeting } from '@/components/marketing/BookMeeting';

export default function HomePage() {
  return (
    <>
      <Nav />
      <main id="main">
        <Hero />

        <Section id="philosophy" title={site.philosophy.title}>
          <Prose lines={site.philosophy.body} />
        </Section>

        <Section title={site.value.title} className="pt-0">
          <Prose lines={site.value.body} />
        </Section>

        <Journey />

        <Section id="about" title={site.about.title}>
          <div className="grid items-start gap-8 sm:grid-cols-[minmax(0,260px)_1fr] sm:gap-10">
            <Portrait className="w-full max-w-[260px] rounded-2xl object-cover shadow-soft" />
            <Prose lines={site.about.body} />
          </div>
        </Section>

        <Section title={site.dayOf.title} className="pt-0">
          <Prose lines={site.dayOf.body} />
        </Section>

        <Section
          id="work"
          title="עבודות אחרונות"
          sub="שמונה רגעים מאירועים שהופקו בשנה האחרונה."
        >
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

        <Section id="contact" title={site.closing.title} sub={site.lead.sub}>
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

        <footer className="border-t border-line py-10">
          <div className="shell text-[13.5px] text-ink-mute">
            {site.brand} · {site.footer}
          </div>
        </footer>
      </main>
      <div className="h-24 sm:h-0" aria-hidden />
      <FabDock />
    </>
  );
}
