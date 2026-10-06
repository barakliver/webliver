'use client';

import { useActionState, useId } from 'react';
import { useFormStatus } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import {
  addBudgetItem, deleteBudgetItem, updateBudgetItem, toggleBudgetVisible, type MoneyResult,
} from '@/app/actions/money';
import { useCopy } from '@/components/app/CopyProvider';
import { Money } from '@/components/Ltr';
import { Metric } from '@/components/app/Metric';
import { ReceiptScan } from '@/components/app/ReceiptScan';
import { DeleteForm } from '@/components/app/ConfirmDelete';
import { sumIls } from '@/lib/money';
import { PLAN_CATEGORIES, categoryOf } from '@/lib/budgetPlan';
import type { AppUi } from '@/content/appUi';

export type BudgetItem = {
  id: string; category: string; label: string;
  estimate: number; agreed: number | null; vendor: string;
  /** The supplier this line is money for, when it is one. */
  event_vendor_id?: string | null;
};

/**
 * A field with its name written above it.
 *
 * The four fields on this form used to carry a placeholder and an aria-label
 * and nothing a sighted person could read once they started typing. A
 * placeholder is not a label: it is gone at exactly the moment somebody looks
 * up to check which box they are in, and on a phone, where the four fields
 * stack into four identical boxes, that is every time.
 */
function Field({
  name, label, hint, className = '', children,
}: {
  name: string; label: string; hint?: string; className?: string;
  children: (id: string) => React.ReactNode;
}) {
  const id = `${useId()}-${name}`;
  return (
    <div className={`min-w-0 ${className}`}>
      <label htmlFor={id} className="mb-1 block text-meta font-medium text-ink-soft">{label}</label>
      {children(id)}
      {hint && <p className="mt-1 text-micro text-ink-mute">{hint}</p>}
    </div>
  );
}

/** The areas the tracker plans against, plus the blank that means "work it
 *  out from the label", which is what the product did before anybody could
 *  say otherwise and is right most of the time. */
function CategorySelect({ id, value, c, plan }: {
  id: string; value: string; c: AppUi['money']; plan: AppUi['money']['plan']['categories'];
}) {
  return (
    <select id={id} name="category" defaultValue={value} className="field">
      <option value="">{c.budCategoryAuto}</option>
      {PLAN_CATEGORIES.map((k) => (
        <option key={k} value={k}>{plan[k]}</option>
      ))}
    </select>
  );
}

function Submit({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary whitespace-nowrap" disabled={pending}>
      {pending ? busy : idle}
    </button>
  );
}

/**
 * One line, and the form that corrects it.
 *
 * The row is a `<details>` for the same reasons the couple's drawers are: it
 * works before the JavaScript arrives, the keyboard already knows it, and a
 * screen reader hears a real disclosure without a line of aria.
 *
 * Every figure on this screen starts as a guess. You write 40,000 for the
 * hall in March and sign for 37,400 in June, and until this form existed the
 * only way to record June was to delete the line and retype all four fields
 * from memory. So the row opens onto the values it is already showing, and
 * saving is the same press as adding.
 */
function Row({ item, clientId, c, plan }: {
  item: BudgetItem; clientId: string; c: AppUi['money']; plan: AppUi['money']['plan']['categories'];
}) {
  const [state, action] = useActionState<MoneyResult | null, FormData>(updateBudgetItem, null);
  const agreed = item.agreed === null ? null : Number(item.agreed);
  const estimate = Number(item.estimate);
  /* What the tracker will file this line under, shown rather than hidden: a
     line in the wrong area is how a plan quietly stops matching the wedding,
     and nobody reports a category they cannot see. */
  const area = categoryOf(item);

  return (
    <details className="group bg-card">
      <summary
        className="flex min-h-[64px] cursor-pointer list-none items-center gap-4 px-4 py-3
                   [&::-webkit-details-marker]:hidden"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-ink">{item.label}</span>
          <span className="mt-0.5 block truncate text-meta text-ink-mute">
            {item.vendor ? `${item.vendor} · ${plan[area]}` : plan[area]}
          </span>
        </span>

        {/* The agreed figure is the one that matters once it exists, so it is
            the one that gets the size; the estimate sits under it as what it
            was before somebody negotiated. */}
        <span className="shrink-0 text-left">
          <span className="block font-display text-head font-semibold tabular-nums text-ink">
            <Money value={agreed ?? estimate} />
          </span>
          {agreed !== null && agreed !== estimate && (
            <span className="block text-meta tabular-nums text-ink-mute">
              {c.budEstimate} <Money value={estimate} />
            </span>
          )}
        </span>

        <ChevronDown
          size={18} strokeWidth={1.5} aria-hidden
          className="shrink-0 text-ink-mute transition-transform duration-200 group-open:rotate-180"
        />
        <span className="sr-only">{c.budEdit}</span>
      </summary>

      <div className="mx-2.5 mb-3 rounded-card-sm bg-surface p-3 sm:mx-3 sm:p-4">
        {/* Two money fields side by side even on a phone, because they are
            the pair somebody is comparing; everything that holds a name gets
            the full width. */}
        <form action={action} className="grid grid-cols-2 gap-3">
          <input type="hidden" name="item_id" value={item.id} />
          <input type="hidden" name="client_id" value={clientId} />

          <Field name="label" label={c.budLabel} className="col-span-2">
            {(id) => (
              <input id={id} name="label" required defaultValue={item.label}
                     autoComplete="off" className="field" />
            )}
          </Field>
          <Field name="estimate" label={c.budEstimate}>
            {(id) => (
              <input id={id} name="estimate" required type="number" min={0} step="0.01"
                     inputMode="decimal" defaultValue={estimate} className="field" />
            )}
          </Field>
          <Field name="agreed" label={c.budAgreed} hint={c.budAgreedHint}>
            {(id) => (
              <input id={id} name="agreed" type="number" min={0} step="0.01"
                     inputMode="decimal" defaultValue={agreed ?? ''} className="field" />
            )}
          </Field>
          <Field name="vendor" label={c.budVendor} className="col-span-2">
            {(id) => (
              <input id={id} name="vendor" defaultValue={item.vendor}
                     autoComplete="off" className="field" />
            )}
          </Field>
          <Field name="category" label={c.budCategory} hint={c.budCategoryWhy} className="col-span-2">
            {(id) => <CategorySelect id={id} value={item.category ?? ''} c={c} plan={plan} />}
          </Field>

          <div className="col-span-2">
            <Submit idle={c.budSave} busy={c.budSaving} />
          </div>
        </form>

        {/* Outside the form above, and that is the whole point of these three
            lines. A form inside a form is invalid HTML: the browser drops the
            inner one while parsing, so React's tree and the DOM stop matching
            and the whole page is thrown away and rebuilt. It rendered fine
            and the suite was green, because nothing we ran had ever loaded a
            page in a browser — which is the reason `npm run check:full`
            exists and the reason this was found at all. */}
        <div className="mt-3 flex justify-end">
          <DeleteForm action={deleteBudgetItem}>
            <input type="hidden" name="item_id" value={item.id} />
            <input type="hidden" name="client_id" value={clientId} />
            <button type="submit" className="btn-quiet px-2 py-1 text-body">{c.remove}</button>
          </DeleteForm>
        </div>

        {state && !state.ok && state.error && (
          <p role="alert" className="mt-3 rounded-control border border-bad/25 bg-bad-wash px-4 py-2.5 text-body text-bad">
            {state.error}
          </p>
        )}
      </div>
    </details>
  );
}

export function BudgetPanel({ clientId, items, viewer, visible }: {
  clientId: string; items: BudgetItem[]; viewer: 'producer' | 'client'; visible: boolean;
}) {
  const [state, action] = useActionState<MoneyResult | null, FormData>(addBudgetItem, null);
  const ui = useCopy();
  const c = ui.money;
  const plan = ui.money.plan.categories;
  /* The scanner writes into this form by name, so the two have to agree on
     one id, and it has to be unique per event on a page that can show more
     than one. */
  const formId = `budget-${clientId}`;

  const totalEst = sumIls(items.map((i) => i.estimate));
  /* A line with nothing agreed yet still costs its estimate, so the comparison
     is like for like instead of flattering whatever has not been booked. */
  /* One missing number would otherwise make the whole column read ₪NaN,
     which is worse than reading zero because it looks like a bug in the app
     rather than a gap in the data. */
  const totalAgreed = sumIls(items.map((i) => i.agreed ?? i.estimate));
  const diff = totalEst - totalAgreed;

  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-subhead font-semibold text-ink">{c.budTitle}</h2>
          <p className="mt-1 text-body text-ink-soft">{c.budSub}</p>
        </div>

        {viewer === 'producer' && (
          <form action={toggleBudgetVisible}>
            <input type="hidden" name="client_id" value={clientId} />
            <input type="hidden" name="visible" value={String(visible)} />
            <button type="submit" className={`inline-flex min-h-[44px] items-center rounded-control px-4 text-body font-medium transition sm:min-h-0 sm:py-2 ${
              visible ? 'bg-ok-wash text-ok' : 'bg-surface-200 text-ink-mute'
            }`}>
              {visible ? c.budVisible : c.budHidden}
            </button>
          </form>
        )}
      </div>

      {viewer === 'producer' && !visible && (
        <p className="mt-4 rounded-control bg-surface-200 px-4 py-3 text-body text-ink-soft">{c.budHiddenNote}</p>
      )}

      {/* Only once there is something to total. An empty budget used to draw
          these three anyway: nothing estimated, nothing agreed, and nothing
          over — written as three zeroes, which read as three measured figures
          on a budget nobody had started, the last of them congratulating the
          couple on being inside a budget that did not exist. Zero is a number
          somebody arrived at. Nothing is a different state and has to look
          like one. */}
      {items.length > 0 && (
        <div className="mt-6 grid gap-x-8 gap-y-8 sm:grid-cols-3">
          <Metric kicker={c.budTotalEst} value={<Money value={totalEst} />} />
          <Metric kicker={c.budTotalAgreed} value={<Money value={totalAgreed} />} tone="accent" />
          <Metric
            kicker={diff >= 0 ? c.budUnder : c.budOver}
            value={<Money value={Math.abs(diff)} />}
            tone={diff >= 0 ? 'ok' : 'bad'}
          />
        </div>
      )}

      {/* Both sides. The couple is the one who knows what the hall quoted;
          a table they can read but not type into sends the number back to
          WhatsApp. What stays the producer's is the switch that hides the
          whole panel from the couple, and the receipt scanner, which writes
          on the producer's behalf.

          Two fields are asked for and three are offered. A line needs a name
          and a number to exist, and a budget somebody gives up on halfway
          through typing is worth less than a rough one they finished: the
          supplier, the agreed price and the area can all be filled in later,
          because now every line opens. */}
      <form id={formId} action={action} className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <input type="hidden" name="client_id" value={clientId} />

        <Field name="label" label={c.budLabel} className="col-span-2 lg:col-span-1">
          {(id) => (
            <input id={id} name="label" required placeholder={c.budLabelPh}
                   autoComplete="off" className="field" />
          )}
        </Field>
        <Field name="estimate" label={c.budEstimate}>
          {(id) => (
            <input id={id} name="estimate" required type="number" min={0} step="0.01"
                   inputMode="decimal" className="field" />
          )}
        </Field>
        <Field name="agreed" label={c.budAgreed} hint={c.budAgreedHint}>
          {(id) => (
            <input id={id} name="agreed" type="number" min={0} step="0.01"
                   inputMode="decimal" className="field" />
          )}
        </Field>
        <Field name="vendor" label={c.budVendor} className="col-span-2 lg:col-span-1">
          {(id) => <input id={id} name="vendor" autoComplete="off" className="field" />}
        </Field>
        <Field name="category" label={c.budCategory} className="col-span-2 lg:col-span-1">
          {(id) => <CategorySelect id={id} value="" c={c} plan={plan} />}
        </Field>

        <div className="col-span-2 lg:col-span-3">
          <Submit idle={c.budAdd} busy={c.payAdding} />
        </div>
      </form>

      {/* Under the form rather than above it, because it fills that form and
          does not replace it. Every field it writes is still a field somebody
          can type over, and nothing is saved until the same button as always
          is pressed. */}
      {viewer === 'producer' && <ReceiptScan clientId={clientId} formId={formId} />}

      {state && !state.ok && state.error && (
        <p role="alert" className="mt-3 rounded-control border border-bad/25 bg-bad-wash px-4 py-2.5 text-body text-bad">
          {state.error}
        </p>
      )}

      {items.length === 0 ? (
        <p className="mt-6 text-body text-ink-mute">{c.budNone}</p>
      ) : (
        /* One list at every width, where there used to be cards on a phone and
           a four-column table from the small breakpoint up.

           The table was the thing that made this screen read-only. It is the
           shape of a spreadsheet, and a spreadsheet's whole promise is that
           you can click a cell and change it, which this one could not. Two
           implementations of the same rows also meant an edit had to be built
           twice, which is how it ends up built nought times.

           So: rows, the same ones everywhere, each opening onto its own
           form. The 1px of ground between them is the separator, the way the
           couple's drawers do it. */
        <ul className="mt-6 list-none space-y-px overflow-hidden rounded-card-sm border border-line p-0">
          {items.map((i) => (
            <li key={i.id}>
              <Row item={i} clientId={clientId} c={c} plan={plan} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
