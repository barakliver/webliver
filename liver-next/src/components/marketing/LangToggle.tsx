import { setLocale } from '@/app/actions/locale';
import { LOCALES, LOCALE_SHORT, LOCALE_LABEL, type Locale } from '@/lib/locale';

/**
 * Hebrew or English, as two buttons rather than a dropdown.
 *
 * Two options do not need a menu, and a menu hides the fact that the other
 * language exists behind a click. Each button is labelled in its own script,
 * because "אנגלית" written in Hebrew is not what somebody looking for English
 * is scanning for.
 *
 * A form, so it works without JavaScript and so the answer is a real
 * navigation: `dir` is an attribute on `<html>`, and flipping it is a new
 * document rather than a re-render.
 */
export function LangToggle({ current, className = '' }: { current: Locale; className?: string }) {
  return (
    <form
      action={setLocale}
      className={`inline-flex items-center rounded-full border border-line p-0.5 ${className}`}
    >
      {LOCALES.map((code) => {
        const on = code === current;
        return (
          <button
            key={code}
            type="submit"
            name="lang"
            value={code}
            aria-label={LOCALE_LABEL[code]}
            aria-current={on ? 'true' : undefined}
            disabled={on}
            className={`min-h-[32px] rounded-full px-3 text-[12.5px] transition-colors ${
              on
                ? 'bg-ink font-medium text-surface'
                : 'text-ink-mute hover:text-ink'
            }`}
          >
            {LOCALE_SHORT[code]}
          </button>
        );
      })}
    </form>
  );
}
