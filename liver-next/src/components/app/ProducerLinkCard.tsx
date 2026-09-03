'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, MessageCircle, Send } from 'lucide-react';
import { appCopy } from '@/content/site';

const c = appCopy.brand;

/**
 * The link a producer sends their couples.
 *
 * The sign-in address on the platform's domain draws the platform owner's
 * card in WhatsApp, and a producer who forwards it has just introduced their
 * couple to somebody else's business. This is the link they send instead:
 * their own front door, resolved by the slug they chose, carrying their name
 * and their mark. Built from the page's own origin, like every other shared
 * address here, so it is right on any host the console is opened from.
 */
export function ProducerLinkCard({ slug }: { slug: string | null }) {
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (slug) setUrl(`${window.location.origin}/p/${slug}`);
  }, [slug]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* the field is selectable; copying by hand still works */ }
  };

  return (
    <section className="card">
      <h2 className="inline-flex items-center gap-2 font-display text-[17px] font-light text-ink">
        <Send size={17} aria-hidden strokeWidth={1.5} />
        {c.shareTitle}
      </h2>
      <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-soft">{c.shareSub}</p>
      {slug ? (
        <>
          <input
            readOnly value={url} dir="ltr" aria-label={c.shareTitle}
            onFocus={(e) => e.currentTarget.select()}
            className="field mt-4 w-full font-mono text-[13px]"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`${c.shareText}\n${url}`)}`}
              target="_blank" rel="noopener noreferrer" className="btn-primary"
            >
              <MessageCircle size={15} strokeWidth={1.5} aria-hidden />
              {c.shareWhatsapp}
            </a>
            <button type="button" onClick={copy} className="btn-ghost">
              {copied ? <Check size={15} strokeWidth={1.5} aria-hidden /> : <Copy size={15} strokeWidth={1.5} aria-hidden />}
              {copied ? c.shareCopied : c.shareCopy}
            </button>
          </div>
        </>
      ) : (
        <p className="mt-3 text-[13.5px] text-ink-mute">{c.shareNoSlug}</p>
      )}
    </section>
  );
}
