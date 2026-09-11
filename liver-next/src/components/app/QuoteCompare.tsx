'use client';

import { useState } from 'react';
import { Check, Pencil } from 'lucide-react';
import { useCopy } from '@/components/app/CopyProvider';
import { Money, Ltr } from '@/components/Ltr';
import { categoryLabelFor } from '@/content/production';
import { fill } from '@/lib/copyText';
import { saveQuote, chooseQuote } from '@/app/actions/vendors';
import { SupplierDraft } from '@/components/app/SupplierDraft';
import {
  quoteGroups, perHour, amountOf, hoursOf, effectOfChoosing, hasQuote,
  type QuoteVendor, type QuoteLine,
} from '@/lib/quotes';

/**
 * Quotes side by side, and one chosen into the budget.
 *
 * The halls have had this since the venue comparison. Every other supplier
 * had a name and a phone number, and the three photographers' quotes were
 * compared in a WhatsApp thread with the budget finding out in March. This
 * is the same table for the rest of them: what each one quoted, for how many
 * hours, what an hour costs, what is included and what is not, and how they
 * want to be paid — with an unknown drawn as unknown rather than as nought.
 *
 * Pressing "choose" says what it is about to do before it does it: which
 * supplier's estimate leaves the budget, what this one puts in, and the net.
 * The sentence is computed from the same rows as the table, so it and the
 * budget after the save cannot disagree. Choosing is not booking; the status
 * chip beside the name is the only thing that says booked, and this touches
 * neither it nor a contract nor a payment.
 *
 * Both sides own it, the same way the halls do. The producer reads the
 * quotes; the couple knows which one they liked. One table, not two.
 */
export function QuoteCompare({ clientId, vendors, lines, viewer }: {
  clientId: string;
  vendors: QuoteVendor[];
  lines: QuoteLine[];
  viewer: 'producer' | 'client';
}) {
  const ui = useCopy();
  const c = ui.vendor.quotes;
  const locale = ui.locale;
  const [editing, setEditing] = useState<string | null>(null);
  const groups = quoteGroups(vendors);

  if (groups.length === 0 && vendors.length === 0) return null;

  return (
    <section className="card" aria-labelledby="quotes-title">
      <h2 id="quotes-title" className="font-display text-[18px] font-semibold text-ink">{c.title}</h2>
      <p className="mt-1 max-w-prose2 text-[14px] leading-relaxed text-ink-soft">
        {viewer === 'client' ? c.coupleSub : c.sub}
      </p>

      {groups.length === 0 ? (
        <p className="mt-5 text-[14.5px] text-ink-mute">{c.none}</p>
      ) : (
        <div className="mt-5 space-y-7">
          {groups.map((g) => (
            <div key={g.category}>
              <h3 className="mb-2 text-[12.5px] font-semibold text-accent">{categoryLabelFor(g.category, locale)}</h3>
              {/* `contain: paint` beside the scroll, the way the venue rail
                  does it: in a right-to-left page a wide table inside a plain
                  scroll box still pushed the whole document 160px to the
                  left, and the phone scrolled sideways instead of the table. */}
              <div className="overflow-x-auto pb-1 [contain:paint]">
                <table className="w-full min-w-[640px] border-collapse text-[13.5px]">
                  <thead>
                    <tr className="border-b border-line text-[12px] text-ink-mute">
                      <th scope="col" className="py-2 pe-3 text-start font-medium">{c.supplier}</th>
                      <th scope="col" className="py-2 pe-3 text-start font-medium">{c.amount}</th>
                      <th scope="col" className="py-2 pe-3 text-start font-medium">{c.hours}</th>
                      <th scope="col" className="py-2 pe-3 text-start font-medium">{c.perHour}</th>
                      <th scope="col" className="py-2 pe-3 text-start font-medium">{c.includes}</th>
                      <th scope="col" className="py-2 pe-3 text-start font-medium">{c.extras}</th>
                      <th scope="col" className="py-2 pe-3 text-start font-medium">{c.terms}</th>
                      <th scope="col" className="py-2 text-start font-medium"><span className="sr-only">{c.choose}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.vendors.map((v) => {
                      const amount = amountOf(v);
                      const hours = hoursOf(v);
                      const ph = perHour(v);
                      const effect = effectOfChoosing(v.id, vendors, lines);
                      const open = editing === v.id;
                      return (
                        <tr key={v.id} className={`border-b border-line align-top ${v.chosen ? 'bg-accent-wash' : ''}`}>
                          <td className="py-2.5 pe-3">
                            <span className="flex items-center gap-1.5 text-ink">
                              {v.chosen && <Check size={14} aria-hidden strokeWidth={2} className="shrink-0 text-accent" />}
                              <span className="font-medium">{v.name}</span>
                            </span>
                            {v.quote_scope && <span className="mt-0.5 block text-[12.5px] text-ink-soft">{v.quote_scope}</span>}
                            {v.status === 'booked' && <span className="mt-1 inline-block rounded-xl2 bg-ok-wash px-2 py-0.5 text-[11.5px] text-ok">{ui.portal.vendorBooked}</span>}
                          </td>
                          <td className="py-2.5 pe-3 tabular-nums">{amount === null ? <Unknown c={c} /> : <Money value={amount} className="text-ink" />}</td>
                          <td className="py-2.5 pe-3 tabular-nums">{hours === null ? <Unknown c={c} /> : <Ltr>{hours}</Ltr>}</td>
                          <td className="py-2.5 pe-3 tabular-nums">{ph === null ? <Unknown c={c} /> : <Money value={ph} className="text-ink-soft" />}</td>
                          <td className="py-2.5 pe-3 text-ink-soft">{v.quote_includes || <Unknown c={c} />}</td>
                          <td className="py-2.5 pe-3 text-ink-soft">{v.quote_extras || <Unknown c={c} />}</td>
                          <td className="py-2.5 pe-3 text-ink-soft">{v.quote_terms || <Unknown c={c} />}</td>
                          <td className="py-2 text-end">
                            <div className="flex flex-col items-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditing(open ? null : v.id)}
                                aria-expanded={open}
                                className="btn-quiet inline-flex items-center gap-1 px-2 py-1 text-[12.5px]"
                              >
                                <Pencil size={12} aria-hidden strokeWidth={1.5} />
                                {hasQuote(v) ? c.editQuote : c.addQuote}
                              </button>
                              {effect && !effect.noop && (
                                <form action={chooseQuote} className="flex flex-col items-end gap-1">
                                  <input type="hidden" name="event_vendor_id" value={v.id} />
                                  <input type="hidden" name="client_id" value={clientId} />
                                  <button type="submit" className="btn-primary min-h-[36px] px-3 text-[13px]">{c.choose}</button>
                                  {/* What the press does, before it is pressed. */}
                                  <span className="max-w-[16rem] text-end text-[11.5px] leading-snug text-ink-mute">
                                    {effect.replaces.length > 0
                                      ? fill(c.effectReplaces, { names: effect.replaces.map((r) => r.name).join(', ') })
                                      : c.effectAdds}
                                    {' '}
                                    <Money value={effect.delta} className={effect.delta > 0 ? 'text-warn' : 'text-ok'} />
                                  </span>
                                </form>
                              )}
                              {effect?.noop && <span className="text-[11.5px] text-ink-mute">{c.chosenNow}</span>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* The help that reads this table: a message to each supplier
                  asking for what their quote is missing, drafted from the
                  facts above and sent by a person. Under the table rather
                  than in a cell, because a draft needs room to be read. */}
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                {g.vendors.map((v) => (
                  <SupplierDraft key={v.id} eventVendorId={v.id} supplierName={v.name} />
                ))}
              </div>
              {g.vendors.some((v) => editing === v.id) && (
                <QuoteForm
                  key={editing}
                  clientId={clientId}
                  vendor={g.vendors.find((v) => v.id === editing)!}
                  onDone={() => setEditing(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-[12.5px] text-ink-mute">{c.notBooked}</p>
    </section>
  );
}

function Unknown({ c }: { c: { unknown: string } }) {
  return <span className="text-ink-mute">{c.unknown}</span>;
}

/** The six things on a quote, written down as the supplier said them. Every
 *  field may stay empty; empty is unknown, and unknown is drawn as such. */
function QuoteForm({ clientId, vendor, onDone }: { clientId: string; vendor: QuoteVendor; onDone: () => void }) {
  const c = useCopy().vendor.quotes;
  return (
    <form
      action={async (fd) => { await saveQuote(fd); onDone(); }}
      className="mt-3 grid gap-3 rounded-xl2 border border-line bg-surface-100 p-4 sm:grid-cols-3"
    >
      <input type="hidden" name="event_vendor_id" value={vendor.id} />
      <input type="hidden" name="client_id" value={clientId} />
      <p className="text-[14px] font-medium text-ink sm:col-span-3">{vendor.name}</p>
      <label className="grid gap-1 text-[12.5px] text-ink-mute">{c.amount}
        <input name="quote_amount" type="number" inputMode="decimal" min="0" step="1" defaultValue={vendor.quote_amount ?? ''} className="field" /></label>
      <label className="grid gap-1 text-[12.5px] text-ink-mute">{c.hours}
        <input name="quote_hours" type="number" inputMode="decimal" min="0.5" max="72" step="0.5" defaultValue={vendor.quote_hours ?? ''} className="field" /></label>
      <label className="grid gap-1 text-[12.5px] text-ink-mute">{c.scope}
        <input name="quote_scope" maxLength={300} defaultValue={vendor.quote_scope} placeholder={c.scopePh} className="field" /></label>
      <label className="grid gap-1 text-[12.5px] text-ink-mute">{c.includes}
        <input name="quote_includes" maxLength={600} defaultValue={vendor.quote_includes} placeholder={c.includesPh} className="field" /></label>
      <label className="grid gap-1 text-[12.5px] text-ink-mute">{c.extras}
        <input name="quote_extras" maxLength={600} defaultValue={vendor.quote_extras} placeholder={c.extrasPh} className="field" /></label>
      <label className="grid gap-1 text-[12.5px] text-ink-mute">{c.terms}
        <input name="quote_terms" maxLength={600} defaultValue={vendor.quote_terms} placeholder={c.termsPh} className="field" /></label>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
        <button type="submit" className="btn-primary">{c.save}</button>
        <button type="button" onClick={onDone} className="btn-quiet px-3 text-[14px]">{c.cancel}</button>
      </div>
    </form>
  );
}
