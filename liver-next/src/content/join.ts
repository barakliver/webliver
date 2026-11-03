/**
 * What a visitor reads when they scan a conference code.
 *
 * Two tick boxes with two different wordings on purpose: accepting the terms
 * is the price of coming in, and being written to is a favour they may decline
 * and must not find already ticked. The English sits beside it in
 * `join.en.ts`, checked against this shape key for key.
 */
export const joinCopy = {
  eyebrow: 'כניסה',
  hello: 'ברוכים הבאים',
  forKind: {
    producer: 'מערכת לניהול הפקות אירועים: לקוחות, הצעות מחיר, חוזים ויום האירוע במקום אחד.',
    dj: 'מערכת לניהול לקוחות ל-DJ: פניות, הצעות מחיר, חוזים ותכנית הערב במקום אחד.',
  },
  google: 'המשך עם Google',
  googleNote: 'השם והמייל יתמלאו לבד. נשאר רק הטלפון.',
  or: 'או השאירו פרטים',
  name: 'שם מלא',
  phone: 'טלפון',
  email: 'מייל',
  emailFixed: 'המייל של חשבון Google שלכם',
  termsLead: 'קראתי ואני מאשר/ת את',
  termsLink: 'תנאי השימוש',
  termsAnd: 'ואת',
  privacyLink: 'מדיניות הפרטיות',
  list: 'אשמח לקבל עדכונים, חדשות והטבות במייל ובוואטסאפ',
  listHint: 'לא חובה. אפשר להסיר בלחיצה אחת בכל הודעה.',
  submit: 'שליחה',
  enter: 'כניסה למערכת',
  sending: 'שולח',
  problems: {
    name: 'נא למלא שם מלא.',
    phone: 'נא למלא מספר טלפון.',
    email: 'כתובת המייל לא נראית תקינה.',
    terms: 'כדי להמשיך צריך לאשר את תנאי השימוש.',
  },
  failed: 'משהו השתבש ולא שמרנו. אפשר לנסות שוב.',
  badLink: 'הקישור הזה כבר לא פעיל',
  badLinkBody: 'ייתכן שהכנס הסתיים או שהכתובת לא הועתקה עד הסוף. אפשר לפנות אלינו ונשלח קישור חדש.',
  thanksTitle: 'תודה, קיבלנו',
  thanksBody: 'הפרטים נשמרו. נשמח להיות בקשר.',
  thanksCta: 'רוצים להיכנס למערכת ולנסות? המשיכו עם Google.',
  already: 'אתם כבר בפנים.',
  recorded: 'הפרטים נשמרו.',
} as const;
