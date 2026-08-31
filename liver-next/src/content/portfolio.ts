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

/** The same eight photographs described in English. A caption and an alt text
 *  are read, so leaving them Hebrew on the English site meant a screen reader
 *  announcing Hebrew to somebody who asked for English. */
export type Shots = readonly Shot[];

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

export const portfolioEn: Shot[] = [
  { slug: 'chuppah-105',         caption: 'The chuppah at golden hour',   alt: 'A chuppah lit by the setting sun, guests seated on both sides of the aisle' },
  { slug: 'yhp-y-aceremony994',  caption: 'The bride and groom',          alt: 'A bride and groom standing together under the chuppah at the end of the ceremony' },
  { slug: 'dsc-8047',            caption: 'A chuppah dressed in white flowers', alt: 'A chuppah frame covered in white flowers against greenery' },
  { slug: 't-s-301024-1239',     caption: 'The bride walks in',           alt: 'The bride walking down the aisle between rows of guests' },
  { slug: 'chuppah-50',          caption: 'A moment under the chuppah',   alt: 'The couple standing facing each other under the chuppah during the ceremony' },
  { slug: 't-s-301024-1291',     caption: 'The first dance',              alt: 'The couple dancing in the middle of a floor surrounded by guests' },
  { slug: 'yhp-y-aceremony1063', caption: 'The moment itself',            alt: 'The ring going on during the chuppah ceremony' },
  { slug: 'venue-9',             caption: 'The room, set and waiting',    alt: 'An event hall laid with set tables before the guests arrive' },
];

/** The source files are 1400x933, so every crop below keeps 3:2. */
export const SHOT_RATIO = '3 / 2';
