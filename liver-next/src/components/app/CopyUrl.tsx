'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

/** The address, readable and selectable, and a button that copies it. The
 *  address stays on screen because a link nobody can see is one nobody can
 *  check before sending. */
export function CopyUrl({ url, label, done }: { url: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2">
      <p dir="ltr" className="overflow-x-auto rounded-xl2 border border-line bg-surface-100 px-3 py-2 text-start font-mono text-meta text-ink-soft">
        {url}
      </p>
      <button
        type="button" className="btn-ghost inline-flex items-center gap-1.5 text-body"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          } catch { /* the address is on screen and can be selected by hand */ }
        }}
      >
        {copied ? <Check size={14} strokeWidth={1.5} aria-hidden className="text-ok" /> : <Copy size={14} strokeWidth={1.5} aria-hidden />}
        {copied ? done : label}
      </button>
    </div>
  );
}
