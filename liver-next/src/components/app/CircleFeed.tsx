'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Plus, MessageCircle, ThumbsUp, BadgeCheck } from 'lucide-react';
import { useCopy } from '@/components/app/CopyProvider';
import { addCirclePost, toggleCircleVote, deleteCirclePost, type CircleResult } from '@/app/actions/circle';
import type { CirclePost } from '@/lib/circle';
import { count } from '@/lib/copyText';
import { CIRCLE_CATEGORIES, CATEGORY_MARK, type CircleCategory } from '@/content/critique';

/**
 * The circle, as a feed.
 *
 * One producer's couples, which is where the boundary is drawn and where
 * the database draws it too. A post carries a name or it carries "engaged
 * couple, four months to go" — and the second one is not a label the
 * screen puts on: the reader behind this never sends the author of an
 * anonymous post at all, so there is nothing here to leak.
 *
 * A vote is a row, so pressing again takes it back, and pressing twice on
 * a slow connection is one vote rather than two.
 */

export function AuthorLine({ post }: {
  post: Pick<CirclePost, 'is_anonymous' | 'is_producer' | 'author_name' | 'months_out'>;
}) {
  const c = useCopy().circle;
  const name = post.is_anonymous
    ? (post.months_out === null ? c.anon.plain : count(c.anon, post.months_out))
    : (post.author_name || c.anon.plain);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="text-[13.5px] font-medium text-ink">{name}</span>
      {post.is_producer && (
        <span className="chip chip-ok gap-1">
          <BadgeCheck size={13} aria-hidden strokeWidth={1.75} />
          {c.producerBadge}
        </span>
      )}
    </span>
  );
}

function PostButton() {
  const c = useCopy().circle;
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-primary" disabled={pending}>{pending ? c.asking : c.form.post}</button>;
}

function AskForm({ producerId, clientId, category, onDone }: {
  producerId: string; clientId: string | null; category: CircleCategory; onDone: () => void;
}) {
  const c = useCopy().circle;
  const [state, action] = useActionState<CircleResult | null, FormData>(addCirclePost, null);
  useEffect(() => { if (state?.ok) onDone(); }, [state, onDone]);

  return (
    <form action={action} className="card space-y-4">
      <input type="hidden" name="producer_id" value={producerId} />
      {clientId && <input type="hidden" name="client_id" value={clientId} />}
      <label className="grid gap-1.5 text-[13px] text-ink-soft">{c.form.category}
        <select name="category" defaultValue={category} className="field">
          {CIRCLE_CATEGORIES.map((k) => (
            <option key={k} value={k}>{CATEGORY_MARK[k]} {c.categories[k]}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-[13px] text-ink-soft">{c.form.title}
        <input name="title" required minLength={2} maxLength={140} className="field" placeholder={c.form.titlePh} autoComplete="off" /></label>
      <label className="grid gap-1.5 text-[13px] text-ink-soft">{c.form.content}
        <textarea name="content" required minLength={2} rows={5} className="field" placeholder={c.form.contentPh} /></label>
      <div>
        <label className="inline-flex min-h-[48px] cursor-pointer items-center gap-2.5 text-[14.5px] text-ink">
          <input type="checkbox" name="is_anonymous" className="size-4" />
          {c.form.anonymous}
        </label>
        <p className="text-[12.5px] leading-relaxed text-ink-mute">{c.form.anonymousHint}</p>
      </div>
      {state && !state.ok && state.error && <p role="alert" className="text-[14px] text-bad">{state.error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <PostButton />
        <button type="button" onClick={onDone} className="btn-quiet text-[14px]">{c.cancel}</button>
      </div>
    </form>
  );
}

export function VoteButton({ post }: { post: Pick<CirclePost, 'id' | 'upvotes' | 'voted'> }) {
  const c = useCopy().circle;
  return (
    <form action={toggleCircleVote} className="inline-flex">
      <input type="hidden" name="post_id" value={post.id} />
      <input type="hidden" name="on" value={post.voted ? 'false' : 'true'} />
      <button
        type="submit" aria-pressed={post.voted}
        title={post.voted ? c.upvoted : c.upvote}
        className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-button border px-3 text-[13.5px] transition ${
          post.voted ? 'border-accent bg-accent-wash text-accent' : 'border-line-strong bg-card text-ink-soft hover:border-accent/50'
        }`}
      >
        <ThumbsUp size={14} aria-hidden strokeWidth={1.75} />
        <span className="tabular-nums">{post.upvotes}</span>
        <span className="sr-only">{post.voted ? c.upvoted : c.upvote}</span>
      </button>
    </form>
  );
}

export function CircleFeed({ producerId, clientId, posts, category, viewer }: {
  producerId: string;
  clientId: string | null;
  posts: CirclePost[];
  category: CircleCategory | '';
  viewer: 'producer' | 'client';
}) {
  const c = useCopy().circle;
  const [asking, setAsking] = useState(false);

  return (
    <div className="space-y-5">
      <nav aria-label={c.title} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        {[{ k: '' as const, label: c.all, mark: '' }, ...CIRCLE_CATEGORIES.map((k) => ({ k, label: c.categories[k], mark: CATEGORY_MARK[k] }))].map((t) => (
          <Link
            key={t.k || 'all'}
            href={t.k ? `/app/portal/community?c=${t.k}` : '/app/portal/community'}
            aria-current={category === t.k ? 'page' : undefined}
            className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-button border px-3.5 text-[14px] transition ${
              category === t.k ? 'border-accent bg-accent text-white' : 'border-line-strong bg-card text-ink-soft hover:border-accent/50'
            }`}
          >
            {t.mark && <span aria-hidden>{t.mark}</span>}
            {t.label}
          </Link>
        ))}
      </nav>

      {asking
        ? <AskForm producerId={producerId} clientId={clientId} category={(category || 'general') as CircleCategory} onDone={() => setAsking(false)} />
        : (
          <button type="button" onClick={() => setAsking(true)} className="btn-primary inline-flex items-center gap-2">
            <Plus size={17} aria-hidden strokeWidth={1.5} />{c.ask}
          </button>
        )}

      <p className="text-[12.5px] leading-relaxed text-ink-mute">{c.rules}</p>

      {posts.length === 0 ? (
        <p className="card text-[15px] text-ink-mute">{category ? c.noneCategory : c.none}</p>
      ) : (
        <ul className="list-none space-y-4 p-0">
          {posts.map((p) => (
            <li key={p.id}>
              <article className="card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <AuthorLine post={p} />
                  <span className="text-[12.5px] text-ink-mute">
                    <span aria-hidden>{CATEGORY_MARK[p.category as CircleCategory] ?? ''} </span>
                    {c.categories[p.category as CircleCategory] ?? p.category}
                  </span>
                </div>
                <h2 className="mt-2 font-display text-[19px] font-semibold text-ink">
                  <Link href={`/app/portal/community/${p.id}`} className="hover:underline">{p.title}</Link>
                </h2>
                <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">{p.content}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <VoteButton post={p} />
                  <Link
                    href={`/app/portal/community/${p.id}`}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-button border border-line-strong bg-card px-3 text-[13.5px] text-ink-soft transition hover:border-accent/50"
                  >
                    <MessageCircle size={14} aria-hidden strokeWidth={1.75} />
                    {p.replies === 0 ? c.reply.post : count(c.reply.count, p.replies)}
                  </Link>
                  {(p.mine || viewer === 'producer') && (
                    <form action={deleteCirclePost} className="ms-auto">
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className="btn-quiet px-2 text-[13px]">{c.remove}</button>
                    </form>
                  )}
                </div>
                {p.upvotes > 0 && (
                  <p className="mt-2 text-[12.5px] text-ink-mute">{count(c.upvotes, p.upvotes)}</p>
                )}
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
