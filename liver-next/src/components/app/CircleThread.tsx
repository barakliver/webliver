'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowLeft, Pencil } from 'lucide-react';
import { useCopy } from '@/components/app/CopyProvider';
import { DeleteForm } from '@/components/app/ConfirmDelete';
import { addCircleReply, deleteCircleReply, editCirclePost, editCircleReply, type CircleResult } from '@/app/actions/circle';
import { AuthorLine, VoteButton, EditedMark } from '@/components/app/CircleFeed';
import type { CirclePost, CircleReply } from '@/lib/circle';
import { count } from '@/lib/copyText';
import { CATEGORY_MARK, CIRCLE_CATEGORIES, type CircleCategory } from '@/content/critique';

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
      <Link href="/app/portal/community" className="btn-quiet inline-flex items-center gap-1.5 px-0 text-body">
        <ArrowLeft size={16} aria-hidden strokeWidth={1.5} />
        {c.title}
      </Link>

      <PostCard post={post} />

      <section aria-label={c.reply.post}>
        <h2 className="eyebrow mb-3">
          {replies.length === 0 ? c.reply.post : count(c.reply.count, replies.length)}
        </h2>
        {replies.length === 0 ? (
          <p className="card text-lead text-ink-mute">{c.reply.none}</p>
        ) : (
          <ul className="list-none space-y-3 p-0">
            {replies.map((r) => (
              <ReplyCard key={r.id} reply={r} postId={post.id} viewer={viewer} />
            ))}
          </ul>
        )}
      </section>

      <form ref={box} action={action} className="card space-y-3">
        <input type="hidden" name="post_id" value={post.id} />
        {clientId && <input type="hidden" name="client_id" value={clientId} />}
        <label className="sr-only" htmlFor="reply">{c.reply.post}</label>
        <textarea id="reply" name="content" required rows={4} className="field" placeholder={c.reply.placeholder} />
        <label className="inline-flex min-h-[48px] cursor-pointer items-center gap-2.5 text-body text-ink">
          <input type="checkbox" name="is_anonymous" className="size-4" />
          {c.form.anonymous}
        </label>
        {state && !state.ok && state.error && <p role="alert" className="text-body text-bad">{state.error}</p>}
        <SendButton />
      </form>
    </div>
  );
}

function SaveEdit() {
  const c = useCopy().circle;
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? c.editSaving : c.editSave}
    </button>
  );
}

/**
 * The question, and the form its author corrects it with.
 *
 * Only the author, and that is the database's answer rather than this
 * screen's: `circle_edit_post` matches on `author_id = auth.uid()` and
 * returns whether it wrote anything. The producer's power in their own
 * circle stays what 0079 made it — removal, not rewriting somebody's words
 * under their own name — so there is no `viewer === 'producer'` here beside
 * the delete.
 */
function PostCard({ post }: { post: CirclePost }) {
  const c = useCopy().circle;
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState<CircleResult | null, FormData>(
    async (prev, form) => {
      const r = await editCirclePost(prev, form);
      if (r.ok) setEditing(false);
      return r;
    },
    null,
  );

  return (
    <article className="card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="inline-flex flex-wrap items-center gap-2">
          <AuthorLine post={post} />
          <EditedMark at={post.edited_at} />
        </span>
        <span className="inline-flex items-center gap-1 text-meta text-ink-mute">
          <span aria-hidden>{CATEGORY_MARK[post.category as CircleCategory] ?? ''} </span>
          {c.categories[post.category as CircleCategory] ?? post.category}
          {post.mine && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={c.editTitle}
              title={c.edit}
              className="ms-1 grid size-9 place-items-center rounded-control text-ink-mute transition hover:bg-surface-200 hover:text-ink"
            >
              <Pencil size={15} strokeWidth={1.5} aria-hidden />
            </button>
          )}
        </span>
      </div>

      {editing ? (
        <form action={action} className="mt-3 space-y-3">
          <input type="hidden" name="id" value={post.id} />
          <label className="block">
            <span className="label">{c.form.category}</span>
            <select name="category" defaultValue={post.category} className="field mt-1 w-full">
              {CIRCLE_CATEGORIES.map((k) => (
                <option key={k} value={k}>{c.categories[k] ?? k}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">{c.form.title}</span>
            <input name="title" required maxLength={140} defaultValue={post.title} className="field mt-1 w-full"  autoComplete="off" enterKeyHint="done" />
          </label>
          <label className="block">
            <span className="label">{c.form.content}</span>
            <textarea name="content" required rows={6} maxLength={6000} defaultValue={post.content} className="field mt-1 w-full" />
          </label>
          <div className="flex items-center gap-3">
            <SaveEdit />
            <button type="button" onClick={() => setEditing(false)} className="btn-quiet px-2 py-1 text-body">
              {c.editCancel}
            </button>
          </div>
          {state && !state.ok && state.error && <p role="alert" className="text-body text-bad">{state.error}</p>}
        </form>
      ) : (
        <>
          <h1 className="mt-2 font-display text-figure font-semibold text-ink">{post.title}</h1>
          <p className="mt-3 whitespace-pre-line text-head leading-relaxed text-ink">{post.content}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <VoteButton post={post} />
            {post.upvotes > 0 && <span className="text-meta text-ink-mute">{count(c.upvotes, post.upvotes)}</span>}
          </div>
        </>
      )}
    </article>
  );
}

/** One answer, and the form its author corrects it with. */
function ReplyCard({ reply: r, postId, viewer }: {
  reply: CircleReply; postId: string; viewer: 'producer' | 'client';
}) {
  const c = useCopy().circle;
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState<CircleResult | null, FormData>(
    async (prev, form) => {
      const res = await editCircleReply(prev, form);
      if (res.ok) setEditing(false);
      return res;
    },
    null,
  );

  return (
    <li className={`card ${r.is_producer ? 'border-accent/40 bg-accent-wash' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="inline-flex flex-wrap items-center gap-2">
          <AuthorLine post={r} />
          <EditedMark at={r.edited_at} />
        </span>
        <div className="flex shrink-0 items-start gap-0.5">
          {r.mine && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={c.editReply}
              title={c.edit}
              className="grid size-9 place-items-center rounded-control text-ink-mute transition hover:bg-surface-200 hover:text-ink"
            >
              <Pencil size={15} strokeWidth={1.5} aria-hidden />
            </button>
          )}
          {(r.mine || viewer === 'producer') && (
            <DeleteForm action={deleteCircleReply}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="post_id" value={postId} />
              <button type="submit" className="btn-quiet px-2 text-body">{c.remove}</button>
            </DeleteForm>
          )}
        </div>
      </div>

      {editing ? (
        <form action={action} className="mt-2 space-y-3">
          <input type="hidden" name="id" value={r.id} />
          <input type="hidden" name="post_id" value={postId} />
          <label className="block">
            <span className="sr-only">{c.editReply}</span>
            <textarea name="content" required rows={4} maxLength={4000} defaultValue={r.content} className="field w-full" />
          </label>
          <div className="flex items-center gap-3">
            <SaveEdit />
            <button type="button" onClick={() => setEditing(false)} className="btn-quiet px-2 py-1 text-body">
              {c.editCancel}
            </button>
          </div>
          {state && !state.ok && state.error && <p role="alert" className="text-body text-bad">{state.error}</p>}
        </form>
      ) : (
        <p className="mt-2 whitespace-pre-line text-lead leading-relaxed text-ink">{r.content}</p>
      )}
    </li>
  );
}
