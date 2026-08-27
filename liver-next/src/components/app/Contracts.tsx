'use client';

import { useActionState, useState } from 'react';
import { formatDate } from '@/lib/dates';
import { useFormStatus } from 'react-dom';
import { FileSignature, Send, Check, Ban, Trash2, Paperclip, ShieldAlert } from 'lucide-react';
import {
  saveContract, sendContract, signContract, voidContract, deleteContract,
  type ContractResult,
} from '@/app/actions/contracts';
import { SignLink } from '@/components/app/SignLink';
import { partyCopy as p } from '@/content/site';
import { supabaseBrowser } from '@/lib/supabase/client';
import { contractCopy } from '@/content/site';
import { Money, ils } from '@/components/Ltr';

export type Contract = {
  id: string;
  title: string;
  body: string;
  file_path: string | null;
  amount: number | null;
  status: 'draft' | 'sent' | 'signed' | 'void';
  /* Who the other side is, when it is not the couple. Optional because most
     agreements in the system predate suppliers being able to sign one. */
  party_name?: string;
  party_role?: string;
  signed_at: string | null;
  signed_name: string | null;
  /** False only if the stored terms no longer match what was signed. */
  intact: boolean;
  file_url: string | null;
};

const c = contractCopy;
const dateFmt = new Intl.DateTimeFormat('he-IL', {
  day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

const TONE: Record<Contract['status'], string> = {
  draft:  'bg-surface-200 text-ink-mute',
  sent:   'bg-warn-wash text-warn',
  signed: 'bg-ok-wash text-ok',
  void:   'bg-surface-200 text-ink-mute line-through',
};

function Busy({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-primary whitespace-nowrap disabled:opacity-60" disabled={pending}>{pending ? busy : label}</button>;
}

/* ── the producer's side ─────────────────────────────────────────────────── */

function Draft({ clientId }: { clientId: string }) {
  const [state, action] = useActionState<ContractResult | null, FormData>(saveContract, null);
  const [path, setPath] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  /* Straight from the browser to storage rather than through the server: a
     contract PDF is routinely several megabytes, and pushing it through a
     server action doubles the transfer for no gain. The first path segment is
     the workspace id because that is what the storage policy reads. */
  const upload = async (file: File) => {
    setUploadError('');
    if (file.size > 20 * 1024 * 1024) { setUploadError(c.tooBig); return; }
    setUploading(true);
    const sb = supabaseBrowser();
    const ext = (file.name.split('.').pop() || 'pdf').toLowerCase().slice(0, 8);
    const key = `${clientId}/${Date.now()}.${ext}`;
    const { error } = await sb.storage.from('contracts').upload(key, file, { upsert: false });
    setUploading(false);
    if (error) { setUploadError(c.uploadFailed); return; }
    setPath(key);
  };

  return (
    <form action={action} className="mt-5 space-y-3 rounded-xl2 bg-surface-100 p-4">
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="file_path" value={path} />

      <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
        <input name="title" required maxLength={200} placeholder={c.titlePh} className="field" aria-label={c.titleLabel} />
        <input name="amount" inputMode="decimal" placeholder={c.amountPh} className="field" aria-label={c.amountLabel} />
      </div>

      {/* Who the other side is. Optional, because an agreement with the couple
          already knows who it is with; a supplier's agreement does not, and the
          name is what appears on the page they open and on the signature. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="party_name" maxLength={120} placeholder={p.namePh} className="field" aria-label={p.name} autoComplete="off" />
        <input name="party_role" maxLength={80} placeholder={p.rolePh} className="field" aria-label={p.role} autoComplete="off" />
      </div>

      <textarea name="body" rows={6} maxLength={60000} placeholder={c.bodyPh} className="field w-full resize-y" aria-label={c.bodyLabel} />

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex min-h-[44px] cursor-pointer sm:min-h-[38px] items-center gap-2 rounded-xl2 border border-line-strong bg-card px-4 text-[14px] text-ink transition hover:border-accent/40">
          <Paperclip size={15} aria-hidden strokeWidth={1.5} />
          {uploading ? c.uploading : path ? c.attached : c.attach}
          <input
            type="file" accept=".pdf,application/pdf,image/*" className="sr-only"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
          />
        </label>
        <Busy label={c.saveDraft} busy={c.saving} />
      </div>

      {uploadError && <p role="alert" className="text-[14px] text-bad">{uploadError}</p>}
      {state && !state.ok && state.error && (
        <p role="alert" className="rounded-xl2 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">{state.error}</p>
      )}
      <p className="text-[13px] text-ink-mute">{c.draftHint}</p>
    </form>
  );
}

/* ── one contract, either side ───────────────────────────────────────────── */

function Sign({ contract, clientId }: { contract: Contract; clientId: string }) {
  const [state, action] = useActionState<ContractResult | null, FormData>(signContract, null);
  return (
    <form action={action} className="mt-4 rounded-xl2 border border-accent/30 bg-accent-wash p-4">
      <input type="hidden" name="contract_id" value={contract.id} />
      <input type="hidden" name="client_id" value={clientId} />
      <p className="text-[14.5px] text-ink">{c.signIntro}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          name="signed_name" required minLength={2} maxLength={120}
          placeholder={c.signNamePh} autoComplete="name"
          className="field flex-1 min-w-[200px]" aria-label={c.signNameLabel}
        />
        <Busy label={c.sign} busy={c.signing} />
      </div>
      <p className="mt-2 text-[12.5px] text-ink-mute">{c.signLegal}</p>
      {state && !state.ok && state.error && (
        <p role="alert" className="mt-3 rounded-xl2 bg-bad-wash px-4 py-2.5 text-[14px] text-bad">{state.error}</p>
      )}
    </form>
  );
}

function Row({ contract: k, clientId, viewer }: {
  contract: Contract; clientId: string; viewer: 'producer' | 'client';
}) {
  return (
    <li className="rounded-xl2 border border-line p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-[17px] font-light text-ink">{k.title || c.untitled}</h3>
          {k.amount !== null && <p className="mt-0.5 text-[14px] text-ink-soft tabular-nums"><Money value={k.amount} /></p>}
        </div>
        <span className={`rounded-xl2 px-2.5 py-1 text-[12.5px] font-medium ${TONE[k.status]}`}>
          {c.status[k.status]}
        </span>
      </div>

      {k.body && (
        <p className="mt-3 whitespace-pre-wrap text-[14.5px] leading-[1.75] text-ink-soft">{k.body}</p>
      )}

      {k.file_url && (
        <a href={k.file_url} target="_blank" rel="noopener noreferrer"
           className="mt-3 inline-flex items-center gap-1.5 text-[14px] text-accent underline-offset-2 hover:underline">
          <Paperclip size={15} aria-hidden strokeWidth={1.5} />
          {c.openDoc}
        </a>
      )}

      {k.status === 'signed' && (
        <p className="mt-3 flex flex-wrap items-center gap-2 rounded-xl2 bg-ok-wash px-3 py-2 text-[14px] text-ok">
          <Check size={15} aria-hidden strokeWidth={1.5} />
          {c.signedBy} <strong className="font-semibold">{k.signed_name}</strong>
          {k.signed_at && <span className="text-ink-mute">· {formatDate(dateFmt, k.signed_at, '')}</span>}
        </p>
      )}

      {/* Shown only when it is false, which should be never. If it is ever
          true on a real screen, that is the one thing on this page worth
          interrupting somebody about. */}
      {!k.intact && (
        <p role="alert" className="mt-3 flex items-center gap-2 rounded-xl2 bg-bad-wash px-3 py-2 text-[14px] text-bad">
          <ShieldAlert size={15} aria-hidden strokeWidth={1.5} />
          {c.tampered}
        </p>
      )}

      {viewer === 'client' && k.status === 'sent' && <Sign contract={k} clientId={clientId} />}

      {viewer === 'producer' && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
          {k.status === 'draft' && (
            <>
              <form action={sendContract}>
                <input type="hidden" name="contract_id" value={k.id} />
                <input type="hidden" name="client_id" value={clientId} />
                <button type="submit" className="btn-ghost inline-flex items-center gap-1.5 text-[13.5px]">
                  <Send size={15} aria-hidden strokeWidth={1.5} />{c.send}
                </button>
              </form>
              <form action={deleteContract}>
                <input type="hidden" name="contract_id" value={k.id} />
                <input type="hidden" name="client_id" value={clientId} />
                <button type="submit" className="btn-quiet inline-flex items-center gap-1.5 text-[13.5px]">
                  <Trash2 size={15} aria-hidden strokeWidth={1.5} />{c.discard}
                </button>
              </form>
            </>
          )}
          {/* A supplier has no account and is not going to open one to agree a
              price. The link is the way in, and it exists from the moment
              there is something to agree to. */}
          {k.status !== 'void' && k.status !== 'signed' && (
            <SignLink contractId={k.id} clientId={clientId} party={k.party_name ?? ''} />
          )}
          {(k.status === 'sent' || k.status === 'signed') && (
            <form action={voidContract}>
              <input type="hidden" name="contract_id" value={k.id} />
              <input type="hidden" name="client_id" value={clientId} />
              <button type="submit" className="btn-quiet inline-flex items-center gap-1.5 text-[13.5px]">
                <Ban size={15} aria-hidden strokeWidth={1.5} />{c.void}
              </button>
            </form>
          )}
        </div>
      )}
    </li>
  );
}

export function Contracts({ clientId, contracts, viewer }: {
  clientId: string; contracts: Contract[]; viewer: 'producer' | 'client';
}) {
  const [drafting, setDrafting] = useState(false);

  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-[18px] font-light text-ink">
            <FileSignature size={18} aria-hidden strokeWidth={1.5} />
            {c.title}
          </h2>
          <p className="mt-1 text-[14px] text-ink-soft">{viewer === 'client' ? c.subClient : c.subProducer}</p>
        </div>
        {viewer === 'producer' && (
          <button type="button" onClick={() => setDrafting((v) => !v)} className="btn-quiet text-[13.5px]">
            {drafting ? c.cancel : c.newContract}
          </button>
        )}
      </div>

      {viewer === 'producer' && drafting && <Draft clientId={clientId} />}

      {contracts.length === 0 ? (
        <p className="mt-5 rounded-xl2 bg-surface-100 px-4 py-3 text-[14.5px] text-ink-mute">
          {viewer === 'client' ? c.emptyClient : c.emptyProducer}
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {contracts.map((k) => <Row key={k.id} contract={k} clientId={clientId} viewer={viewer} />)}
        </ul>
      )}
    </section>
  );
}
