import type { Locale } from '@/lib/locale';
import type { PrepViewCopy } from '@/components/PrepView';

/**
 * The words on the page a supplier's link opens.
 *
 * Bilingual, and not for the same reason the couple's area is. A photographer
 * in Israel reads Hebrew; a couple who set this product to English will send
 * the link to somebody who reads what they read. The page follows the language
 * of whoever opens it, which is the only signal it has.
 *
 * Nothing here names the platform. The supplier is looking at a wedding that
 * belongs to a production business, and the footer says whose.
 */
type Copy = PrepViewCopy & { gone: string; goneSub: string; dateTbd: string };

const HE: Copy = {
  faces: 'מי אסור לפספס',
  looks: 'השראה',
  categories: { hair: 'שיער', makeup: 'איפור', outfit: 'לבוש', other: 'שונות' },
  by: 'מאת',
  onlyFaces: 'הקישור הזה פותח את רשימת האנשים בלבד.',
  onlyLooks: 'הקישור הזה פותח את תמונות ההשראה בלבד.',
  /* One sentence for a token that never existed, one that was revoked and one
     that expired. Three different answers would be three things to learn by
     guessing. */
  gone: 'הקישור הזה כבר לא פעיל',
  goneSub: 'אפשר לבקש קישור חדש ממי ששלח לכם אותו.',
  dateTbd: 'התאריך טרם נקבע',
};

const EN: Copy = {
  faces: 'Who not to miss',
  looks: 'References',
  categories: { hair: 'Hair', makeup: 'Makeup', outfit: 'Outfit', other: 'Other' },
  by: 'From',
  onlyFaces: 'This link opens the list of people only.',
  onlyLooks: 'This link opens the references only.',
  gone: 'This link is no longer active',
  goneSub: 'Ask whoever sent it to you for a new one.',
  dateTbd: 'The date is not set yet',
};

export const prepViewFor = (l: Locale): Copy => (l === 'en' ? EN : HE);
