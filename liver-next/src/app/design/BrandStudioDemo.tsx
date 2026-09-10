'use client';

import { BrandStudio } from '@/components/app/BrandStudio';
import { pieceDataFor } from '@/lib/brandData';
import type { WeddingBrand } from '@/content/brandKit';

/** The studio with a sheet already read, from both sides, so the palette,
 *  the type and the fourteen mockups can be looked at. Nothing here reaches
 *  a database or the model. */
const SAMPLE: WeddingBrand = {
  palette: [
    { role: 'primary', hex: '#2F4A3E', name: 'ירוק עמוק' },
    { role: 'secondary', hex: '#D9C3A5', name: 'חול' },
    { role: 'accent', hex: '#B08D57', name: 'זהב עמום' },
    { role: 'light', hex: '#FAF6EF', name: 'שנהב' },
    { role: 'dark', hex: '#1F1B17', name: 'פחם חם' },
  ],
  fonts: 'bellefair-rubik',
  words: ['גן', 'רך', 'מדויק'],
  motifs: ['זכוכית מחורצת', 'עלי זית', 'שולי נייר קרועים'],
  voice: 'מדבר בשקט ובביטחון, כמו הזמנה שנכתבה ביד. פחות מילים, יותר אוויר.',
  direction: 'שתי תמונות משכו לניאון ורוד, השאר ללוח של גן בשעת ערב. הגן חזק יותר: הוא מופיע בתשע מתוך אחת עשרה תמונות, והורוד היה תמיד פרט ולא רקע. הכיוון: ירוק עמוק על שנהב, זהב עמום רק לקווים.',
  lean: 'safe',
  leanReason: 'הלוח כולו אוויר ואור יום; הגרסה השקטה היא הלוח, הנועזת היא ערב.',
  picks: { welcome: 'bold' },
  texts: {
    story: 'נפגשנו בטיול של יום שישי בגליל, כשנועה שאלה אם אפשר להצטרף לשולחן. איתי אמר כן. מאז לא קמנו.',
    travel: 'חנייה חינם במגרש של האחוזה. הסעות מתל אביב ב-18:00 מרחבת הבימה.',
    registry: 'אפשר להעביר דרך אתר האורחים, או במעטפה בכניסה.',
    menu: 'סלט עגבניות שרופות ולבנה\nקרפצ׳יו סלק עם פיסטוק\nדג ים על גחלים\nאנטריקוט על עצם\nמלבי ורדים',
  },
  inputs: { words: 'גן, רך, מדויק', reference: 'Aesop', colorsIn: 'ירוק עמוק', colorsOut: 'ורוד בייבי' },
  by: 'ai',
  at: '2026-09-10T08:00:00.000Z',
};

const data = pieceDataFor({
  displayName: 'נועה ואיתי',
  eventDate: '2026-12-05',
  venue: 'אחוזת הכפר, גליל',
  moments: [
    { at_time: '19:00', title: 'קבלת פנים', key_moment: true },
    { at_time: '20:00', title: 'חופה', key_moment: true },
    { at_time: '21:00', title: 'ארוחה', key_moment: true },
    { at_time: '22:30', title: 'ריקודים', key_moment: true },
  ],
  tables: [{ name: '1' }, { name: '2' }, { name: '3' }],
  siteUrl: 'https://liverproductions.com/w/0123456789abcdef0123456789abcdef',
  locale: 'he',
  dateTbd: 'התאריך ייקבע',
});

export function BrandStudioDemo({ viewer }: { viewer: 'producer' | 'client' }) {
  return (
    <BrandStudio
      clientId="00000000-0000-4000-8000-000000000003"
      viewer={viewer}
      brand={SAMPLE}
      images={[]}
      data={data}
      canAi={viewer === 'producer'}
      printBase="/app/clients/00000000-0000-4000-8000-000000000003/print"
      siteUrl={data.siteUrl}
      demo
    />
  );
}
