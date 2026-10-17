'use client';

import { useActionState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import {
  ArrowRight, MessageCircle, Phone, Mail, CalendarClock, HeartHandshake, Sparkles, Inbox, Send,
  PhoneCall, ArrowLeftRight, StickyNote, CalendarCheck, FileText, Bell, Check, type LucideIcon,
} from 'lucide-react';
import { useCopy } from '@/components/app/CopyProvider';
import {
  setLeadStatus, updateLead, setNextAction, addLeadEvent, bookCall, convertLead, type LeadActionResult,
} from '@/app/actions/leads';
import { SourceMark, ScoreRing } from '@/components/app/LeadBoard';
import { cn } from '@/lib/utils';
import { fill } from '@/lib/copyText';
import { PIPELINE } from '@/lib/pipeline';
import { shortDate, clock } from '@/lib/appDates';
import { formatDate } from '@/lib/dates';
import { normalizePhone } from '@/lib/phone';

/**
 * One enquiry, whole.
 *
 * The row on the list said a name, a status and a sentence; everything
 * else about a couple lived in the producer's head and in a WhatsApp
 * thread. This is the card: who they are, what they asked for as the
 * reading understood it, the draft of an answer, every field the reading
 * or the producer filled in, the next thing to do, and the timeline of
 * what happened. The actions are the four ways a producer actually
 * answers, in the order they reach for them: WhatsApp, a call, a mail, a
 * reminder; and the one that ends the card, opening the event.
 *
 * The WhatsApp button writes a `message_out` on the timeline when pressed.
 * Not because the message was certainly sent, but because the first
 * response is the one number this screen is judged on, and the moment the
 * producer reached for the phone is the honest stamp for it.
 */

export type FullLead = {
  id: string; full_name: string; partner_name: string; phone: string; email: string;
  instagram_handle: string; kind: string; event_date: string | null; event_date_flexible: boolean | null;
  guest_count: number | null; location: string; budget_min: number | null; budget_max: number | null;
  venue_booked: boolean | null; message: string; note: string; source: string; status: string;
  intent: string; urgency: string; score: number | null; score_reason: string; summary: string;
  suggested_reply: string; next_action: string; next_action_at: string | null; lost_reason: string;
  first_response_at: string | null; created_at: string;
};

export type LeadEvent = {
  id: string; type: string; channel: string; body: string; meta: Record<string, unknown> | null; created_at: string;
};

export type LeadCall = { id: string; title: string; remind_on: string | null; done: boolean };

const EVENT_ICON: Record<string, LucideIcon> = {
  created: Inbox, message_in: MessageCircle, message_out: Send, call: PhoneCall, status_change: ArrowLeftRight,
  note: StickyNote, meeting_scheduled: CalendarCheck, proposal_sent: FileText, notification_sent: Bell, ai_summary: Sparkles,
};

function Busy({ idle, busy, className = 'btn-primary' }: { idle: string; busy: string; className?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} disabled={pending}>{pending ? busy : idle}</button>;
}

function Field({ label, name, defaultValue, type = 'text', dir, inputMode }: {
  label: string; name: string; defaultValue?: string | number | null; type?: string; dir?: 'ltr'; inputMode?: 'tel' | 'email' | 'numeric';
}) {
  const id = `lead-${name}`;
  return (
    <div>
      <label htmlFor={id} className="block text-meta font-medium text-ink-soft">{label}</label>
      <input id={id} name={name} type={type} defaultValue={defaultValue ?? ''} dir={dir} inputMode={inputMode}
        autoComplete="off" className="field mt-1" />
    </div>
  );
}

export function LeadCard({ lead, events, calls, now }: { lead: FullLead; events: LeadEvent[]; calls: LeadCall[]; now: number }) {
  const ui = useCopy();
  const c = ui.pipeline.page;
  const lc = ui.lead;
  const statuses = lc.statuses as Record<string, string>;
  const sources = lc.sources as Record<string, string>;
  const dateFmt = shortDate(ui.locale);
  const timeFmt = clock(ui.locale);

  const [editState, editAction] = useActionState<LeadActionResult | null, FormData>(updateLead, null);
  const [nextState, nextAction] = useActionState<LeadActionResult | null, FormData>(setNextAction, null);
  const [noteState, noteAction] = useActionState<LeadActionResult | null, FormData>(addLeadEvent, null);
  const [callState, callAction] = useActionState<LeadActionResult | null, FormData>(bookCall, null);
  const [, start] = useTransition();

  const who = lead.partner_name ? `${lead.full_name} ו${lead.partner_name}` : lead.full_name;
  const tel = normalizePhone(lead.phone);
  const wa = tel
    ? `https://wa.me/${tel.replace('+', '')}${lead.suggested_reply ? `?text=${encodeURIComponent(lead.suggested_reply)}` : ''}`
    : null;

  const noteOut = () => start(async () => {
    const f = new FormData();
    f.set('lead_id', lead.id);
    f.set('type', 'message_out');
    f.set('channel', 'whatsapp');
    f.set('body', lead.suggested_reply);
    await addLeadEvent(null, f);
  });

  const openCalls = calls.filter((k) => !k.done);
  const when = (iso: string) => `${formatDate(dateFmt, iso.slice(0, 10), '')} ${timeFmt.format(new Date(iso))}`;
  const nextLocal = lead.next_action_at
    ? new Date(new Date(lead.next_action_at).getTime() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
    : '';
  const overdueNext = lead.next_action_at ? new Date(lead.next_action_at).getTime() < now : false;

  const PATH = ['new', 'contacted', 'meeting', 'proposal_sent', 'won'] as const;
  const stepAt = (PATH as readonly string[]).indexOf(lead.status);

  const actions = (
    <>
      {wa && (
        <a href={wa} target="_blank" rel="noopener" onClick={noteOut} className="btn-primary inline-flex items-center gap-1.5">
          <MessageCircle size={16} strokeWidth={1.5} aria-hidden />{c.whatsapp}
        </a>
      )}
      {tel && (
        <a href={`tel:${tel}`} className="btn-ghost inline-flex items-center gap-1.5">
          <Phone size={16} strokeWidth={1.5} aria-hidden />{c.call}
        </a>
      )}
      {lead.email && (
        <a href={`mailto:${lead.email}`} className="btn-ghost inline-flex items-center gap-1.5">
          <Mail size={16} strokeWidth={1.5} aria-hidden />{c.mail}
        </a>
      )}
      <form action={convertLead}>
        <input type="hidden" name="lead_id" value={lead.id} />
        <button type="submit" className="btn-ghost inline-flex items-center gap-1.5">
          <HeartHandshake size={16} strokeWidth={1.5} aria-hidden />{c.convert}
        </button>
      </form>
    </>
  );

  return (
    <div className="space-y-6">
      <Link href="/app/leads" className="btn-quiet inline-flex items-center gap-1 px-0 text-body">
        <ArrowRight size={15} strokeWidth={1.5} aria-hidden className="rtl:rotate-0 ltr:rotate-180" />
        {c.back}
      </Link>

      {/* The same ring the list wears, bigger, and the five stages as one
          path. On a desk the stages are the control: a press is the same
          write the select makes. On a phone they are a bar and a sentence,
          because five targets a thumb can hit do not fit on one line, and
          the select is the control there. */}
      <header className="card">
        <div className="flex items-center gap-4 lg:gap-6">
          <span className="lg:hidden"><ScoreRing score={lead.score} size={56} /></span>
          <span className="hidden lg:block"><ScoreRing score={lead.score} size={84} /></span>
          <div className="min-w-0 flex-1">
            <h1 className="head-panel lg:font-display lg:text-title lg:font-light">{who}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-ink-mute">
              <SourceMark source={lead.source} label={sources[lead.source] ?? lead.source} />
              <span dir="ltr">{[lead.phone, lead.email].filter(Boolean).join(' · ')}</span>
            </p>
          </div>
          <div className="hidden flex-wrap justify-end gap-2 lg:flex">{actions}</div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line pt-4">
          <form action={setLeadStatus} className="hidden min-w-0 flex-1 lg:block">
            <input type="hidden" name="lead_id" value={lead.id} />
            <ol aria-label={c.stages} className="flex list-none items-start p-0">
              {PATH.map((st, i) => {
                const done = stepAt >= 0 && i <= stepAt;
                const here = i === stepAt;
                return (
                  <li key={st} className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5">
                    <span aria-hidden className="flex w-full items-center">
                      <span className={cn('h-0.5 flex-1', i === 0 ? 'bg-transparent' : done ? 'bg-accent' : 'bg-surface-200')} />
                      <span className={cn('rounded-full', here ? 'size-3.5 bg-accent ring-4 ring-accent/25' : done ? 'size-2.5 bg-accent' : 'size-2.5 bg-surface-200')} />
                      <span className={cn('h-0.5 flex-1', i === PATH.length - 1 ? 'bg-transparent' : i < stepAt ? 'bg-accent' : 'bg-surface-200')} />
                    </span>
                    <button type="submit" name="status" value={st} aria-current={here ? 'step' : undefined}
                      className={cn('min-h-[32px] px-2 text-meta transition-colors duration-touch', here ? 'text-ink' : 'text-ink-mute hover:text-ink')}>
                      {statuses[st] ?? st}
                    </button>
                  </li>
                );
              })}
            </ol>
          </form>

          {stepAt >= 0 && (
            <div className="min-w-0 flex-1 lg:hidden">
              <span aria-hidden className="flex gap-1.5">
                {PATH.map((st, i) => <span key={st} className={cn('h-1.5 flex-1 rounded-full', i <= stepAt ? 'bg-accent' : 'bg-surface-200')} />)}
              </span>
              <p className="mt-2 text-body text-ink">
                {statuses[lead.status] ?? lead.status}
                <span className="text-ink-mute"> · {fill(c.stageOf, { n: stepAt + 1, total: PATH.length })}</span>
              </p>
            </div>
          )}

          <form action={setLeadStatus}>
            <input type="hidden" name="lead_id" value={lead.id} />
            <select name="status" defaultValue={lead.status} onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className="field w-[160px] py-1.5 text-body" aria-label={ui.leads.cols.status}>
              {PIPELINE.map((st) => <option key={st} value={st}>{statuses[st] ?? st}</option>)}
            </select>
          </form>
        </div>

        {/* Mail and the end of the card are one press away on a phone; the
            two the thumb reaches for first are in the bar below it. */}
        <div className="mt-4 flex flex-wrap gap-2 lg:hidden">
          {lead.email && (
            <a href={`mailto:${lead.email}`} className="btn-ghost inline-flex items-center gap-1.5">
              <Mail size={16} strokeWidth={1.5} aria-hidden />{c.mail}
            </a>
          )}
          <form action={convertLead}>
            <input type="hidden" name="lead_id" value={lead.id} />
            <button type="submit" className="btn-ghost inline-flex items-center gap-1.5">
              <HeartHandshake size={16} strokeWidth={1.5} aria-hidden />{c.convert}
            </button>
          </form>
        </div>
      </header>

      {(wa || tel) && (
        <div className="fixed inset-x-0 bottom-[calc(57px+env(safe-area-inset-bottom,0px))] z-30 flex gap-2 border-t border-line bg-card px-4 py-3 lg:hidden">
          {wa && (
            <a href={wa} target="_blank" rel="noopener" onClick={noteOut} className="btn-primary inline-flex min-h-[48px] flex-1 items-center justify-center gap-1.5">
              <MessageCircle size={17} strokeWidth={1.5} aria-hidden />{c.whatsapp}
            </a>
          )}
          {tel && (
            <a href={`tel:${tel}`} className="btn-ghost inline-flex min-h-[48px] items-center justify-center gap-1.5 px-5">
              <Phone size={17} strokeWidth={1.5} aria-hidden />{c.call}
            </a>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* On a desk what is next comes first and the message last; on a
            phone the conversation reads in the order it happened, the
            message and then the draft that answers it. */}
        <div className="flex flex-col gap-4 lg:gap-6">
          {lead.message && (
            <blockquote className="order-1 rounded-card-sm bg-surface-100 px-4 py-3 text-body leading-relaxed text-ink-soft lg:order-4">
              <p className="eyebrow mb-1">{c.message}</p>
              “{lead.message}”
            </blockquote>
          )}

          {lead.suggested_reply && (
            <div className="order-2 rounded-card-sm border border-line-strong p-4 lg:order-3">
              <p className="eyebrow">{c.reply}</p>
              <p className="mt-1 whitespace-pre-line text-body text-ink">{lead.suggested_reply}</p>
              <p className="mt-1 text-meta text-ink-mute">{c.replyHint}</p>
            </div>
          )}

          {(lead.summary || lead.score_reason) && (
            <div className="order-4 grid gap-3 sm:grid-cols-2 lg:order-2">
              {lead.summary && (
                <div className="rounded-card-sm bg-accent-wash p-3">
                  <p className="eyebrow flex items-center gap-1.5"><Sparkles size={13} aria-hidden />{c.summary}</p>
                  <p className="mt-1 text-body text-ink">{lead.summary}</p>
                </div>
              )}
              {lead.score_reason && (
                <div className="rounded-card-sm bg-surface-100 p-3">
                  <p className="eyebrow">{c.reason}</p>
                  <p className="mt-1 text-body text-ink-soft">{lead.score_reason}</p>
                </div>
              )}
            </div>
          )}

          <section className="card order-3 lg:order-1" aria-labelledby="lead-next">
            <h2 id="lead-next" className="head-section flex items-center gap-2">
              <CalendarClock size={17} strokeWidth={1.5} aria-hidden className="text-accent" />
              {c.next.title}
            </h2>
            {lead.next_action
              ? <p className={`mt-2 text-lead ${overdueNext ? 'text-bad' : 'text-ink'}`}>{lead.next_action}{lead.next_action_at ? ` · ${when(lead.next_action_at)}` : ''}</p>
              : <p className="mt-2 text-body text-ink-mute">{c.next.none}</p>}
            <form action={nextAction} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="lead_id" value={lead.id} />
              <label className="min-w-[180px] flex-1 text-meta text-ink-soft">
                {c.next.what}
                <input name="next_action" defaultValue={lead.next_action} className="field mt-1" autoComplete="off" enterKeyHint="next" />
              </label>
              <label className="text-meta text-ink-soft">
                {c.next.when}
                <input name="next_action_at" type="datetime-local" defaultValue={nextLocal} className="field mt-1 block" dir="ltr" />
              </label>
              <Busy idle={c.next.save} busy={c.saving} className="btn-ghost" />
              {nextState && !nextState.ok && <span role="alert" className="text-body text-bad">{nextState.error}</span>}
            </form>
            {openCalls.length > 0 && (
              <ul className="mt-3 list-none space-y-1 p-0 text-body text-ink-soft">
                {openCalls.map((k) => <li key={k.id}>{k.title}{k.remind_on ? ` · ${formatDate(dateFmt, k.remind_on, '')}` : ''}</li>)}
              </ul>
            )}
            <form action={callAction} className="mt-3 flex flex-wrap gap-2">
              <input type="hidden" name="lead_id" value={lead.id} />
              <input type="hidden" name="phone" value={lead.phone} />
              <input name="title" defaultValue={lc.callTitle} className="field min-w-[160px] flex-1" aria-label={lc.callTitle} autoComplete="off" enterKeyHint="next" />
              <input name="remind_on" type="date" required className="field w-[160px]" aria-label={lc.callWhen} autoComplete="off" />
              <Busy idle={c.meeting} busy={lc.callBooking} className="btn-ghost" />
              {callState && !callState.ok && <span role="alert" className="text-body text-bad">{callState.error}</span>}
            </form>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card" aria-labelledby="lead-details">
            <h2 id="lead-details" className="head-section">{c.details}</h2>
            <form action={editAction} className="mt-3 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="lead_id" value={lead.id} />
              <Field label={c.name} name="full_name" defaultValue={lead.full_name} />
              <Field label={c.partner} name="partner_name" defaultValue={lead.partner_name} />
              <Field label={c.phone} name="phone" defaultValue={lead.phone} type="tel" dir="ltr" inputMode="tel" />
              <Field label={c.email} name="email" defaultValue={lead.email} type="email" dir="ltr" inputMode="email" />
              <Field label={c.instagram} name="instagram_handle" defaultValue={lead.instagram_handle} dir="ltr" />
              <Field label={c.location} name="location" defaultValue={lead.location} />
              <Field label={c.date} name="event_date" defaultValue={lead.event_date ?? ''} type="date" dir="ltr" />
              <Field label={c.guests} name="guest_count" defaultValue={lead.guest_count} type="number" dir="ltr" inputMode="numeric" />
              <Field label={c.budgetMin} name="budget_min" defaultValue={lead.budget_min} type="number" dir="ltr" inputMode="numeric" />
              <Field label={c.budgetMax} name="budget_max" defaultValue={lead.budget_max} type="number" dir="ltr" inputMode="numeric" />
              <label className="inline-flex items-center gap-2 text-body text-ink">
                <input type="checkbox" name="event_date_flexible" defaultChecked={Boolean(lead.event_date_flexible)} className="size-4" />{c.flexible}
              </label>
              <label className="inline-flex items-center gap-2 text-body text-ink">
                <input type="checkbox" name="venue_booked" defaultChecked={Boolean(lead.venue_booked)} className="size-4" />{c.venueBooked}
              </label>
              {(lead.status === 'lost' || lead.lost_reason) && (
                <div className="sm:col-span-2"><Field label={c.lostReason} name="lost_reason" defaultValue={lead.lost_reason} /></div>
              )}
              <div className="flex items-center gap-3 sm:col-span-2">
                <Busy idle={c.save} busy={c.saving} />
                {editState?.ok && <span className="inline-flex items-center gap-1 text-body text-ok"><Check size={15} aria-hidden />{c.saved}</span>}
                {editState && !editState.ok && <span role="alert" className="text-body text-bad">{editState.error}</span>}
              </div>
            </form>
          </section>

        <section className="card" aria-labelledby="lead-timeline">
          <h2 id="lead-timeline" className="head-section">{c.timeline.title}</h2>
          <form action={noteAction} className="mt-3 flex gap-2">
            <input type="hidden" name="lead_id" value={lead.id} />
            <input type="hidden" name="type" value="note" />
            <input name="body" placeholder={c.timeline.notePh} aria-label={c.timeline.note} className="field min-w-0 flex-1" autoComplete="off" enterKeyHint="done" />
            <Busy idle={c.timeline.add} busy={c.saving} className="btn-ghost" />
          </form>
          {noteState && !noteState.ok && <p role="alert" className="mt-1 text-body text-bad">{noteState.error}</p>}
          {events.length === 0 ? (
            <p className="mt-3 text-body text-ink-mute">{c.timeline.empty}</p>
          ) : (
            <ol className="mt-4 list-none space-y-3 p-0">
              {[...events].reverse().map((e) => {
                const Icon = EVENT_ICON[e.type] ?? StickyNote;
                const types = c.timeline.types as Record<string, string>;
                return (
                  <li key={e.id} className="flex gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-200 text-ink-mute">
                      <Icon size={15} strokeWidth={1.5} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-meta text-ink-mute">
                        {types[e.type] ?? e.type}{e.channel && e.channel !== 'system' ? ` · ${sources[e.channel] ?? e.channel}` : ''} · {when(e.created_at)}
                      </p>
                      {e.body && <p className="mt-0.5 whitespace-pre-line text-body text-ink">{e.body}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
        </div>
      </div>
    </div>
  );
}
