'use client';

import { useFormStatus } from 'react-dom';
import { Archive, ArchiveRestore } from 'lucide-react';
import { setArchived } from '@/app/actions/clients';
import { useCopy } from '@/components/app/CopyProvider';


function Button({ archived, highlight }: { archived: boolean; highlight: boolean }) {
  const c = useCopy().statusBoard;
  const { pending } = useFormStatus();
  const Icon = archived ? ArchiveRestore : Archive;
  const label = archived ? c.reopen : c.close;

  return (
    <button
      type="submit"
      disabled={pending}
      title={label}
      className={`inline-flex min-h-[44px] items-center sm:min-h-[34px] gap-1.5 rounded-xl2 px-3 text-[13px] font-medium transition disabled:opacity-50 ${
        highlight
          ? 'bg-accent text-surface hover:bg-ink'
          : 'text-ink-mute hover:bg-surface-200 hover:text-ink'
      }`}
    >
      <Icon size={15} aria-hidden strokeWidth={1.5} />
      {/* On a crowded row only the prompting state needs words; the rest is a
          quiet affordance you find when you go looking for it. */}
      <span className={highlight ? '' : 'sr-only'}>{label}</span>
    </button>
  );
}

export function ArchiveButton({
  clientId, archived, highlight = false,
}: { clientId: string; archived: boolean; highlight?: boolean }) {
  return (
    <form action={setArchived}>
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="archived" value={archived ? '0' : '1'} />
      <Button archived={archived} highlight={highlight} />
    </form>
  );
}
