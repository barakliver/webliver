'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { withParam } from '@/lib/portalScope';

export type SwitchableWorkspace = { id: string; display_name: string; event_date: string | null };

/**
 * Which celebration this screen is about, when a couple has more than one.
 *
 * It exists because the page stopped drawing all of them at once. While every
 * workspace was on the page there was nothing to switch between and nothing
 * said which was which; now there is one, and a screen showing one of several
 * things has to say which one out loud or it is simply the wrong screen with
 * no warning.
 *
 * A single workspace draws nothing at all. A control with one option is a
 * control that teaches somebody there is a choice where there is none.
 *
 * The selection goes in the address rather than in a hook, for the same two
 * reasons the celebration selector gives: two tabs, and filtering that
 * happens on the server where the rows already are. And it is written with
 * `withParam`, so choosing a workspace keeps whatever else the address is
 * carrying rather than resetting the screen to its defaults.
 */
export function WorkspaceSwitcher({ workspaces, selectedId, label, dateless }: {
  workspaces: SwitchableWorkspace[];
  selectedId: string | null;
  label: string;
  /** What to say instead of a date. An empty space under the name reads as a
   *  date that failed to load rather than one nobody has picked. */
  dateless: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  if (workspaces.length <= 1) return null;

  const open = (id: string) => {
    router.push(`${pathname}?${withParam(params.toString(), 'w', id)}`, { scroll: false });
  };

  return (
    <div role="tablist" aria-label={label} className="mb-6 flex gap-2 overflow-x-auto">
      {workspaces.map((w) => {
        const on = w.id === selectedId;
        return (
          <button
            key={w.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => open(w.id)}
            /* 48px, which is the product's touch target and was not being met
               by the 34px chips this replaces. */
            className={`flex min-h-[48px] flex-col justify-center whitespace-nowrap rounded-control border px-4 py-2 text-start transition-colors ${
              on
                ? 'border-accent bg-accent-wash text-ink'
                : 'border-line-strong bg-card text-ink-soft hover:border-accent/50 hover:text-ink'
            }`}
          >
            <span className={`text-[14.5px] ${on ? 'font-semibold' : ''}`}>{w.display_name}</span>
            <span className="text-[12.5px] text-ink-mute">{w.event_date ?? dateless}</span>
          </button>
        );
      })}
    </div>
  );
}
