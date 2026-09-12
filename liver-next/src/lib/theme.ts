/**
 * Light or dark, and the one line of script that has to run before paint.
 *
 * Three states rather than two. "Follow the device" is the default, because
 * somebody who has already told their phone they want dark screens at night
 * has said it once and should not have to say it again here. The other two
 * are a decision that outranks the device, which is the whole point of
 * offering them: a producer working on a bright stage in daylight wants the
 * light one whatever the phone thinks, and the same person at 2am wants the
 * dark one whatever the hour says.
 *
 * The palette itself is not here. It is a block of token overrides in
 * globals.css under `:root.theme-dark`, the same shape the accessibility
 * modes use, so a screen costs nothing until somebody switches over and no
 * component anywhere needs to know which palette it is drawing on.
 */

export type Theme = 'auto' | 'light' | 'dark';

/**
 * Where the dark palette applies: the platform, and nothing else.
 *
 * Not a hedge. The public pages are somebody's shopfront and somebody's
 * wedding page, and both are built the way a poster is: the headline is
 * ivory because it is lying on a photograph, not because the page behind it
 * is light. Turn the palette over underneath them and the hero's own title
 * goes near-black on a picture of a bride — which is exactly what the first
 * render of this showed, and it is not a bug in the hero. A visitor's
 * operating system should not repaint a business's front door anyway.
 *
 * So the app decides, and the shopfront keeps the brand's daylight. `/design`
 * is in because it is the gallery the app's own components are looked at in,
 * and a palette nobody can see rendered is a palette nobody checks.
 */
export function isPlatform(path: string): boolean {
  return path === '/app' || path.startsWith('/app/')
    || path === '/design' || path.startsWith('/design/');
}

export const THEMES: Theme[] = ['auto', 'light', 'dark'];

/** Its own key, not folded into the accessibility settings. The boot script
 *  below reads it before anything else on the page has run, and parsing a
 *  JSON object of six unrelated settings to answer one question is work done
 *  on the critical path of every single page load. */
export const THEME_KEY = 'liver.theme';

export const DARK_CLASS = 'theme-dark';

export function readTheme(raw: string | null | undefined): Theme {
  return raw === 'light' || raw === 'dark' || raw === 'auto' ? raw : 'auto';
}

/** What to actually draw, given the choice and what the device says. */
export function resolve(theme: Theme, deviceIsDark: boolean): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') return theme;
  return deviceIsDark ? 'dark' : 'light';
}

/**
 * Run before the first paint, in the document head.
 *
 * Without this the page draws the light palette, hydrates, and only then
 * finds out the person chose dark — a white flash on every navigation, at
 * night, which is exactly when somebody who chose dark is looking. The
 * accessibility panel applies its own classes in an effect and has always
 * had that flash; it is survivable for a letter-spacing change and it is not
 * for a whole palette.
 *
 * It is deliberately tiny, wrapped so that a private window with storage
 * switched off throws nothing, and it writes `color-scheme` as well as the
 * class: the scrollbar, the date picker and the native select are drawn by
 * the browser and read that property rather than our tokens. A dark app with
 * a white calendar popping out of it is the tell that this line is missing.
 */
export const BOOT_SCRIPT = `(function(){try{
var p=location.pathname;
var app=p==='/app'||p.indexOf('/app/')===0||p==='/design'||p.indexOf('/design/')===0;
var t=localStorage.getItem('${THEME_KEY}');
var d=app&&(t==='dark'||((!t||t==='auto')&&window.matchMedia('(prefers-color-scheme: dark)').matches));
var e=document.documentElement;
e.classList.toggle('${DARK_CLASS}',d);
e.style.colorScheme=d?'dark':'light';
}catch(e){}})();`;

/**
 * Applied by the control, by the device's own change while on auto, and on
 * every navigation.
 *
 * The last one is why this reads the path rather than trusting the class
 * already on the page: the script above runs once per document, and a person
 * who walks from the dark app to the public site through a link never
 * reloads anything. Without this the shopfront would inherit the palette of
 * the screen they came from.
 */
export function apply(theme: Theme): void {
  const deviceIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = isPlatform(window.location.pathname)
    && resolve(theme, deviceIsDark) === 'dark';
  const root = document.documentElement;
  root.classList.toggle(DARK_CLASS, dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
}

/** What is stored, or the default, without throwing in a private window. */
export function stored(): Theme {
  try { return readTheme(window.localStorage.getItem(THEME_KEY)); } catch { return 'auto'; }
}

/**
 * The choice now lives in two places on screen at once — a switch in the
 * header and a three-way control in the accessibility menu — and the one
 * thing that must never happen is the two of them disagreeing. Neither owns
 * the state: this does. Both write through here and both listen for this
 * event, so a press on either is a press on both.
 */
export const THEME_EVENT = 'liver:theme';

export function setTheme(theme: Theme): void {
  try { window.localStorage.setItem(THEME_KEY, theme); } catch { /* private window */ }
  apply(theme);
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }));
}

/** Whether the dark palette is what is actually on the page right now. Read
 *  from the element rather than worked out again: the boot script, the route
 *  scope and the device preference all have a say, and the class is where
 *  all three have already been resolved. */
export function showingDark(): boolean {
  return document.documentElement.classList.contains(DARK_CLASS);
}
