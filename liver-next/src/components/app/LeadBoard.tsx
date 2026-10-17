'use client';

import { useEffect, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Globe, Phone, MessageCircle, Instagram, Facebook, Search, Users, Footprints, Webhook, Mail,
  Gamepad2, Calculator, LayoutGrid, List, type LucideIcon,
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
import { Metric } from '@/components/app/Metric';

/**
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

  return (
    <div className="space-y-5">
      {/* Three across at every width. Stacked on a phone they were three
          screens of one number each before the board began. */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Metric kicker={c.stats.newWeek} value={stats.newThisWeek}
          sub={stats.unanswered > 0 ? `${stats.unanswered} ${c.stats.unanswered}` : undefined} />
        <Metric kicker={c.stats.toMeeting} value={stats.toMeeting === null ? c.stats.none : `${stats.toMeeting}%`} sub={c.stats.toMeetingSub} />
        <Metric kicker={c.stats.response} value={stats.responseHours === null ? c.stats.none : stats.responseHours} sub={c.stats.responseSub} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-control border border-line p-0.5" role="group" aria-label={`${c.view.board} · ${c.view.list}`}>
          {(['board', 'list'] as const).map((v) => {
            const Icon = v === 'board' ? LayoutGrid : List;
            return (
              <button key={v} type="button" onClick={() => pick(v)} aria-pressed={view === v}
                className={cn('inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-body transition-colors duration-touch',
                  view === v ? 'bg-ink text-card' : 'text-ink-soft hover:text-ink')}>
                <Icon size={15} strokeWidth={1.5} aria-hidden />
                {c.view[v]}
              </button>
            );
          })}
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

      {view === 'list' ? list : (
        <div className="flex snap-x gap-3 overflow-x-auto pb-3 [contain:paint]">
          {PIPELINE.map((stage) => (
            <section
              key={stage}
              aria-label={statuses[stage] ?? stage}
              {...drag.zone(stage)}
              className={cn(
                'w-[248px] shrink-0 snap-start rounded-card border p-2 transition-colors duration-touch',
                drag.over === stage ? 'border-accent bg-accent-wash' : 'border-line bg-surface-100',
              )}
            >
              <h3 className="flex items-baseline justify-between px-1 pb-2 pt-1">
                <span className="text-body font-medium text-ink">{statuses[stage] ?? stage}</span>
                <span className="text-meta tabular-nums text-ink-mute">{cols[stage].length}</span>
              </h3>
              <ul className="list-none space-y-2 p-0">
                {cols[stage].length === 0 && (
                  <li className="rounded-card-sm border border-dashed border-line px-3 py-4 text-center text-meta text-ink-mute">{c.card.empty}</li>
                )}
                {cols[stage].map((l) => {
                  const late = isUnanswered(l, now);
                  const who = l.partner_name ? `${l.full_name} ו${l.partner_name}` : l.full_name;
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
                          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <SourceMark source={l.source} label={sources[l.source] ?? l.source} />
                            <ScoreChip score={l.score} />
                            <span className="text-micro text-ink-mute">{agoLabel(l.created_at)}</span>
                            {late && <span className="chip-bad">{c.card.unanswered}</span>}
                          </div>
                        </div>
                      </div>
                      <select aria-label={c.card.move} value={l.status} onChange={(e) => move(l.id, e.target.value as Stage)}
                        className="field mt-2 w-full py-1 text-meta">
                        {PIPELINE.map((s) => <option key={s} value={s}>{statuses[s] ?? s}</option>)}
                      </select>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Carried at={drag.at}>{carried?.full_name}</Carried>
    </div>
  );
}
