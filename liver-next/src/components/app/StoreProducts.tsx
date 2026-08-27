'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Image as ImageIcon, Pencil, Plus, Trash2 } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import {
  saveProduct, toggleProduct, deleteProduct, reorderProducts, type StoreResult,
} from '@/app/actions/store';
import { Sortable, Handle } from '@/components/app/Sortable';
import { storeCopy as c } from '@/content/site';
import { Money } from '@/components/Ltr';
import { storeImageUrl } from '@/lib/store';

export type Product = {
  id: string;
  name: string;
  blurb: string;
  body: string;
  price: number;
  kind: 'product' | 'service';
  image_path: string;
  active: boolean;
};

function Saving() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary whitespace-nowrap disabled:opacity-60" disabled={pending}>
      {pending ? c.saving : c.save}
    </button>
  );
}

/** One form, for a new row and for an edit. A separate create path is where
 *  two forms quietly stop validating the same way. */
function Form({ producerId, product, onDone }: {
  producerId: string; product?: Product; onDone: () => void;
}) {
  const [state, action] = useActionState<StoreResult | null, FormData>(
    async (prev, form) => {
      const res = await saveProduct(prev, form);
      if (res.ok) onDone();
      return res;
    },
    null
  );
  const [path, setPath] = useState(product?.image_path ?? '');
  const [busy, setBusy] = useState(false);

  /* Straight to storage, like every other upload here: the bytes never pass
     through a server action, where a photograph off a phone would be refused
     for being a request body rather than for being too large. */
  const upload = async (file: File) => {
    setBusy(true);
    const sb = supabaseBrowser();
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
    const key = `${producerId}/${crypto.randomUUID()}.${ext || 'jpg'}`;
    const { error } = await sb.storage.from('store').upload(key, file, {
      contentType: file.type || 'image/jpeg', upsert: false,
    });
    setBusy(false);
    if (!error) setPath(key);
  };

  return (
    <form action={action} className="space-y-3 rounded-card-sm bg-surface-100 p-4">
      {product && <input type="hidden" name="id" value={product.id} />}
      <input type="hidden" name="image_path" value={path} />

      <div className="grid gap-3 sm:grid-cols-[1fr_140px_140px]">
        <input
          name="name" required maxLength={160} defaultValue={product?.name}
          placeholder={c.namePh} className="field" aria-label={c.name} autoComplete="off"
        />
        <input
          name="price" inputMode="decimal" defaultValue={product?.price || ''}
          placeholder={c.pricePh} className="field" aria-label={c.price}
        />
        <select name="kind" defaultValue={product?.kind ?? 'product'} className="field" aria-label={c.kind}>
          <option value="product">{c.kindProduct}</option>
          <option value="service">{c.kindService}</option>
        </select>
      </div>

      <input
        name="blurb" maxLength={300} defaultValue={product?.blurb}
        placeholder={c.blurbPh} className="field w-full" aria-label={c.blurb} autoComplete="off"
      />
      <textarea
        name="body" rows={4} maxLength={6000} defaultValue={product?.body}
        placeholder={c.bodyPh} className="field w-full resize-y" aria-label={c.body}
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-button border border-line-strong bg-card px-4 text-[14px] text-ink transition hover:border-accent/40 sm:min-h-[38px]">
          <ImageIcon size={15} aria-hidden strokeWidth={1.5} />
          {busy ? c.photoUploading : path ? c.photoDone : c.photoAdd}
          <input
            type="file" accept="image/*" className="sr-only" aria-label={c.photo}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
          />
        </label>

        <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-[14px] text-ink-soft sm:min-h-[38px]">
          <input type="checkbox" name="active" defaultChecked={product?.active ?? true} className="size-4 accent-[rgb(var(--accent-rgb))]" />
          {c.active}
        </label>

        <div className="ms-auto flex items-center gap-2">
          <button type="button" onClick={onDone} className="btn-quiet px-3 text-[14px]">{c.cancel}</button>
          <Saving />
        </div>
      </div>

      {state && !state.ok && state.error && (
        <p role="alert" className="text-[14px] text-bad">{state.error}</p>
      )}
    </form>
  );
}

export function StoreProducts({ producerId, products }: {
  producerId: string; products: Product[];
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <section className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-[22px] font-light text-ink">{c.tabProducts}</h2>
          <p className="mt-1 text-[13.5px] text-ink-mute">{c.dragHint}</p>
        </div>
        {!adding && (
          <button type="button" onClick={() => { setAdding(true); setEditing(null); }} className="btn-primary inline-flex items-center gap-2">
            <Plus size={16} aria-hidden strokeWidth={1.5} />
            {c.add}
          </button>
        )}
      </div>

      {adding && (
        <div className="mt-5">
          <Form producerId={producerId} onDone={() => setAdding(false)} />
        </div>
      )}

      {products.length === 0 && !adding ? (
        <p className="mt-6 text-[14.5px] text-ink-mute">{c.noneProducts}</p>
      ) : (
        <Sortable
          items={products}
          onReorder={async (ids) => {
            const res = await reorderProducts(ids);
            if (!res.ok) throw new Error(res.error);
          }}
          /* Spoken, not printed. A screen reader reads this out of an aria
             live region, so it is a sentence rather than a ratio: `3/12` in a
             Hebrew utterance is both reordered and meaningless aloud. */
          announce={(id, at, of) =>
            `${products.find((p) => p.id === id)?.name ?? ''} · מיקום ${at} מתוך ${of}`}
          className="mt-5 space-y-2"
          itemClassName="rounded-card-sm border border-line bg-card"
        >
          {(p, { handle, dragging }) => (
            <div className={`transition ${dragging ? 'opacity-95' : ''}`}>
              <div className="flex items-start gap-2 p-3">
                <Handle label={c.drag} {...handle} />

                {p.image_path ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={storeImageUrl(p.image_path)} alt=""
                    className="size-14 shrink-0 rounded-control object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="grid size-14 shrink-0 place-items-center rounded-control bg-surface-200 text-ink-mute">
                    <ImageIcon size={17} aria-hidden strokeWidth={1.5} />
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <p className="text-[15px] text-ink">{p.name}</p>
                    <span className="text-[12px] text-ink-mute">
                      {p.kind === 'service' ? c.kindService : c.kindProduct}
                    </span>
                    {!p.active && (
                      <span className="rounded-control bg-surface-200 px-2 text-[11.5px] text-ink-mute">{c.hidden}</span>
                    )}
                  </div>
                  {p.blurb && <p className="mt-0.5 truncate text-[13.5px] text-ink-soft">{p.blurb}</p>}
                  <Money value={p.price} className="mt-1 block text-[14px] text-ink" />
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <form action={toggleProduct}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="active" value={String(!p.active)} />
                    <button type="submit" className="btn-quiet px-2 py-1 text-[13px]">
                      {p.active ? c.hide : c.show}
                    </button>
                  </form>

                  <button
                    type="button"
                    onClick={() => { setEditing(editing === p.id ? null : p.id); setAdding(false); }}
                    className="btn-quiet inline-flex items-center gap-1 px-2 py-1 text-[13px]"
                  >
                    <Pencil size={14} aria-hidden strokeWidth={1.5} />
                    {c.edit}
                  </button>

                  <form
                    action={deleteProduct}
                    onSubmit={(e) => { if (!confirm(c.removeAsk)) e.preventDefault(); }}
                  >
                    <input type="hidden" name="id" value={p.id} />
                    <button type="submit" className="btn-quiet px-2 py-1 text-[13px]" aria-label={`${c.remove} ${p.name}`}>
                      <Trash2 size={14} aria-hidden strokeWidth={1.5} />
                    </button>
                  </form>
                </div>
              </div>

              {editing === p.id && (
                <div className="border-t border-line p-3">
                  <Form producerId={producerId} product={p} onDone={() => setEditing(null)} />
                </div>
              )}
            </div>
          )}
        </Sortable>
      )}
    </section>
  );
}
