/**
 * The accessibility settings, and the one that could not be ported as it was.
 *
 * The previous site drove text size with `documentElement.style.fontSize`,
 * which works when the type scale is in `rem`. This one has 564 hardcoded
 * pixel sizes and no `rem` at all, so that control would have moved the root
 * value and changed nothing on screen: a legal requirement that looks present
 * and does not work, which is worse than an absent one.
 *
 * `zoom` on the shell scales pixel values too, so it does what somebody
 * pressing A+ expects. It is applied to a wrapper rather than to `body`,
 * because a zoomed `body` shifts the fixed dock and the sticky nav off their
 * edges.
 *
 * Everything else is a class on the root element and a block of CSS in
 * globals.css, so a setting costs nothing until it is switched on.
 */

export type A11ySettings = {
  /** Steps of 12.5%, 0 to 4. Matches what the previous site offered. */
  font: number;
  contrast: boolean;
  links: boolean;
  readable: boolean;
  motion: boolean;
  cursor: boolean;
};

export const DEFAULTS: A11ySettings = {
  font: 0,
  contrast: false,
  links: false,
  readable: false,
  motion: false,
  cursor: false,
};

export const MAX_FONT_STEP = 4;
const STEP = 12.5;

/** The percentage a step maps to, for the label and for the zoom. */
export const scaleOf = (step: number): number => 100 + clampStep(step) * STEP;

export function clampStep(step: number): number {
  if (!Number.isFinite(step)) return 0;
  return Math.min(MAX_FONT_STEP, Math.max(0, Math.round(step)));
}

/* Kept in one place because the CSS and the toggle have to agree, and a typo
   in either is a switch that does nothing. */
export const CLASSES: Record<Exclude<keyof A11ySettings, 'font'>, string> = {
  contrast: 'a11y-contrast',
  links: 'a11y-links',
  readable: 'a11y-readable',
  motion: 'a11y-stop',
  cursor: 'a11y-big-cursor',
};

export const STORAGE_KEY = 'liver.a11y';

/** Reads what was stored, ignoring anything that is not a setting we have.
 *  A person who set this up once should not have to do it on every visit,
 *  which the previous site made them do: it held the state in a plain object
 *  and lost it on reload. */
export function read(raw: string | null): A11ySettings {
  if (!raw) return { ...DEFAULTS };
  try {
    const parsed = JSON.parse(raw) as Partial<A11ySettings>;
    return {
      font: clampStep(Number(parsed.font ?? 0)),
      contrast: parsed.contrast === true,
      links: parsed.links === true,
      readable: parsed.readable === true,
      motion: parsed.motion === true,
      cursor: parsed.cursor === true,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

/** True when anything is switched on, so the panel can say so. */
export const anyOn = (s: A11ySettings): boolean =>
  s.font > 0 || s.contrast || s.links || s.readable || s.motion || s.cursor;
