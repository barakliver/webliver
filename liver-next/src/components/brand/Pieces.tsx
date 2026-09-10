import type { CSSProperties, ReactNode } from 'react';
import type { StudioCopy } from '@/content/appUi';
import type { Locale } from '@/lib/locale';
import {
  BLEED_MM, MARK_MM, fontPair, inkOn, pieceOf, swatch,
  type PieceKey, type Variant, type WeddingBrand,
} from '@/content/brandKit';

/**
 * The seven pieces, drawn from the brand and the event.
 *
 * Every piece is one function of (brand, option, data): the same function
 * draws the small mockup on the screen and the sheet that goes to the
 * printer, at true size in millimetres, so what was picked is what prints.
 * Type is sized in millimetres too, which is why a 5×7 card and an 18×24
 * sign can share one set of proportions and both come out right.
 *
 * Two options, built from one theme rather than two designs: the quiet one
 * is paper, ink, a hairline in the accent and everything centred; the bold
 * one puts the primary colour on the whole ground, the names at the largest
 * size the card allows, a band in the secondary colour, and sets to the
 * start edge. A pick between them is a pick of temperature, not of world.
 */

export type PieceData = {
  names: [string, string] | [string];
  displayName: string;
  dateText: string;
  timeText: string;
  venue: string;
  rsvpByText: string;
  siteUrl: string;
  moments: { at: string; title: string }[];
  tables: string[];
  daysLeft: number | null;
};

type OnCopy = StudioCopy['on'];

type Theme = {
  bg: string; ink: string; soft: string; accent: string; band: string; bandInk: string;
  display: string; body: string; center: boolean; bold: boolean;
};

const MM = 3.7795;

const withAlpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

export function themeOf(brand: WeddingBrand, variant: Variant): Theme {
  const f = fontPair(brand.fonts);
  const display = `'${f.display}', ${f.serif ? 'serif' : 'sans-serif'}`;
  const body = `'${f.body}', sans-serif`;
  if (variant === 'bold') {
    const bg = swatch(brand, 'primary');
    const ink = inkOn(brand, bg);
    const band = swatch(brand, 'secondary');
    return { bg, ink, soft: withAlpha(ink, 0.72), accent: swatch(brand, 'accent'), band, bandInk: inkOn(brand, band), display, body, center: false, bold: true };
  }
  const bg = swatch(brand, 'light');
  const ink = swatch(brand, 'dark');
  return { bg, ink, soft: withAlpha(ink, 0.66), accent: swatch(brand, 'accent'), band: swatch(brand, 'secondary'), bandInk: ink, display, body, center: true, bold: false };
}

/* ── the frame ─────────────────────────────────────────────────────────── */

/** One trim-sized surface. With `bleed` the box grows by the bleed on every
 *  side and the content stays where the trim would put it, so the ground
 *  runs off the edge and the knife has something to cut through. */
function Card({ w, h, t, bleed = 0, pad = 10, children, dir, marks }: {
  w: number; h: number; t: Theme; bleed?: number; pad?: number; children: ReactNode; dir: 'rtl' | 'ltr'; marks?: boolean;
}) {
  const style: CSSProperties = {
    width: `${w + bleed * 2}mm`, height: `${h + bleed * 2}mm`,
    padding: `${pad + bleed}mm`,
    background: t.bg, color: t.ink, fontFamily: t.body,
    position: 'relative', overflow: 'hidden', boxSizing: 'border-box',
    display: 'flex', flexDirection: 'column',
    justifyContent: 'center',
    alignItems: t.center ? 'center' : 'flex-start',
    textAlign: t.center ? 'center' : 'start',
    lineHeight: 1.25,
  };
  return (
    <div dir={dir} style={style}>
      {children}
      {marks && bleed > 0 && <CropMarks w={w} h={h} bleed={bleed} />}
    </div>
  );
}

/** Four corners, a hairline each way, from the page edge to just short of
 *  the trim corner, in the neutral that shows on either ground. */
function CropMarks({ w, h, bleed }: { w: number; h: number; bleed: number }) {
  const len = Math.min(MARK_MM, bleed - 0.5);
  const line = (s: CSSProperties) => <span style={{ position: 'absolute', background: '#000', outline: '0.15mm solid #fff', ...s }} />;
  const corners: [string, string][] = [['top', 'left'], ['top', 'right'], ['bottom', 'left'], ['bottom', 'right']];
  return (
    <>
      {corners.map(([v, hz]) => (
        <span key={v + hz}>
          {line({ [v]: `${bleed}mm`, [hz]: 0, width: `${len}mm`, height: '0.2mm' })}
          {line({ [hz]: `${bleed}mm`, [v]: 0, height: `${len}mm`, width: '0.2mm' })}
        </span>
      ))}
      <span aria-hidden style={{ position: 'absolute', inset: `${bleed}mm`, outline: '0 solid transparent' }} data-trim={`${w}x${h}`} />
    </>
  );
}

/* ── shared parts ──────────────────────────────────────────────────────── */

function Names({ d, t, size, connector }: { d: PieceData; t: Theme; size: number; connector: string }) {
  const [a, b] = d.names;
  const nameStyle: CSSProperties = { fontFamily: t.display, fontSize: `${size}mm`, lineHeight: 1.05, fontWeight: 400, margin: 0, letterSpacing: t.bold ? '-0.01em' : '0.01em' };
  if (!b) return <p style={nameStyle}>{a}</p>;
  return (
    <div>
      <p style={nameStyle}>{a}</p>
      <p style={{ fontFamily: t.display, fontSize: `${size * 0.45}mm`, color: t.accent, margin: `${size * 0.08}mm 0`, lineHeight: 1 }}>{connector}</p>
      <p style={nameStyle}>{b}</p>
    </div>
  );
}

function Rule({ t, w = 18 }: { t: Theme; w?: number }) {
  return <span aria-hidden style={{ display: 'block', width: `${w}mm`, height: '0.35mm', background: t.accent, margin: t.center ? '3mm auto' : '3mm 0' }} />;
}

function Eyebrow({ t, children, size = 3 }: { t: Theme; children: ReactNode; size?: number }) {
  return <p style={{ fontSize: `${size}mm`, letterSpacing: '0.18em', textTransform: 'uppercase', color: t.bold ? t.ink : t.accent, margin: 0, fontWeight: 600 }}>{children}</p>;
}

/** A web address on a card: broken wherever it must be, never past the edge. */
function Url({ t, url, size = 2.6, accent = false }: { t: Theme; url: string; size?: number; accent?: boolean }) {
  return <p dir="ltr" style={{ fontSize: `${size}mm`, margin: '3mm 0 0', color: accent ? t.accent : t.soft, fontWeight: accent ? 600 : 400, wordBreak: 'break-all', overflowWrap: 'anywhere', maxWidth: '100%', textAlign: t.center ? 'center' : 'start' }}>{url.replace(/^https?:\/\//, '')}</p>;
}

function Line({ t, children, size = 3.6, soft = false }: { t: Theme; children: ReactNode; size?: number; soft?: boolean }) {
  return <p style={{ fontSize: `${size}mm`, margin: 0, color: soft ? t.soft : t.ink }}>{children}</p>;
}

function Band({ t, children }: { t: Theme; children: ReactNode }) {
  return (
    <div style={{ background: t.band, color: t.bandInk, padding: '3mm 5mm', marginTop: '5mm', alignSelf: 'stretch', textAlign: t.center ? 'center' : 'start' }}>
      {children}
    </div>
  );
}

function Motif({ brand, t }: { brand: WeddingBrand; t: Theme }) {
  if (brand.motifs.length === 0) return null;
  return <p style={{ fontSize: '2.6mm', color: t.soft, margin: '4mm 0 0', letterSpacing: '0.06em' }}>{brand.motifs.slice(0, 3).join(' · ')}</p>;
}

/* ── the pieces ────────────────────────────────────────────────────────── */

export type PieceProps = {
  kind: PieceKey; variant: Variant; brand: WeddingBrand; data: PieceData; c: OnCopy; locale: Locale;
  /** For 'table': which one. For 'savedate': which side. */
  page?: number;
  bleed?: number; marks?: boolean;
};

export function Piece({ kind, variant, brand, data: d, c, locale, page = 0, bleed = 0, marks = false }: PieceProps) {
  const t = themeOf(brand, variant);
  const dir = locale === 'he' ? 'rtl' : 'ltr';
  const size = pieceOf(kind)!;
  const conn = locale === 'he' ? 'ו' : '&';
  const frame = { w: size.w, h: size.h, t, bleed, dir, marks } as const;
  const when = [d.dateText, d.timeText].filter(Boolean).join(' · ');

  switch (kind) {
    case 'savedate':
      if (page === 1) {
        return (
          <Card {...frame} pad={12}>
            <Eyebrow t={t}>{c.savedateBack}</Eyebrow>
            <Rule t={t} />
            <Line t={t} size={4.2}>{d.dateText}</Line>
            {d.venue && <Line t={t} soft>{d.venue}</Line>}
            {d.siteUrl && <Url t={t} url={d.siteUrl} />}
          </Card>
        );
      }
      return (
        <Card {...frame} pad={12}>
          <Eyebrow t={t}>{c.savedate}</Eyebrow>
          <div style={{ margin: '6mm 0' }}><Names d={d} t={t} size={t.bold ? 15 : 11} connector={conn} /></div>
          <Rule t={t} />
          <Line t={t} size={4.6}>{d.dateText}</Line>
          {d.venue && <Line t={t} soft>{d.venue}</Line>}
          <Motif brand={brand} t={t} />
        </Card>
      );

    case 'invite':
      return (
        <Card {...frame} pad={12}>
          <Line t={t} size={3.4} soft>{c.invite}</Line>
          <div style={{ margin: '6mm 0' }}><Names d={d} t={t} size={t.bold ? 14 : 11} connector={conn} /></div>
          <Rule t={t} />
          <Line t={t} size={4.4}>{when}</Line>
          {d.venue && <Line t={t} size={3.8}>{d.venue}</Line>}
          {t.bold ? (
            <Band t={t}><Line t={{ ...t, ink: t.bandInk }} size={3}>{c.rsvpBy} {d.rsvpByText}</Line></Band>
          ) : (
            <p style={{ fontSize: '2.9mm', color: t.soft, margin: '7mm 0 0' }}>{c.rsvpBy} {d.rsvpByText}</p>
          )}
        </Card>
      );

    case 'rsvp':
      return (
        <Card {...frame} pad={8}>
          <Eyebrow t={t}>{c.rsvpTitle}</Eyebrow>
          <Rule t={t} w={12} />
          <Line t={t} size={3.6}>{c.rsvpBy} {d.rsvpByText}</Line>
          <Line t={t} size={3} soft>{c.rsvpHow}</Line>
          {d.siteUrl && <Url t={t} url={d.siteUrl} accent />}
          <div style={{ marginTop: '6mm', fontFamily: t.display, fontSize: '4.2mm' }}>{d.displayName}</div>
        </Card>
      );

    case 'details':
      return (
        <Card {...frame} pad={10}>
          <Eyebrow t={t}>{c.detailsTitle}</Eyebrow>
          <div style={{ margin: '5mm 0' }}><Names d={d} t={t} size={6.5} connector={conn} /></div>
          <Rule t={t} w={14} />
          <Line t={t} size={3.8}>{when}</Line>
          {d.venue && <Line t={t} size={3.4}>{d.venue}</Line>}
          <p style={{ fontSize: '3mm', fontWeight: 600, margin: '6mm 0 1mm', color: t.accent, letterSpacing: '0.1em' }}>{c.stay}</p>
          <p style={{ fontSize: '3mm', margin: 0, whiteSpace: 'pre-line', color: t.ink }}>{brand.texts.travel || ' '}</p>
          {d.siteUrl && <Url t={t} url={d.siteUrl} />}
        </Card>
      );

    case 'menu': {
      const lines = brand.texts.menu.split('\n').map((l) => l.trim()).filter(Boolean);
      const courses = lines.length > 0 ? lines : [...c.defaultMenu];
      return (
        <Card {...frame} pad={10}>
          <Eyebrow t={t}>{c.menuTitle}</Eyebrow>
          <div style={{ margin: '4mm 0 2mm', fontFamily: t.display, fontSize: '7.5mm' }}>{d.displayName}</div>
          <Rule t={t} w={14} />
          <ul style={{ listStyle: 'none', padding: 0, margin: '3mm 0 0', display: 'grid', gap: '4mm' }}>
            {courses.map((l, i) => <li key={i} style={{ fontSize: '4.2mm' }}>{l}</li>)}
          </ul>
          <Motif brand={brand} t={t} />
        </Card>
      );
    }

    case 'table': {
      const name = d.tables[page] ?? d.tables[0] ?? '1';
      const numeric = /^\d+$/.test(name);
      return (
        <Card {...frame} pad={10}>
          <Eyebrow t={t} size={3.4}>{c.table}</Eyebrow>
          <p style={{ fontFamily: t.display, fontSize: numeric ? '48mm' : '16mm', lineHeight: 1, margin: '4mm 0', fontWeight: 400 }} dir={numeric ? 'ltr' : dir}>{name}</p>
          <Rule t={t} w={16} />
          <Line t={t} size={3.4} soft>{d.displayName}</Line>
        </Card>
      );
    }

    case 'welcome':
      return (
        <Card {...frame} pad={40}>
          <Eyebrow t={t} size={10}>{c.welcome}</Eyebrow>
          <p style={{ fontSize: '11mm', margin: '8mm 0 0', color: t.soft }}>{c.welcomeTo}</p>
          <div style={{ margin: '16mm 0' }}><Names d={d} t={t} size={t.bold ? 60 : 46} connector={conn} /></div>
          <Rule t={t} w={70} />
          <Line t={t} size={14}>{d.dateText}</Line>
          {d.venue && <Line t={t} size={11} soft>{d.venue}</Line>}
          {brand.motifs.length > 0 && <p style={{ fontSize: '8mm', color: t.soft, margin: '14mm 0 0', letterSpacing: '0.08em' }}>{brand.motifs.slice(0, 3).join(' · ')}</p>}
        </Card>
      );

    case 'program': {
      const rows = d.moments.length > 0 ? d.moments : c.defaultMoments.map((title) => ({ at: '', title }));
      return (
        <Card {...frame} pad={10}>
          <Eyebrow t={t}>{c.program}</Eyebrow>
          <div style={{ margin: '4mm 0 2mm', fontFamily: t.display, fontSize: '7.5mm' }}>{d.displayName}</div>
          <Rule t={t} w={14} />
          <ul style={{ listStyle: 'none', padding: 0, margin: '3mm 0 0', display: 'grid', gap: '4mm', alignSelf: 'stretch' }}>
            {rows.map((m, i) => (
              <li key={i} style={{ display: 'flex', gap: '4mm', alignItems: 'baseline', justifyContent: t.center ? 'center' : 'flex-start', fontSize: '4.2mm' }}>
                {m.at && <span dir="ltr" style={{ fontFamily: t.display, color: t.accent, minWidth: '12mm', fontSize: '4.4mm' }}>{m.at.slice(0, 5)}</span>}
                <span>{m.title}</span>
              </li>
            ))}
          </ul>
        </Card>
      );
    }

    case 'website':
      return <Website t={t} brand={brand} d={d} c={c} dir={dir} />;
  }
}

/** The guests' page as this brand would draw it, one phone screen tall.
 *  Pixels rather than millimetres: this one is never printed. */
function Website({ t, brand, d, c, dir }: { t: Theme; brand: WeddingBrand; d: PieceData; c: OnCopy; dir: 'rtl' | 'ltr' }) {
  const sec = (title: string, body: ReactNode) => (
    <section style={{ padding: '18px 22px', borderTop: `1px solid ${withAlpha(t.ink, 0.12)}` }}>
      <p style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: t.accent, margin: 0, fontWeight: 600 }}>{title}</p>
      <div style={{ marginTop: 8, fontSize: 13, color: t.ink, lineHeight: 1.45 }}>{body}</div>
    </section>
  );
  const soft = { color: t.soft };
  const [a, b] = d.names;
  return (
    <div dir={dir} style={{ width: 390, height: 844, background: t.bg, color: t.ink, fontFamily: t.body, overflow: 'hidden', position: 'relative' }}>
      <header style={{ padding: '44px 22px 26px', textAlign: 'center', background: t.bold ? t.band : t.bg, color: t.bold ? t.bandInk : t.ink }}>
        <p style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', margin: 0, color: t.bold ? t.bandInk : t.accent, fontWeight: 600 }}>{c.invite}</p>
        <p style={{ fontFamily: t.display, fontSize: t.bold ? 44 : 36, lineHeight: 1.05, margin: '14px 0 0' }}>{a}{b ? ` ${dir === 'rtl' ? 'ו' : '&'}${dir === 'rtl' ? '' : ' '}${b}` : ''}</p>
        <p style={{ fontSize: 14, margin: '12px 0 0', ...(t.bold ? {} : soft) }}>{d.dateText}</p>
        {d.venue && <p style={{ fontSize: 13, margin: '2px 0 0', ...(t.bold ? {} : soft) }}>{d.venue}</p>}
        {d.daysLeft !== null && d.daysLeft > 0 && (
          <p style={{ fontFamily: t.display, fontSize: 56, lineHeight: 1, margin: '18px 0 0' }}>
            <span dir="ltr">{d.daysLeft}</span>
            <span style={{ display: 'block', fontFamily: t.body, fontSize: 11, letterSpacing: '0.08em', marginTop: 4, ...(t.bold ? {} : soft) }}>{c.days}</span>
          </p>
        )}
        <span aria-hidden style={{ display: 'block', width: 56, height: 2, background: t.accent, margin: '18px auto 0' }} />
      </header>
      {sec(c.story, <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{brand.texts.story || brand.voice || ' '}</p>)}
      {sec(c.schedule, (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
          {(d.moments.length > 0 ? d.moments : c.defaultMoments.map((title) => ({ at: '', title }))).slice(0, 4).map((m, i) => (
            <li key={i} style={{ display: 'flex', gap: 12 }}>
              {m.at && <span dir="ltr" style={{ fontFamily: t.display, color: t.accent, minWidth: 40 }}>{m.at.slice(0, 5)}</span>}
              <span>{m.title}</span>
            </li>
          ))}
        </ul>
      ))}
      {sec(c.travel, <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{brand.texts.travel || d.venue || ' '}</p>)}
      {sec(c.rsvp, (
        <span style={{ display: 'inline-block', padding: '10px 18px', borderRadius: 999, background: t.bold ? t.accent : t.ink, color: t.bold ? inkOn(brand, t.accent) : t.bg, fontSize: 13, fontWeight: 600 }}>{c.rsvp}</span>
      ))}
      {sec(c.registry, <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{brand.texts.registry || ' '}</p>)}
    </div>
  );
}

/* ── the mockup on the screen ───────────────────────────────────────────── */

/** A piece scaled to sit in a column, without losing its proportions. The
 *  box is sized from the trim so the page does not jump when the fonts
 *  arrive. */
export function Mock({ kind, children, fit = 250 }: { kind: PieceKey; children: ReactNode; fit?: number }) {
  const p = pieceOf(kind)!;
  const isScreen = p.pages === 'screen';
  const wPx = isScreen ? p.w : p.w * MM;
  const hPx = isScreen ? p.h : p.h * MM;
  const s = Math.min(fit / wPx, (fit * 1.3) / hPx, 1);
  return (
    <div style={{ width: wPx * s, height: hPx * s, position: 'relative', overflow: 'hidden' }} className="rounded-lg shadow-[0_1px_2px_rgba(0,0,0,.08),0_8px_24px_rgba(0,0,0,.10)]">
      <div style={{ transform: `scale(${s})`, transformOrigin: 'top left', width: wPx, height: hPx, position: 'absolute', top: 0, left: 0 }}>
        {children}
      </div>
    </div>
  );
}

/** What one print run of a piece is: the pages, in order. */
export function pagesOf(kind: PieceKey, d: PieceData): number[] {
  const p = pieceOf(kind)!;
  if (p.pages === 'two') return [0, 1];
  if (p.pages === 'tables') return d.tables.length > 0 ? d.tables.map((_, i) => i) : [0];
  return [0];
}

export const bleedOf = () => BLEED_MM;
