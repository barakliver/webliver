'use client';

import { MessageCircleQuestion } from 'lucide-react';
import { ChatDock } from '@/components/ChatDock';
import type { CompanionCopy } from '@/content/appUi';

/**
 * The couple's assistant, which is their producer's voice and nobody else's.
 *
 * The portal deliberately had none, and the objection was right: a couple's
 * concierge is their producer, and a second voice in their area would be the
 * platform speaking, which on a white-labelled product it must never do. So
 * this one is built to answer that objection rather than to ignore it. It has
 * no name, introduces nothing, signs nothing, and speaks in the producer's
 * business name because on that couple's screen there is no other identity
 * that exists.
 *
 * Everything it is allowed to know is decided on the server, in
 * `lib/ai/companion.ts` and the route beside it: their own event through their
 * own session, and the producer's gates on top of that. Nothing here can widen
 * it — this file has no idea what the answer is made of, which is the point.
 *
 * A single-line box, like the concierge and unlike the producer's. Nothing
 * here is drafted to be sent on; a couple asks a question the length of a
 * question.
 */
export function CoupleCompanion({ copy }: { copy: CompanionCopy }) {
  return (
    <ChatDock
      copy={copy}
      endpoint="/api/companion"
      icon={MessageCircleQuestion}
      subtitle={<p className="mt-0.5 text-[12.5px] text-ink-mute">{copy.sub}</p>}
      maxChars={1200}
      maxTurns={16}
      /* Above the phone's bottom bar, in the corner the producer's assistant
         uses on their own screens. The two are never on one screen. */
      launcherClass="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] end-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full glass-strong text-accent shadow-dock transition hover:text-ink lg:bottom-6 lg:end-6"
      panelClass="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+9.5rem)] z-40 flex max-h-[62svh] flex-col overflow-hidden rounded-xl2 glass-strong shadow-pop sm:inset-x-auto sm:end-4 sm:w-[26rem] lg:bottom-[5.5rem] lg:end-6 lg:max-h-[70vh]"
    />
  );
}
