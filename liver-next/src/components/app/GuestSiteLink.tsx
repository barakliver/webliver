'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Globe, MessageCircle } from 'lucide-react';
import { useCopy } from '@/components/app/CopyProvider';

/**
 * The couple's copy of the guests' link, in their own area.
 *
 * Rendered only once the producer has switched the page on: a link to a page
 * that says "not available" is a link the couple would send anyway.
 *
 * Sharing goes through WhatsApp's own share address rather than a custom
 * dialog, because that is where the family group is. On a phone with the
 * native share sheet it offers that first, since it lets them pick the group
 * directly; everywhere else the WhatsApp link opens the same picker.
 */
export function GuestSiteLink({ token }: { token: string }) {
  const c = useCopy().portal.guestSite;
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => { setUrl(`${window.location.origin}/w/${token}`); }, [token]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* the field is selectable; copying by hand still works */ }
  };

  const share = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (typeof navigator.share !== 'function') return;
    e.preventDefault();
    try { await navigator.share({ text: `${c.shareText}\n${url}` }); }
    catch { /* dismissed; nothing to report */ }
  };

  const wa = `https://wa.me/?text=${encodeURIComponent(`${c.shareText}\n${url}`)}`;

  return (
    <section className="card">
      <h2 className="inline-flex items-center gap-2 font-display text-[19px] font-semibold text-ink">
        <Globe size={18} aria-hidden strokeWidth={1.5} />
        {c.title}
      </h2>
      <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-soft">{c.sub}</p>
      <input
        readOnly value={url} dir="ltr" aria-label={c.title}
        onFocus={(e) => e.currentTarget.select()}
        className="field mt-4 w-full font-mono text-[13px]"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={wa} onClick={share} target="_blank" rel="noopener noreferrer" className="btn-primary">
          <MessageCircle size={15} strokeWidth={1.5} aria-hidden />
          {c.share}
        </a>
        <button type="button" onClick={copy} className="btn-ghost">
          {copied ? <Check size={15} strokeWidth={1.5} aria-hidden /> : <Copy size={15} strokeWidth={1.5} aria-hidden />}
          {copied ? c.copied : c.copy}
        </button>
        <a href={url || '#'} target="_blank" rel="noopener noreferrer" className="btn-quiet">
          <ExternalLink size={15} strokeWidth={1.5} aria-hidden />
          {c.open}
        </a>
      </div>
    </section>
  );
}
