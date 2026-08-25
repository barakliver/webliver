'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Check, ClipboardList, Eye, EyeOff, Lock } from 'lucide-react';
import {
  applyTaskTemplate, applyBudgetTemplate, applySupplierTemplate, type TemplateResult,
} from '@/app/actions/template';
import { TASK_TEMPLATE, BUDGET_LINES, SUPPLIER_ROLES } from '@/content/eventFile';
import { templateCopy as c } from '@/content/site';
import { categoryLabel } from '@/content/production';

type Tab = 'tasks' | 'budget' | 'suppliers';

function Apply({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending || count === 0}>
      {pending ? c.applying : count === 0 ? c.nothing : c.apply(count)}
    </button>
  );
}

function Result({ state }: { state: TemplateResult | null }) {
  if (!state) return null;
  if (!state.ok) {
    return (
      <p role="alert" className="mt-3 rounded-none border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
        {state.error}
      </p>
    );
  }
  return (
    <p role="status" className="mt-3 inline-flex items-center gap-2 rounded-none border border-ok/30 bg-ok-wash px-4 py-2.5 text-[14px] text-ok">
      <Check size={15} aria-hidden strokeWidth={1.5} />
      {c.added(state.added ?? 0)}
    </p>
  );
}

/**
 * The producer's own lists, offered a line at a time.
 *
 * A picker rather than a button, because the whole list is never right for one
 * event: a small wedding has no shuttle, some couples do their own
 * invitations, and a template that arrives all or nothing gets applied once
 * and then unpicked by hand for twenty minutes.
 *
 * Sharing is decided here, per task, at the moment of adding. That is the one
 * point where somebody is actually thinking about who a line is for, and it is
 * cheaper to decide it now than to discover later that a couple has been
 * reading the cash envelope list.
 */
export function EventTemplate({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('tasks');

  /* Which lines are in, and which of those the couple sees. Two sets rather
     than one map: a line can be picked and private, and unpicking it must not
     forget how it was going to be shared. */
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(TASK_TEMPLATE.flatMap((g) => g.tasks.map((t) => t.title)))
  );
  const [shared, setShared] = useState<Set<string>>(
    () => new Set(TASK_TEMPLATE.flatMap((g) => g.tasks.filter((t) => t.shared).map((t) => t.title)))
  );
  const [budget, setBudget] = useState<Set<string>>(() => new Set(BUDGET_LINES.map((b) => b.label)));
  const [roles, setRoles] = useState<Set<string>>(() => new Set(SUPPLIER_ROLES.map((r) => r.name)));

  const [taskState, taskAction] = useActionState<TemplateResult | null, FormData>(applyTaskTemplate, null);
  const [budgetState, budgetAction] = useActionState<TemplateResult | null, FormData>(applyBudgetTemplate, null);
  const [roleState, roleAction] = useActionState<TemplateResult | null, FormData>(applySupplierTemplate, null);

  const toggle = (set: Set<string>, key: string, put: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    put(next);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-none border border-line-strong bg-card px-4 py-2.5 text-[14px] font-medium text-ink transition hover:border-accent/40 hover:text-accent"
      >
        <ClipboardList size={16} aria-hidden strokeWidth={1.5} />
        {c.open}
      </button>
    );
  }

  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[18px] font-light text-ink">{c.title}</h2>
          <p className="mt-1 max-w-prose2 text-[14px] leading-relaxed text-ink-soft">{c.sub}</p>
        </div>
        <button type="button" className="btn-quiet text-[13.5px]" onClick={() => setOpen(false)}>{c.close}</button>
      </div>

      <nav className="mt-5 flex flex-wrap gap-1.5" aria-label={c.title}>
        {([['tasks', c.tasksTab], ['budget', c.budgetTab], ['suppliers', c.suppliersTab]] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-current={tab === id ? 'true' : undefined}
            onClick={() => setTab(id)}
            className={`inline-flex min-h-[44px] items-center rounded-none px-4 text-[14px] transition sm:min-h-[38px] ${
              tab === id ? 'bg-ink font-medium text-surface' : 'text-ink-soft hover:bg-surface-200 hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'tasks' && (
        <form action={taskAction} className="mt-5">
          <input type="hidden" name="client_id" value={clientId} />

          <div className="mb-3 flex flex-wrap gap-3 text-[13px]">
            <button type="button" className="text-ink-mute hover:text-ink"
              onClick={() => setPicked(new Set(TASK_TEMPLATE.flatMap((g) => g.tasks.map((t) => t.title))))}>
              {c.pickAll}
            </button>
            <button type="button" className="text-ink-mute hover:text-ink" onClick={() => setPicked(new Set())}>
              {c.pickNone}
            </button>
          </div>

          <div className="space-y-6">
            {TASK_TEMPLATE.map((group) => (
              <div key={group.id}>
                <h3 className="text-[13px] font-semibold text-accent">{group.title}</h3>
                <p className="mt-0.5 mb-3 text-[12.5px] leading-relaxed text-ink-mute">{group.sub}</p>

                <ul className="space-y-1.5">
                  {group.tasks.map((t) => {
                    const on = picked.has(t.title);
                    const isShared = shared.has(t.title);
                    return (
                      <li
                        key={t.title}
                        className={`flex flex-wrap items-center gap-3 rounded-none border px-3.5 py-2.5 transition ${
                          on ? 'border-line bg-card' : 'border-line/60 bg-surface-100 opacity-60'
                        }`}
                      >
                        <label className="flex min-h-[36px] min-w-0 flex-1 items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => toggle(picked, t.title, setPicked)}
                            className="size-5 shrink-0 rounded border-line-strong accent-accent"
                          />
                          {on && <input type="hidden" name="task" value={t.title} />}
                          {on && isShared && <input type="hidden" name="shared" value={t.title} />}
                          <span className="min-w-0">
                            <span className="block text-[14.5px] text-ink">{t.title}</span>
                            {t.note && <span className="block text-[12.5px] text-ink-mute">{t.note}</span>}
                          </span>
                        </label>

                        {/* Shared or private, per line, decided here. */}
                        <button
                          type="button"
                          disabled={!on}
                          aria-pressed={isShared}
                          onClick={() => toggle(shared, t.title, setShared)}
                          className={`inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-none px-3 text-[12.5px] transition disabled:opacity-40 ${
                            isShared ? 'bg-ok-wash text-ok' : 'bg-surface-200 text-ink-mute'
                          }`}
                        >
                          {isShared
                            ? <><Eye size={13} aria-hidden strokeWidth={1.5} />{c.sharedOn}</>
                            : <><EyeOff size={13} aria-hidden strokeWidth={1.5} />{c.sharedOff}</>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          <p className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] text-ink-mute">
            <Lock size={13} aria-hidden strokeWidth={1.5} />
            {c.privateNote}
          </p>

          <Result state={taskState} />
          <div className="mt-4"><Apply count={picked.size} /></div>
        </form>
      )}

      {tab === 'budget' && (
        <form action={budgetAction} className="mt-5">
          <input type="hidden" name="client_id" value={clientId} />
          <div className="mb-3 flex flex-wrap gap-3 text-[13px]">
            <button type="button" className="text-ink-mute hover:text-ink" onClick={() => setBudget(new Set(BUDGET_LINES.map((b) => b.label)))}>{c.pickAll}</button>
            <button type="button" className="text-ink-mute hover:text-ink" onClick={() => setBudget(new Set())}>{c.pickNone}</button>
          </div>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {BUDGET_LINES.map((b) => (
              <li key={b.label}>
                <label className={`flex min-h-[44px] items-center gap-2.5 rounded-none border px-3.5 py-2 transition ${
                  budget.has(b.label) ? 'border-line bg-card' : 'border-line/60 bg-surface-100 opacity-60'
                }`}>
                  <input
                    type="checkbox" checked={budget.has(b.label)}
                    onChange={() => toggle(budget, b.label, setBudget)}
                    className="size-5 shrink-0 rounded border-line-strong accent-accent"
                  />
                  {budget.has(b.label) && <input type="hidden" name="line" value={b.label} />}
                  <span className="text-[14.5px] text-ink">{b.label}</span>
                </label>
              </li>
            ))}
          </ul>
          <Result state={budgetState} />
          <div className="mt-4"><Apply count={budget.size} /></div>
        </form>
      )}

      {tab === 'suppliers' && (
        <form action={roleAction} className="mt-5">
          <input type="hidden" name="client_id" value={clientId} />
          <div className="mb-3 flex flex-wrap gap-3 text-[13px]">
            <button type="button" className="text-ink-mute hover:text-ink" onClick={() => setRoles(new Set(SUPPLIER_ROLES.map((r) => r.name)))}>{c.pickAll}</button>
            <button type="button" className="text-ink-mute hover:text-ink" onClick={() => setRoles(new Set())}>{c.pickNone}</button>
          </div>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {SUPPLIER_ROLES.map((r) => (
              <li key={r.name}>
                <label className={`flex min-h-[44px] items-center gap-2.5 rounded-none border px-3.5 py-2 transition ${
                  roles.has(r.name) ? 'border-line bg-card' : 'border-line/60 bg-surface-100 opacity-60'
                }`}>
                  <input
                    type="checkbox" checked={roles.has(r.name)}
                    onChange={() => toggle(roles, r.name, setRoles)}
                    className="size-5 shrink-0 rounded border-line-strong accent-accent"
                  />
                  {roles.has(r.name) && <input type="hidden" name="role" value={r.name} />}
                  <span className="min-w-0">
                    <span className="block text-[14.5px] text-ink">{r.name}</span>
                    <span className="block text-[12px] text-ink-mute">{categoryLabel(r.category)}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <Result state={roleState} />
          <div className="mt-4"><Apply count={roles.size} /></div>
        </form>
      )}
    </section>
  );
}
