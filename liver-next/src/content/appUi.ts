import type { Locale } from '../lib/locale.ts';
import {
  appCopy, guestsCopy, seatingCopy, dayCopy, threadCopy, partyCopy, contractCopy, eventFileCopy,
} from './site.ts';
import {
  portalEn, filesEn, sheetsEn, tasksEn, moneyEn, boardEn,
  guestsEn, seatingEn, dayEn, threadEn, partyEn, contractEn, eventFileEn,
} from './app.en.ts';

/**
 * The couple's own area, in whichever language they are reading.
 *
 * The public site was the visible half of this problem. The other half is
 * inside: a couple who presses EN in their own area gets the layout flipped to
 * left to right and every word still in Hebrew, which is the exact bug that
 * was just fixed outside the door.
 *
 * Scope is the couple's screens and nothing else. The producer's own console
 * stays Hebrew, deliberately: there is one producer, he works in Hebrew, and
 * an English admin is work nobody would ever read. Blocks shared between the
 * two sides are translated whole, because a half translated object is worse
 * than none.
 *
 * `Wide` does the same job it does for the public copy. The Hebrew blocks are
 * `as const`, so their type is the exact sentence; this widens every leaf to
 * its own kind while keeping the shape, so the English objects are checked for
 * having exactly the same keys and nesting and are free about the words.
 */
type Wide<T> =
  T extends (...args: never[]) => unknown ? T
  : T extends string ? string
  : T extends number ? number
  : T extends boolean ? boolean
  : T extends readonly [unknown, ...unknown[]] ? { readonly [K in keyof T]: Wide<T[K]> }
  : T extends readonly (infer U)[] ? readonly Wide<U>[]
  : { readonly [K in keyof T]: Wide<T[K]> };

export type PortalCopy = Wide<typeof appCopy.portal>;
export type FilesCopy = Wide<typeof appCopy.files>;
export type SheetsCopy = Wide<typeof appCopy.sheets>;
export type TasksCopy = Wide<typeof appCopy.tasks>;
export type MoneyCopy = Wide<typeof appCopy.money>;
export type BoardCopy = Wide<typeof appCopy.board>;
export type GuestsCopy = Wide<typeof guestsCopy>;
export type SeatingCopy = Wide<typeof seatingCopy>;
export type DayCopy = Wide<typeof dayCopy>;
export type ThreadCopy = Wide<typeof threadCopy>;
export type PartyCopy = Wide<typeof partyCopy>;
export type ContractCopy = Wide<typeof contractCopy>;
export type EventFileCopy = Wide<typeof eventFileCopy>;

/** Everything the couple's screens read, resolved together. One object rather
 *  than thirteen lookups, because it travels as one value through one context
 *  rather than as a prop down thirteen component trees. */
export type AppUi = {
  /* The language travels with the words, because several of these screens
     format a date or a time and a formatter locked to he-IL would print a
     Hebrew month inside an otherwise English panel. */
  locale: Locale;
  portal: PortalCopy; files: FilesCopy; sheets: SheetsCopy;
  tasks: TasksCopy; money: MoneyCopy; board: BoardCopy;
  guests: GuestsCopy; seating: SeatingCopy; day: DayCopy;
  thread: ThreadCopy; party: PartyCopy; contract: ContractCopy;
  eventFile: EventFileCopy;
};

export const APP_UI_HE: AppUi = {
  locale: 'he',
  portal: appCopy.portal, files: appCopy.files, sheets: appCopy.sheets,
  tasks: appCopy.tasks, money: appCopy.money, board: appCopy.board,
  guests: guestsCopy, seating: seatingCopy, day: dayCopy,
  thread: threadCopy, party: partyCopy, contract: contractCopy,
  eventFile: eventFileCopy,
};

const APP_UI_EN: AppUi = {
  locale: 'en',
  portal: portalEn, files: filesEn, sheets: sheetsEn,
  tasks: tasksEn, money: moneyEn, board: boardEn,
  guests: guestsEn, seating: seatingEn, day: dayEn,
  thread: threadEn, party: partyEn, contract: contractEn,
  eventFile: eventFileEn,
};

export const appUiFor = (l: Locale): AppUi => (l === 'en' ? APP_UI_EN : APP_UI_HE);
