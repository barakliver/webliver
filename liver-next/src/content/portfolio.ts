/** The eight photographs from the business's own client work.
 *
 *  They were base64 blobs inside the single file HTML, which meant no
 *  compression, no lazy loading, no responsive sizes and no caching: 1.35MB
 *  the browser had to parse before it painted anything. Here they are real
 *  files served at two widths, so a phone downloads the 700px version and a
 *  desktop the 1400px one.
 *
 *  Captions are the ones already written for the live site, not new ones. */

export type Shot = {
  slug: string;
  /** Written to be read aloud by a screen reader, not to repeat the caption. */
  alt: string;
  caption: string;
};

export const portfolio: Shot[] = [
  { slug: 'chuppah-105',         caption: 'חופה בשעת הזהב',          alt: 'חופה מעוצבת באור שקיעה, אורחים יושבים משני צדי המעבר' },
  { slug: 'yhp-y-aceremony994',  caption: 'הכלה והחתן',              alt: 'כלה וחתן עומדים יחד תחת החופה בסיום הטקס' },
  { slug: 'dsc-8047',            caption: 'עיצוב חופה בפרחים לבנים', alt: 'מבנה חופה עטור פרחים לבנים על רקע צמחייה' },
  { slug: 't-s-301024-1239',     caption: 'כניסת הכלה',              alt: 'הכלה נכנסת במעבר בין שורות האורחים' },
  { slug: 'chuppah-50',          caption: 'רגע מתחת לחופה',          alt: 'בני הזוג ניצבים זה מול זה תחת החופה במהלך הטקס' },
  { slug: 't-s-301024-1291',     caption: 'הריקוד הראשון',           alt: 'בני הזוג רוקדים במרכז רחבה מוקפת אורחים' },
  { slug: 'yhp-y-aceremony1063', caption: 'רגע הנישואין',            alt: 'רגע ענידת הטבעת בטקס החופה' },
  { slug: 'venue-9',             caption: 'המקום ערוך ומוכן',        alt: 'אולם אירועים ערוך בשולחנות מסודרים לפני הגעת האורחים' },
];

/** The source files are 1400x933, so every crop below keeps 3:2. */
export const SHOT_RATIO = '3 / 2';
