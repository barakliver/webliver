'use client';

import { useEffect } from 'react';

/**
 * The last resort: the root layout itself threw.
 *
 * Every other boundary in this app renders inside that layout, so when the
 * layout is what failed none of them exist and the browser shows its own blank
 * page. This one replaces the document, which is why it carries its own
 * `<html>` and `<body>` — and why every colour here is written out rather than
 * taken from a token. The stylesheet is part of what did not load.
 *
 * It stays deliberately small. Whatever broke is upstream of the fonts, the
 * copy modules and the language cookie, so this asks for none of them: one
 * sentence in Hebrew, one in English, a reload, and the fault code that finds
 * the matching line in the log. Anything more here is another thing that can
 * fail while explaining a failure.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[root] the layout itself failed', error); }, [error]);

  return (
    <html lang="he" dir="rtl">
      <body style={{
        margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center',
        /* The planning system's own values, written out: ground, ink, the
           soft and muted inks, and the deep teal action. If the palette in
           globals.css moves, these move with it by hand. */
        background: '#F8F8F0', color: '#292823', padding: '24px',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      }}>
        <main style={{ maxWidth: '30rem', textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600, lineHeight: 1.3 }}>
            משהו נפל אצלנו
          </h1>
          <p style={{ margin: '12px 0 0', fontSize: '15px', lineHeight: 1.6, color: '#65625B' }}>
            התקלה בצד שלנו ולא בצד שלכם. אפשר לרענן את העמוד.
          </p>
          <p style={{ margin: '6px 0 0', fontSize: '14px', lineHeight: 1.6, color: '#605D56' }} lang="en" dir="ltr">
            Something failed on our side. Reloading the page usually fixes it.
          </p>

          <button
            type="button" onClick={reset}
            style={{
              marginTop: '28px', minHeight: '48px', padding: '0 24px',
              border: 'none', borderRadius: '12px', cursor: 'pointer',
              background: '#205757', color: '#FFFFFF', fontSize: '16px', fontWeight: 600, fontFamily: 'inherit',
            }}
          >
            לנסות שוב
          </button>

          {error.digest && (
            <p style={{ margin: '28px 0 0', fontSize: '12.5px', color: '#605D56' }}>
              קוד לתקלה:{' '}
              <code dir="ltr" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                {error.digest}
              </code>
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
