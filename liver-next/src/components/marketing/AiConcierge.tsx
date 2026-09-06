'use client';

import { MessagesSquare } from 'lucide-react';
import { ChatDock } from '@/components/ChatDock';
import type { ConciergeCopy } from '@/content/ui';

/**
 * A concierge, not a chatbot.
 *
 * It opens closed and stays closed until somebody asks it something, because a
 * panel that springs open on a wedding photographer's homepage is an
 * interruption dressed as help. The opening line names what it can actually
 * answer rather than saying hello, so the first question is a real one.
 *
 * Everything below the surface is `ChatDock`, which is the same panel the
 * producer's assistant and the couple's wear. What is left here is what makes
 * this one the concierge: it answers a stranger on a public page, so the box
 * is a single line and an opener writes the question into it rather than
 * asking it — somebody who has not decided to talk to a website yet should
 * see what they are about to send.
 */
export function AiConcierge({ copy: c }: { copy: ConciergeCopy }) {
  return (
    <ChatDock
      copy={c}
      endpoint="/api/ai-concierge"
      icon={MessagesSquare}
      subtitle={<p className="mt-0.5 text-[12.5px] text-ink-mute">{c.sub}</p>}
      maxChars={1000}
      maxTurns={20}
    />
  );
}
