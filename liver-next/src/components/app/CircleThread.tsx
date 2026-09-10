'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowRight } from 'lucide-react';
import { useCopy } from '@/components/app/CopyProvider';
import { addCircleReply, deleteCircleReply, type CircleResult } from '@/app/actions/circle';
import { AuthorLine, VoteButton } from '@/components/app/CircleFeed';
import type { CirclePost, CircleReply } from '@/lib/circle';
import { count } from '@/lib/copyText';
import { CATEGORY_MARK, type CircleCategory } from '@/content/critique';

/**
 * One question, and what the circle said back.
 *
 * The producer's answer carries a badge, and the badge is stamped by the
 * database from the author's real role rather than by anything a caller
 * sends, so it means what it says. A couple who asked anonymously answers
 * anonymously too: the toggle sits on the reply box as well as on the
 * question.
 */

function SendButton() {
  const c = useCopy().circle;
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-primary" disabled={pending}>{pending ? c.reply.posting : c.reply.post}</button>;
}

export function CircleThread({ post, replies, clientId, viewer }: {
  post: CirclePost; replies: CircleReply[]; clientId: string | null; viewer: 'producer' | 'client';
}) {
  const c = useCopy().circle;
  const [state, action] = useActionState<CircleResult | null, FormData>(addCircleReply, null);
  const box = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) box.current?.reset(); }, [state]);

  return (
    <div className="space-y-5">
      <Link href="/app/portal/community" className="btn-quiet inline-flex items-center gap-1.5 px-0 text-[14px]">
        <ArrowRight size={16} aria-hidden strokeWidth={1.5} />
        {c.title}
      </Link>

      <article className="card">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <AuthorLine post={post} />
          <span className="text-[12.5px] text-ink-mute">
            <span aria-hidden>{CATEGORY_MARK[post.category as CircleCategory] ?? ''} </span>
            {c.categories[post.category as CircleCategory] ?? post.category}
          </span>
        </div>
        <h1 className="mt-2 font-display text-[24px] font-semibold text-ink">{post.title}</h1>
        <p className="mt-3 whitespace-pre-line text-[16px] leading-relaxed text-ink">{post.content}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <VoteButton post={post} />
          {post.upvotes > 0 && <span className="text-[12.5px] text-ink-mute">{count(c.upvotes, post.upvotes)}</span>}
        </div>
      </article>

      <section aria-label={c.reply.post}>
        <h2 className="eyebrow mb-3">
          {replies.length === 0 ? c.reply.post : count(c.reply.count, replies.length)}
        </h2>
        {replies.length === 0 ? (
          <p className="card text-[15px] text-ink-mute">{c.reply.none}</p>
        ) : (
          <ul className="list-none space-y-3 p-0">
            {replies.map((r) => (
              <li key={r.id} className={`card ${r.is_producer ? 'border-accent/40 bg-accent-wash' : ''}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <AuthorLine post={r} />
                  {(r.mine || viewer === 'producer') && (
                    <form action={deleteCircleReply}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="post_id" value={post.id} />
                      <button type="submit" className="btn-quiet px-2 text-[13px]">{c.remove}</button>
                    </form>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink">{r.content}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form ref={box} action={action} className="card space-y-3">
        <input type="hidden" name="post_id" value={post.id} />
        {clientId && <input type="hidden" name="client_id" value={clientId} />}
        <label className="sr-only" htmlFor="reply">{c.reply.post}</label>
        <textarea id="reply" name="content" required rows={4} className="field" placeholder={c.reply.placeholder} />
        <label className="inline-flex min-h-[48px] cursor-pointer items-center gap-2.5 text-[14.5px] text-ink">
          <input type="checkbox" name="is_anonymous" className="size-4" />
          {c.form.anonymous}
        </label>
        {state && !state.ok && state.error && <p role="alert" className="text-[14px] text-bad">{state.error}</p>}
        <SendButton />
      </form>
    </div>
  );
}
