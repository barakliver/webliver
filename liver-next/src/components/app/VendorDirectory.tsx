'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Archive, ArchiveRestore, FileSpreadsheet, Pencil, Plus, Search, X } from 'lucide-react';
import { VendorImport } from './VendorImport';
import { Ltr } from '@/components/Ltr';
import { addVendor, updateVendor, setVendorArchived, type VendorResult } from '@/app/actions/vendors';
import { VENDOR_CATEGORIES, categoryLabel } from '@/content/production';
import { vendorCopy as c } from '@/content/site';

export type Vendor = {
  id: string; name: string; category: string; contact_name: string;
  phone: string; email: string; area: string; notes: string; archived_at: string | null;
  agreed_price: number | null; deposit_paid: number | null;
};

const shekels = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 });

function Save() {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-primary" disabled={pending}>{pending ? c.saving : c.save}</button>;
}

function Alert({ text }: { text: string }) {
  return (
    <p role="alert" className="mt-3 rounded-xl2 border border-bad/25 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">
      {text}
    </p>
  );
}

function Fields({ vendor }: { vendor?: Vendor }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-[1fr_180px_1fr]">
        <div>
          <label className="label">{c.name}</label>
          <input name="name" required defaultValue={vendor?.name} autoComplete="off" className="field" />
        </div>
        <div>
          <label className="label">{c.category}</label>
          <select name="category" defaultValue={vendor?.category || 'other'} className="field">
            {VENDOR_CATEGORIES.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{c.contact}</label>
          <input name="contact_name" defaultValue={vendor?.contact_name} autoComplete="off" className="field" />
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">{c.phone}</label>
          <input name="phone" type="tel" inputMode="tel" dir="ltr" defaultValue={vendor?.phone} autoComplete="off" className="field" />
        </div>
        <div>
          <label className="label">{c.email}</label>
          <input name="email" type="email" dir="ltr" defaultValue={vendor?.email} autoComplete="off" className="field" />
        </div>
        <div>
          <label className="label">{c.area}</label>
          <input name="area" defaultValue={vendor?.area} autoComplete="off" className="field" />
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">{c.agreedPrice}</label>
          <input name="agreed_price" type="number" inputMode="decimal" min={0} step="1" dir="ltr" defaultValue={vendor?.agreed_price ?? ''} className="field" />
        </div>
        <div>
          <label className="label">{c.depositPaid}</label>
          <input name="deposit_paid" type="number" inputMode="decimal" min={0} step="1" dir="ltr" defaultValue={vendor?.deposit_paid ?? ''} className="field" />
        </div>
      </div>
      <div className="mt-3">
        <label className="label">{c.notes}</label>
        <textarea name="notes" rows={2} defaultValue={vendor?.notes} className="field resize-y" />
      </div>
    </>
  );
}

function Row({ vendor }: { vendor: Vendor }) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState<VendorResult | null, FormData>(
    async (prev, form) => {
      const r = await updateVendor(prev, form);
      if (r.ok) setEditing(false);
      return r;
    },
    null
  );

  if (editing) {
    return (
      <li className="rounded-xl2 border border-accent/40 bg-surface-100 p-4">
        <form action={action} noValidate>
          <input type="hidden" name="vendor_id" value={vendor.id} />
          <Fields vendor={vendor} />
          {state && !state.ok && state.error && <Alert text={state.error} />}
          <div className="mt-4 flex flex-wrap gap-3">
            <Save />
            <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>{c.cancel}</button>
          </div>
        </form>
      </li>
    );
  }

  const archived = !!vendor.archived_at;

  return (
    <li className={`flex flex-wrap items-center gap-3 rounded-xl2 border px-4 py-3.5 ${
      archived ? 'border-line bg-surface-100' : 'border-line'
    }`}>
      <div className="min-w-0 flex-1">
        <p className={`text-[15.5px] ${archived ? 'text-ink-mute' : 'text-ink'}`}>{vendor.name}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[13px] text-ink-mute">
          <span>{categoryLabel(vendor.category)}</span>
          {vendor.contact_name && <span>{vendor.contact_name}</span>}
          {vendor.phone && <a href={`tel:${vendor.phone}`} dir="ltr" className="hover:text-accent">{vendor.phone}</a>}
          {vendor.area && <span>{vendor.area}</span>}
          {vendor.agreed_price !== null && (
            <span>{c.agreedPrice} <Ltr>{shekels.format(vendor.agreed_price)}</Ltr></span>
          )}
          {vendor.deposit_paid !== null && vendor.deposit_paid > 0 && (
            <span>{c.depositPaid} <Ltr>{shekels.format(vendor.deposit_paid)}</Ltr></span>
          )}
        </div>
        {vendor.notes && <p className="mt-1 text-[13px] text-ink-soft">{vendor.notes}</p>}
      </div>

      <button
        type="button" onClick={() => setEditing(true)} title={c.edit}
        aria-label={`${c.edit} ${vendor.name}`}
        className="grid size-11 place-items-center rounded-xl2 text-ink-mute transition hover:bg-surface-200 hover:text-ink sm:size-9"
      >
        <Pencil size={15} aria-hidden strokeWidth={1.5} />
      </button>

      {/* Retired rather than deleted, and reversible. A supplier no longer used
          still appears on last year's events, and deleting the row would blank
          the supplier on a finished file rather than tidy anything. */}
      <form action={setVendorArchived}>
        <input type="hidden" name="vendor_id" value={vendor.id} />
        <input type="hidden" name="archived" value={String(!archived)} />
        <button
          type="submit" title={archived ? c.unarchive : c.archive}
          aria-label={`${archived ? c.unarchive : c.archive} ${vendor.name}`}
          className="grid size-11 place-items-center rounded-xl2 text-ink-mute transition hover:bg-surface-200 hover:text-ink sm:size-9"
        >
          {archived
            ? <ArchiveRestore size={15} aria-hidden strokeWidth={1.5} />
            : <Archive size={15} aria-hidden strokeWidth={1.5} />}
        </button>
      </form>
    </li>
  );
}

/**
 * The book that stays between events.
 *
 * The florist who was good last August is the same florist next August, and
 * retyping her number for every event is how a phone number ends up wrong on
 * the one sheet somebody needed it on. Everything here exists to be booked onto
 * an event in a single click with the number already filled in.
 */
export function VendorDirectory({ vendors }: { vendors: Vendor[] }) {
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const [state, action] = useActionState<VendorResult | null, FormData>(
    async (prev, form) => {
      const r = await addVendor(prev, form);
      if (r.ok) setAdding(false);
      return r;
    },
    null
  );

  const shown = useMemo(() => {
    const q = query.trim();
    return vendors
      .filter((v) => (showArchived ? !!v.archived_at : !v.archived_at))
      .filter((v) => !category || v.category === category)
      .filter((v) => {
        if (q.length < 2) return true;
        const hay = `${v.name} ${categoryLabel(v.category)} ${v.contact_name} ${v.area} ${v.notes} ${v.phone}`;
        return q.split(/\s+/).every((w) => hay.includes(w));
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'he'));
  }, [vendors, query, category, showArchived]);

  const activeCount = vendors.filter((v) => !v.archived_at).length;
  const archivedCount = vendors.length - activeCount;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={17} strokeWidth={1.5} aria-hidden
            className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-ink-mute"
          />
          <input
            type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={c.dirSearchPh} aria-label={c.dirSearch}
            className="field w-full pr-11 pl-11"
          />
          {query && (
            <button
              type="button" onClick={() => setQuery('')} aria-label={c.cancel}
              className="absolute top-1/2 left-1.5 grid size-10 -translate-y-1/2 place-items-center rounded-xl2 text-ink-mute transition hover:bg-surface-200 hover:text-ink"
            >
              <X size={15} strokeWidth={1.5} aria-hidden />
            </button>
          )}
        </div>

        <select
          value={category} onChange={(e) => setCategory(e.target.value)}
          aria-label={c.category} className="field w-auto min-w-[160px]"
        >
          <option value="">{c.allCategories}</option>
          {VENDOR_CATEGORIES.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>

        <button
          type="button" onClick={() => { setImporting((v) => !v); setAdding(false); }}
          aria-pressed={importing}
          className="btn-ghost whitespace-nowrap"
        >
          <FileSpreadsheet size={16} aria-hidden strokeWidth={1.5} />
          {importing ? c.close : c.import.open}
        </button>
        <button
          type="button" onClick={() => { setAdding((v) => !v); setImporting(false); }}
          className="btn-primary whitespace-nowrap"
        >
          <Plus size={16} aria-hidden strokeWidth={1.5} />
          {adding ? c.close : c.dirAdd}
        </button>
      </div>

      {importing && (
        <div className="mb-6">
          <VendorImport existingNames={vendors.map((v) => v.name)} onDone={() => setImporting(false)} />
        </div>
      )}

      {archivedCount > 0 && (
        <nav className="mb-5 inline-flex rounded-xl2 border border-line bg-surface-100 p-1 text-[14px]">
          {[
            { on: !showArchived, label: `${c.dirActive} · ${activeCount}`, go: false },
            { on: showArchived, label: `${c.dirArchived} · ${archivedCount}`, go: true },
          ].map((t) => (
            <button
              key={t.label}
              type="button"
              aria-pressed={t.on}
              onClick={() => setShowArchived(t.go)}
              className={`min-h-[44px] rounded-xl2 px-4 leading-[44px] sm:min-h-[36px] sm:leading-[36px] transition ${
                t.on ? 'bg-card font-medium text-ink' : 'text-ink-mute hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      )}

      {adding && (
        <form action={action} className="card mb-6" noValidate>
          <Fields />
          {state && !state.ok && state.error && <Alert text={state.error} />}
          <div className="mt-4 flex flex-wrap gap-3">
            <Save />
            <button type="button" className="btn-ghost" onClick={() => setAdding(false)}>{c.cancel}</button>
          </div>
        </form>
      )}

      {shown.length === 0 ? (
        <div className="card text-center text-[15px] text-ink-mute">
          {vendors.length === 0 ? c.dirNone : c.noResults}
        </div>
      ) : (
        <>
          <p className="mb-3 text-[13px] text-ink-mute">{c.count(shown.length)}</p>
          <ul className="space-y-2.5">
            {shown.map((v) => <Row key={v.id} vendor={v} />)}
          </ul>
        </>
      )}
    </>
  );
}
