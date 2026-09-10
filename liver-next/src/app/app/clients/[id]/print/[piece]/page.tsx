import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { serverCopy } from '@/lib/serverLocale';
import { PrintButton } from '@/components/app/PrintButton';
import { loadBrandScreen } from '@/lib/brandLoad';
import { Piece, pagesOf } from '@/components/brand/Pieces';
import { BLEED_MM, defaultBrand, fontHref, pieceOf, variantFor, type PieceKey } from '@/content/brandKit';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string; piece: string }> }) {
  const { piece } = await params;
  const c = (await serverCopy()).studio;
  const p = pieceOf(piece);
  return { title: p ? c.pieces.names[p.key] : c.title };
}

/**
 * One piece, at true size, with bleed and crop marks, ready for a printer.
 *
 * Printed by the browser, like every other document here: Hebrew set by the
 * engine that already sets it right, and "save as PDF" on every machine.
 * The page is the trim plus 3 mm on every side, the ground runs to the
 * page edge, and the crop marks show the knife where the trim is. The
 * table cards print one page per table; the save-the-date prints its back.
 *
 * The option printed is the one picked on the studio, else the board's
 * lean, so the sheet and the mockup agree.
 */
export default async function PrintPiecePage({ params }: { params: Promise<{ id: string; piece: string }> }) {
  await requireLiveProducer();
  const { id, piece } = await params;
  const p = pieceOf(piece);
  if (!p) notFound();
  const ui = await serverCopy();
  const c = ui.studio;

  const sb = await supabaseServer();
  const { data: client } = await sb.from('clients')
    .select('id,display_name,event_date,venue,guest_token,guest_site_on,brand')
    .eq('id', id).maybeSingle();
  if (!client) notFound();

  const screen = await loadBrandScreen(sb, client, ui.locale);
  if (p.pages === 'screen') redirect(screen.siteUrl || `/app/clients/${id}?tab=board`);

  const brand = screen.brand ?? defaultBrand();
  const variant = variantFor(brand, p.key as PieceKey);
  const pages = pagesOf(p.key as PieceKey, screen.data);
  const W = p.w + BLEED_MM * 2;
  const H = p.h + BLEED_MM * 2;

  return (
    <>
      <link rel="stylesheet" href={fontHref(brand.fonts)} precedence="default" />
      {/* The page size is this piece's and nobody else's: a named page, so
          the product's A4 rules stay where they are. Colour must survive the
          print dialog's "save ink" default or the bold option prints white. */}
      <style>{`
        @page brand-sheet { size: ${W}mm ${H}mm; margin: 0; }
        .brand-sheet { page: brand-sheet; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .brand-sheet * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .brand-page { break-after: page; }
        .brand-page:last-child { break-after: auto; }
        @media print { .brand-sheet { padding: 0 !important; background: transparent !important; } }
      `}</style>

      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/app/clients/${id}?tab=board`} className="btn-quiet inline-flex items-center gap-1.5 px-0 text-[14px]">
          <ArrowRight size={16} aria-hidden strokeWidth={1.5} />
          {c.printPage.back}
        </Link>
        <PrintButton label={c.printPage.print} />
      </div>
      <div className="no-print mb-6 max-w-2xl">
        <h1 className="font-display text-[24px] font-semibold text-ink">{c.pieces.names[p.key]}</h1>
        <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{c.printPage.note}</p>
        {p.pages === 'tables' && <p className="mt-1 text-[13px] text-ink-mute">{c.printPage.tables}: {pages.length}</p>}
      </div>

      <div className="print-doc brand-sheet grid gap-8 overflow-x-auto bg-surface-200 p-6">
        {pages.map((page) => (
          <div key={page} className="brand-page shadow-[0_8px_24px_rgba(0,0,0,.12)] print:shadow-none" style={{ width: `${W}mm` }}>
            <Piece kind={p.key as PieceKey} variant={variant} brand={brand} data={screen.data} c={c.on} locale={ui.locale} page={page} bleed={BLEED_MM} marks />
          </div>
        ))}
      </div>
    </>
  );
}
