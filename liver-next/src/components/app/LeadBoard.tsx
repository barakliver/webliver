'use client';

import { useEffect, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Globe, Phone, MessageCircle, Instagram, Facebook, Search, Users, Footprints, Webhook, Mail,
  Gamepad2, Calculator, ChevronLeft, type LucideIcon,
} from 'lucide-react';
import { useCopy } from '@/components/app/CopyProvider';
import { useDragOnto, Grip, Carried } from '@/components/app/DragOnto';
import { setLeadStatus } from '@/app/actions/leads';
import { fill } from '@/lib/copyText';
import { cn } from '@/lib/utils';
import { shortDate } from '@/lib/appDates';
import { formatDate } from '@/lib/dates';
import {
  PIPELINE, byStage, filterLeads, isStage, isUnanswered, pipelineStats, sourcesOf, ago,
  type BoardLead, type Filter, type Stage,
} from '@/lib/pipeline';
import { useDesk } from '@/lib/useWide';

/**
 * The pipeline: columns on a desk, a short list on a phone.
 *
 * Seven columns are a desk shape. On a phone the board was a row of 248px
 * lanes to drag sideways through, and the thing somebody opens it for is one
 * question: who is waiting for me. So from `lg` down it is the answer to that,
 * the unanswered first and everything open under them, each a row with the
 * ring that is its score; the stage tabs filter it the way the columns do.
 * The same rows, the same filters and the same stage write, drawn twice.
 *
 * The pipeline as columns.
 *
 * A card is a lead and a column is its status; moving a card is the same
 * write the select on the old row made, so nothing about the board is a
 * second store. The board moves first and the server catches up, for the
 * reason the crew board gives: a screen that waits a round trip per drag is
 * a screen somebody drags twice.
 *
 * Two ways to move a card, both real. Dragging, on pointer events through
 * `useDragOnto`, which is the only drag this app writes; and the select on
 * the card, which is the one that works with a thumb, a keyboard and a
 * screen reader. The select is the implementation and the drag is the
 * decoration over it.
 *
 * The list view is the old rows, handed in by the page, so the two views
 * cannot drift: one of them is not a second rendering of the same data.
 */

export const SOURCE_ICON: Record<string, LucideIcon> = {
  site: Globe, phone: Phone, whatsapp: MessageCircle, instagram: Instagram, facebook: Facebook,
  meta: Facebook, google_ads: Search, referral: Users, walk_in: Footprints, webhook: Webhook,
  email: Mail, before_i_do: Gamepad2, budget_calculator: Calculator,
};

export function SourceMark({ source, label }: { source: string; label: string }) {
  const Icon = SOURCE_ICON[source] ?? Webhook;
  return (
    <span className="inline-flex items-center gap-1 text-meta text-ink-mute" title={label}>
      <Icon size={13} strokeWidth={1.5} aria-hidden />
      <span className="sr-only sm:not-sr-only">{label}</span>
    </span>
  );
}

/** A score as the ring it fills: 0 empty, 100 closed. Colour is the same
 *  three-way read the chip gives, so a ring and a chip never disagree. A lead
 *  nobody has scored yet is a dashed ring with no number, not a zero. */
export function ScoreRing({ score, size = 34 }: { score: number | null | undefined; size?: number }) {
  const box = { width: size, height: size };
  if (score === null || score === undefined) {
    return <span aria-hidden className="shrink-0 rounded-full border border-dashed border-line-strong" style={box} />;
  }
  const tone = score >= 70 ? 'text-ok' : score >= 40 ? 'text-warn' : 'text-ink-mute';
  const numeral = size >= 72 ? 'text-figure font-light' : size >= 48 ? 'text-lead' : size >= 38 ? 'text-meta' : 'text-micro';
  return (
    <span className="relative grid shrink-0 place-items-center" style={box} role="img" aria-label={String(score)} title="0 עד 100">
      <svg aria-hidden width={size} height={size} viewBox="0 0 64 64" className="absolute inset-0 -rotate-90 rtl:rotate-90 rtl:-scale-x-100">
        <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="5" className="text-surface-200" />
        <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"
          className={`ring-arc ${tone}`} style={{ ['--to' as string]: Math.round(176 * (1 - score / 100)) }} />
      </svg>
      <span className={cn('relative leading-none tabular-nums text-ink', numeral)}>{score}</span>
    </span>
  );
}

export function ScoreChip({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) return null;
  const tone = score >= 70 ? 'bg-ok-wash text-ok' : score >= 40 ? 'bg-warn-wash text-warn' : 'bg-surface-200 text-ink-mute';
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-micro font-medium tabular-nums', tone)} title="0 עד 100">
      {score}
    </span>
  );
}

const VIEW_KEY = 'leads-view';

/* The five stages that are a path, left to right, and the two a lead can step
   off it into. The side two are folded to a strip on a desk: they matter, and
   they are not where the day's work is. */
const PATH = ['new', 'contacted', 'meeting', 'proposal_sent', 'won'] as const;
const SIDE = ['nurture', 'lost'] as const;

/* A tone to a stage, light at both ends of the path and the deepest at the
   proposal, so a board is read left to right as a colour that gathers and
   then lets go. The two side stages are the quiet ones. Written out in full
   because Tailwind reads class names as text. */
const STAGE_TONE: Record<string, { dot: string; pill: string }> = {
  new:           { dot: 'bg-tone-camel',    pill: 'bg-tone-camel text-tone-camel-on' },
  contacted:     { dot: 'bg-tone-boho',     pill: 'bg-tone-boho text-tone-boho-on' },
  meeting:       { dot: 'bg-tone-rubine',   pill: 'bg-tone-rubine text-tone-rubine-on' },
  proposal_sent: { dot: 'bg-tone-tamarind', pill: 'bg-tone-tamarind text-tone-tamarind-on' },
  won:           { dot: 'bg-tone-camel',    pill: 'bg-tone-camel text-tone-camel-on' },
  nurture:       { dot: 'bg-tone-boho',     pill: 'bg-tone-boho-wash text-tone-boho-ink' },
  lost:          { dot: 'bg-tone-tamarind', pill: 'bg-tone-tamarind-wash text-tone-tamarind-ink' },
};
const toneOf = (stage: string) => STAGE_TONE[stage] ?? STAGE_TONE.new;

/** Five marks that say how far along: the stage it is at is the long one. */
function Dots({ stage }: { stage: string }) {
  const at = (PATH as readonly string[]).indexOf(stage);
  if (at < 0) return null;
  return (
    <span aria-hidden className="flex shrink-0 items-center gap-1">
      {PATH.map((p, i) => (
        <span key={p} className={cn('h-1.5 rounded-full', i === at ? 'w-4' : 'w-1.5', i <= at ? 'bg-accent' : 'bg-surface-200')} />
      ))}
    </span>
  );
}

export function LeadBoard({ leads, now, list }: {
  leads: BoardLead[];
  /** The clock at render, from the server, so the age on every card agrees
   *  between the HTML and the first client render. */
  now: number;
  /** The same leads as rows, for the list view. */
  list: ReactNode;
}) {
  const ui = useCopy();
  const c = ui.pipeline;
  const statuses = ui.lead.statuses as Record<string, string>;
  const sources = ui.lead.sources as Record<string, string>;
  const dateFmt = shortDate(ui.locale);

  const [view, setView] = useState<'board' | 'list'>('board');
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(VIEW_KEY);
      if (v === 'list' || v === 'board') setView(v);
    } catch { /* a browser that refuses storage keeps the default */ }
  }, []);
  const pick = (v: 'board' | 'list') => {
    setView(v);
    try { window.localStorage.setItem(VIEW_KEY, v); } catch { /* same */ }
  };

  const [filter, setFilter] = useState<Filter>({});
  const [rows, setRows] = useState(leads);
  useEffect(() => { setRows(leads); }, [leads]);
  const [, start] = useTransition();
  /* Which of the two folded columns are open. Folded is the rest state. */
  const [openSide, setOpenSide] = useState<Partial<Record<Stage, boolean>>>({});
  /* The phone's stage tabs: everything open, or one stage. */
  const [tab, setTab] = useState<'all' | Stage>('all');
  /* Null until the browser has said how wide it is: draw the desk, which is
     what the server drew. */
  const desk = useDesk();

  const move = (id: string, stage: Stage) => {
    setRows((prev) => prev.map((l) => (l.id === id ? { ...l, status: stage } : l)));
    start(async () => {
      const f = new FormData();
      f.set('lead_id', id);
      f.set('status', stage);
      await setLeadStatus(f);
    });
  };

  const drag = useDragOnto<string>({
    canDrop: (_id, zone) => isStage(zone),
    onDrop: (id, zone) => { if (isStage(zone)) move(id, zone); },
  });

  const shown = filterLeads(rows, filter, now);
  const cols = byStage(shown);
  const stats = pipelineStats(rows, now);
  const sourceList = sourcesOf(rows);
  const carried = drag.item ? rows.find((l) => l.id === drag.item) : null;

  const agoLabel = (iso: string) => {
    const a = ago(iso, now);
    return fill(c.card.ago[a.unit], { n: a.n });
  };
  const whoOf = (l: BoardLead) => (l.partner_name ? `${l.full_name} ו${l.partner_name}` : l.full_name);

  const cells: { k: string; v: string | number; sub?: string; bad?: boolean }[] = [
    { k: c.stats.newWeek, v: stats.newThisWeek, sub: stats.unanswered > 0 ? `${stats.unanswered} ${c.stats.unanswered}` : undefined, bad: true },
    { k: c.stats.toMeeting, v: stats.toMeeting === null ? c.stats.none : `${stats.toMeeting}%`, sub: c.stats.toMeetingSub },
    { k: c.stats.response, v: stats.responseHours === null ? c.stats.none : stats.responseHours, sub: c.stats.responseSub },
  ];

  /* One card of the desk board. */
  const card = (l: BoardLead) => {
    const late = isUnanswered(l, now);
    const who = whoOf(l);
    return (
      <li key={l.id} {...drag.row(l.id)}
        className={cn('rounded-card-sm border bg-card p-3', late ? 'border-line border-s-[3px] border-s-bad' : 'border-line')}>
        <div className="flex items-start gap-1.5">
          <Grip label={`${c.card.drag}: ${who}`} {...drag.grip(l.id)} />
          <div className="min-w-0 flex-1">
            <Link href={`/app/leads/${l.id}`} className="block text-lead font-medium leading-snug text-ink hover:text-accent">{who}</Link>
            <p className="mt-0.5 text-meta text-ink-mute">
              {l.event_date ? formatDate(dateFmt, l.event_date, '') : c.card.noDate}
              {l.guest_count ? ` · ${fill(c.card.guests, { n: l.guest_count })}` : ''}
            </p>
            {l.summary && <p className="mt-1 line-clamp-2 text-meta text-ink-soft">{l.summary}</p>}
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                <SourceMark source={l.source} label={sources[l.source] ?? l.source} />
                <span className="text-micro text-ink-mute">{agoLabel(l.created_at)}</span>
                {late && <span className="chip-bad">{c.card.unanswered}</span>}
              </span>
              <ScoreRing score={l.score} size={32} />
            </div>
          </div>
        </div>
        <select aria-label={c.card.move} value={l.status} onChange={(e) => move(l.id, e.target.value as Stage)}
          className="field mt-2 w-full py-1 text-meta">
          {PIPELINE.map((s) => <option key={s} value={s}>{statuses[s] ?? s}</option>)}
        </select>
      </li>
    );
  };

  const column = (stage: Stage, className: string) => (
    <section
      key={stage}
      aria-label={statuses[stage] ?? stage}
      {...drag.zone(stage)}
      className={cn(
        'shrink-0 rounded-card border p-2 transition-colors duration-touch',
        className,
        drag.over === stage ? 'border-accent bg-accent-wash' : 'border-line bg-surface-100',
      )}
    >
      <h3 className="flex items-baseline justify-between px-1 pb-2 pt-1">
        <span className="flex items-center gap-2 text-body font-medium text-ink">
          <span aria-hidden className={cn('size-2.5 rounded-full', toneOf(stage).dot)} />
          {statuses[stage] ?? stage}
        </span>
        <span className="flex items-center gap-2">
          <span className={cn('rounded-full px-2 text-meta tabular-nums', toneOf(stage).pill)}>{cols[stage].length}</span>
          {(SIDE as readonly string[]).includes(stage) && (
            <button type="button" onClick={() => setOpenSide((o) => ({ ...o, [stage]: false }))}
              className="text-meta text-ink-mute hover:text-ink">{c.lane.close}</button>
          )}
        </span>
      </h3>
      <ul className="list-none space-y-2 p-0">
        {cols[stage].length === 0 && (
          <li className="rounded-card-sm border border-dashed border-line px-3 py-4 text-center text-meta text-ink-mute">{c.card.empty}</li>
        )}
        {cols[stage].map(card)}
      </ul>
    </section>
  );

  /* The strip a folded column leaves behind. Still a place a card can be
     dropped, and still opened by a press: folded is a state, not a deletion. */
  const lane = (stage: Stage) => (
    <section key={stage} aria-label={statuses[stage] ?? stage} {...drag.zone(stage)}
      className={cn('w-[52px] shrink-0 rounded-card border transition-colors duration-touch',
        drag.over === stage ? 'border-accent bg-accent-wash' : 'border-line bg-surface-100')}>
      <button type="button" onClick={() => setOpenSide((o) => ({ ...o, [stage]: true }))}
        aria-expanded={false} aria-label={`${c.lane.open}: ${statuses[stage] ?? stage}`}
        className="flex h-full min-h-[220px] w-full flex-col items-center gap-3 px-1 py-4 text-ink-soft hover:text-ink">
        <span className={cn('rounded-full px-2 text-meta tabular-nums', toneOf(stage).pill)}>{cols[stage].length}</span>
        <span className="text-body [writing-mode:vertical-rl]">{statuses[stage] ?? stage}</span>
      </button>
    </section>
  );

  /* The phone's row: the ring, who, and either "go and answer" or how far
     along. The press opens the card, where WhatsApp is the big button; the
     one that writes the first-response stamp is not duplicated here. */
  const row = (l: BoardLead) => {
    const late = isUnanswered(l, now);
    return (
      <li key={l.id}>
        <Link href={`/app/leads/${l.id}`}
          className={cn('flex items-center gap-3 rounded-card-sm border bg-card p-3', late ? 'border-line border-s-[3px] border-s-bad' : 'border-line')}>
          <ScoreRing score={l.score} size={40} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-lead text-ink">{whoOf(l)}</span>
            <span className="mt-0.5 block truncate text-meta text-ink-mute">
              {late
                ? `${l.event_date ? formatDate(dateFmt, l.event_date, '') : c.card.noDate} · ${agoLabel(l.created_at)}`
                : `${statuses[l.status] ?? l.status} · ${agoLabel(l.created_at)}`}
            </span>
          </span>
          {late
            ? <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-surface"><ChevronLeft size={17} strokeWidth={1.75} className="rtl:rotate-0 ltr:rotate-180" /></span>
            : <Dots stage={l.status} />}
          <span className="sr-only">{c.card.open}</span>
        </Link>
      </li>
    );
  };

  const waiting = shown.filter((l) => isUnanswered(l, now));
  const moving = shown.filter((l) => !isUnanswered(l, now) && (PATH as readonly string[]).includes(l.status) && l.status !== 'won');
  const group = (title: string, tone: string, items: BoardLead[]) => items.length === 0 ? null : (
    <section>
      <h3 className="mb-2 flex items-baseline gap-2"><span className={cn('text-body', tone)}>{title}</span><span className="text-meta tabular-nums text-ink-mute">{items.length}</span></h3>
      <ul className="list-none space-y-2 p-0">{items.map(row)}</ul>
    </section>
  );

  const tabs: ('all' | Stage)[] = ['all', ...PATH.filter((p) => p !== 'won'), 'won'];
  const tabCount = (t: 'all' | Stage) => (t === 'all' ? waiting.length + moving.length : cols[t].length);

  return (
    <div className="space-y-5">
      {/* One object with three figures in it rather than three cards: the
          same move the couple's four figures made, and the same reason. */}
      <div className="card grid grid-cols-3 p-0">
        {cells.map((m) => (
          <div key={m.k} className="min-w-0 border-line px-3 py-3 sm:px-6 sm:py-4 [&:not(:first-child)]:border-s">
            <p className="truncate text-meta text-ink-mute">{m.k}</p>
            <p className="mt-1 font-display text-panel font-light leading-none tabular-nums text-ink sm:text-[34px]">{m.v}</p>
            {m.sub && <p className={cn('mt-1 hidden text-meta sm:block', m.bad ? 'text-bad' : 'text-ink-mute')}>{m.sub}</p>}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex gap-1 rounded-full bg-surface-200 p-1" role="group" aria-label={`${c.view.board} · ${c.view.list}`}>
          {(['board', 'list'] as const).map((v) => (
            <button key={v} type="button" onClick={() => pick(v)} aria-pressed={view === v}
              className={cn('inline-flex min-h-[36px] items-center rounded-full px-4 text-body transition-colors duration-touch',
                view === v ? 'bg-ink text-surface' : 'text-ink-soft hover:text-ink')}>
              {c.view[v]}
            </button>
          ))}
        </div>

        <select aria-label={c.filters.source} value={filter.source ?? ''} className="field w-auto py-1.5 text-body"
          onChange={(e) => setFilter((f) => ({ ...f, source: e.target.value || undefined }))}>
          <option value="">{c.filters.allSources}</option>
          {sourceList.map((s) => <option key={s} value={s}>{sources[s] ?? s}</option>)}
        </select>

        <select aria-label={c.filters.score} value={filter.minScore ?? 0} className="field w-auto py-1.5 text-body"
          onChange={(e) => setFilter((f) => ({ ...f, minScore: Number(e.target.value) || undefined }))}>
          <option value={0}>{c.filters.anyScore}</option>
          <option value={50}>{c.filters.score50}</option>
          <option value={80}>{c.filters.score80}</option>
        </select>

        <label className="inline-flex items-center gap-2 text-body text-ink-soft">
          <input type="checkbox" className="size-4" checked={Boolean(filter.unanswered)}
            onChange={(e) => setFilter((f) => ({ ...f, unanswered: e.target.checked || undefined }))} />
          {c.filters.unanswered}
        </label>
      </div>

      {view === 'list' ? list : desk === false ? (
        /* The phone. Stage tabs as an underlined row that scrolls, then who
           is waiting, then everything else that is open. */
        <div className="space-y-4">
          <div className="-mx-4 flex gap-5 overflow-x-auto border-b border-line px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label={c.view.board}>
            {tabs.map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                className={cn('min-h-[44px] shrink-0 whitespace-nowrap border-b-2 text-body transition-colors duration-touch',
                  tab === t ? 'border-accent text-accent' : 'border-transparent text-ink-soft hover:text-ink')}>
                {t === 'all' ? c.groups.all : statuses[t] ?? t} <span className="tabular-nums">{tabCount(t)}</span>
              </button>
            ))}
          </div>
          {tab === 'all' ? (
            <>
              {group(c.groups.waiting, 'text-bad', waiting)}
              {group(c.groups.moving, 'text-ink', moving)}
              {waiting.length + moving.length === 0 && <p className="text-body text-ink-mute">{c.card.empty}</p>}
            </>
          ) : (
            <ul className="list-none space-y-2 p-0">
              {cols[tab].length === 0 ? <li className="text-body text-ink-mute">{c.card.empty}</li> : cols[tab].map(row)}
            </ul>
          )}
        </div>
      ) : (
        <div className="flex snap-x items-stretch gap-3 overflow-x-auto pb-3 [contain:paint]">
          {PATH.map((stage) => column(stage, 'min-w-[200px] flex-1 snap-start'))}
          {SIDE.map((stage) => (openSide[stage] ? column(stage, 'w-[248px] snap-start') : lane(stage)))}
        </div>
      )}

      <Carried at={drag.at}>{carried?.full_name}</Carried>
    </div>
  );
}
