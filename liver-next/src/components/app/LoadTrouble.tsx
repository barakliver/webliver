import { TriangleAlert } from 'lucide-react';
import { loadFailures } from '@/lib/safe';
import { appUiFor } from '@/content/appUi';
import { currentLocale } from '@/lib/serverLocale';

/**
 * One line above a screen that did not fully load.
 *
 * A read that fails is contained rather than allowed to take the page down,
 * which is right, and it returns no rows — which is also exactly what a guest
 * list nobody has started returns. So the screen says "no guests yet", and
 * that is not an error message: it is a confident statement of fact about
 * somebody's wedding, and it is wrong.
 *
 * The same shape as the print stylesheet that produced a blank page. A
 * failure whose output is indistinguishable from an ordinary correct state is
 * a failure nobody reports, because there is nothing to report — the screen
 * looks fine.
 *
 * So the empty states are left exactly as they are, and this changes what the
 * emptiness means. It renders nothing on the ordinary morning, which is
 * almost every morning.
 *
 * What it does not say is which read broke. A table name is the producer's
 * problem to carry and not their problem to solve, and the log already has it
 * with the label of the part that failed.
 */
export async function LoadTrouble() {
  const failed = loadFailures();
  if (failed.length === 0) return null;

  const ui = appUiFor(await currentLocale());
  return <TroubleLine text={ui.loadTrouble} />;
}

/**
 * The same line, without the reason it appears.
 *
 * Split out so it can be rendered somewhere other than a failing screen. This
 * is a state that shows on almost no morning, which is precisely why nobody
 * had ever looked at it: it cannot be produced on purpose from the outside,
 * and a marker that reaches into the failure store to force it would make
 * every other panel on the page claim it had failed too.
 */
export function TroubleLine({ text }: { text: string }) {
  return (
    <p
      role="status"
      className="mb-5 flex items-start gap-2.5 rounded-xl2 border border-warn/30 bg-warn-wash px-4 py-3 text-[14px] leading-relaxed text-ink"
    >
      <TriangleAlert size={17} strokeWidth={1.5} aria-hidden className="mt-0.5 shrink-0 text-warn" />
      <span>{text}</span>
    </p>
  );
}
