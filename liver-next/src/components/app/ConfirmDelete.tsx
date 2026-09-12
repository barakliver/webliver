'use client';

import { useRef, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { useCopy } from '@/components/app/CopyProvider';

/**
 * A delete that asks first, in the page rather than in the browser's box.
 *
 * Four screens asked with `window.confirm`, which is unstyled, unlabelled
 * in Hebrew on some browsers, and dismissed by muscle memory; the rest
 * deleted on the press. This wraps the form: the press opens a small
 * modal with the question, a cancel, and a delete drawn in the error tone;
 * the delete submits the very same form, so the action, the hidden fields
 * and the server's own checks are exactly what they were.
 *
 * A native `<dialog>` so the browser handles focus, Escape and the backdrop.
 */
/** The gallery's way in: a trash button whose delete goes nowhere, so the
 *  dialog can be opened and looked at. */
export function ConfirmDeleteDemo({ ask }: { ask?: string }) {
  const c = useCopy().confirm;
  return (
    <DeleteForm action={async () => {}} ask={ask}>
      <button type="submit" className="btn-ghost inline-flex items-center gap-2 text-[14px]">
        {c.delete}
      </button>
    </DeleteForm>
  );
}

export function DeleteForm({ action, ask, className, children }: {
  action: (form: FormData) => void | Promise<void>;
  /** The question, when the screen has a more specific one than the default. */
  ask?: string;
  className?: string;
  /** The hidden inputs and the trash button, as they were. */
  children: ReactNode;
}) {
  const c = useCopy().confirm;
  const form = useRef<HTMLFormElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const armed = useRef(false);

  return (
    <>
      <form
        ref={form}
        action={action}
        className={className}
        onSubmit={(e) => {
          if (armed.current) { armed.current = false; return; }
          e.preventDefault();
          dialog.current?.showModal();
        }}
      >
        {children}
      </form>
      <dialog
        ref={dialog}
        className="w-[min(92vw,22rem)] rounded-card border border-line bg-card p-6 text-ink shadow-lift backdrop:bg-scrim/30"
        aria-labelledby="confirm-delete-title"
      >
        <p id="confirm-delete-title" className="flex items-start gap-2.5 text-[15.5px] font-medium leading-snug text-ink">
          <TriangleAlert size={18} aria-hidden strokeWidth={1.5} className="mt-0.5 shrink-0 text-bad" />
          {ask ?? c.ask}
        </p>
        <p className="mt-2 text-[13.5px] text-ink-soft">{c.sub}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => dialog.current?.close()}>{c.cancel}</button>
          <button
            type="button"
            className="btn bg-bad text-white hover:bg-bad/90"
            onClick={() => {
              dialog.current?.close();
              armed.current = true;
              form.current?.requestSubmit();
            }}
          >
            {c.delete}
          </button>
        </div>
      </dialog>
    </>
  );
}
