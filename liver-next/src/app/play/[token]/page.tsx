import type { Metadata } from 'next';
import { supabasePublic } from '@/lib/supabase/public';
import { splitNames } from '@/content/brandKit';
import { dealDeck } from '@/lib/game';
import { game } from '@/content/game';
import { GameTable } from '@/components/game/GameTable';

export const dynamic = 'force-dynamic';

/**
 * The card game, on its own.
 *
 * Outside `/app` on purpose, which is the whole of how "they are in the game
 * and not in the site" is implemented: this route never touches the app
 * layout, so there is no header, no tab bar, no notification bell and no
 * search. What a couple gets is the root layout — fonts, direction, the
 * accessibility menu, which every screen in this product has to carry — and
 * then the table.
 *
 * Anonymous, like the guests' page in `/w`, and for the same reason: a
 * wedding is two people with one account between them, so a game that
 * demanded a sign-in would be a game only one of them could play. The token
 * in the path is the credential. `wedding_game` answers for a switched-on
 * game and nothing else, and a wrong token and a shut game get the same
 * silence, so neither can be told from the other by trying.
 */

type Row = { couple: string; event_date: string | null; producer: string };

async function load(token: string): Promise<Row | null> {
  /* Shaped before it is spent, so a junk path is a render and not a round
     trip. Same guard the guests' route uses. */
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  try {
    const { data, error } = await supabasePublic().rpc('wedding_game', { p_token: token });
    if (error) { console.error('[game] lookup failed', error); return null; }
    const row = (Array.isArray(data) ? data[0] : data) as Row | null;
    return row ?? null;
  } catch (e) {
    console.error('[game] lookup threw', e);
    return null;
  }
}

/* Never indexed, and no share card. This is a private thing between two
   people; a preview of it in a search result or a WhatsApp thumbnail is the
   opposite of what it is for. */
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const row = await load(token);
  return {
    title: row ? game.kicker : game.gone,
    robots: { index: false, follow: false, nocache: true },
  };
}

export default async function PlayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = await load(token);

  if (!row) {
    return (
      <main id="main" className="flex min-h-[100svh] flex-col items-center justify-center bg-dark px-6 text-center text-surface">
        <h1 className="font-display text-2xl font-medium">{game.gone}</h1>
        <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-surface/65">{game.goneBody}</p>
      </main>
    );
  }

  /* Dealt here rather than in the browser. The deal is a pure function of the
     token, so both would agree — but only one of them can be wrong, and the
     server is the one that cannot be half-hydrated. */
  const deck = dealDeck(token);

  /* The document's one <main>, supplied here rather than inside the table:
     the table swaps between three screens and would otherwise have to render
     three of them, and the skip link at the top of the page needs exactly one
     thing to skip to. */
  return (
    <main id="main">
      <GameTable
        token={token}
        names={splitNames(row.couple)}
        producer={row.producer}
        deck={deck}
      />
    </main>
  );
}
