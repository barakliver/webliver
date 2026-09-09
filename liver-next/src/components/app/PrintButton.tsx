'use client';

import { Printer } from 'lucide-react';

/** Opens the browser's print dialog, which is also where "save as PDF" lives
 *  on every desktop and both mobile platforms. One button, two outcomes,
 *  neither of which needs a megabyte of font shipped to get Hebrew right. */
export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary inline-flex items-center gap-2">
      <Printer size={17} aria-hidden strokeWidth={1.75} />
      {label}
    </button>
  );
}
