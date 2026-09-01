import type { SiteCopy } from './site.ts';
import type {
  AuthCopy, PrivacyCopy, TermsCopy, A11yCopy, InstallCopy, ShopCopy, RsvpCopy,
  BudgetSimCopy, ConciergeCopy, EventKinds,
} from './ui.ts';

/**
 * The public site in English.
 *
 * Written as English rather than translated from the Hebrew. The Hebrew copy is
 * the client's own voice and it was finalised by him; a word-for-word rendering
 * of it reads like a subtitle track, which is exactly what a couple planning a
 * destination wedding is not looking for. Same claims, same order, same
 * restraint, in sentences somebody would actually write.
 *
 * The shape is `SiteCopy`, the same type the Hebrew uses, so the two cannot
 * drift: a field added to one is a compile error until it exists in the other.
 *
 * The name is Barak Liver in English and ברק ליור in Hebrew. Not a
 * transliteration of one into the other: it is how he writes it in each, and it
 * is the name on the domain and on every email this business sends.
 */
export const siteEn: SiteCopy = {
  brand: 'Barak Liver',
  tagline: 'Wedding and event production',

  hero: {
    eyebrow: 'Wedding and event production',
    headline: 'One perfect day, held together',
    name: 'Barak Liver',
    body: [
      'One evening in a lifetime, all the people dearest to you are in the same place.',
      'An evening like that deserves to be walked by somebody who knows the way.',
      'From the first meeting to the last song, we carry the plan, the budget, the suppliers and every small detail in between.',
      'You stay close to every decision that matters to you, and far from everything that weighs.',
      'And when the evening arrives, you are free to live it in full.',
    ],
    cta: 'Let us meet',
  },

  begin: {
    title: 'Where to begin',
    steps: [
      { title: 'Look at the work', body: 'The portfolio is waiting below. See whether it speaks to you.' },
      { title: 'Check the numbers', body: 'The budget calculator gives you an order of magnitude in a minute, no details asked.' },
      { title: 'Book the first meeting', body: 'Half an hour of conversation, no obligation. After it you will know whether to go on together.' },
    ],
  },

  philosophy: {
    title: 'Your wedding starts with you',
    body: [
      'Before a venue, a photographer or a look, one question comes before all the others: how would you like to remember this evening.',
      'What your guests should feel the moment they walk in.',
      'Which moments are too precious to slip past among the details.',
      'Where it is right to invest, and what is not open to compromise.',
      'Out of those answers a wedding is built that belongs to you alone.',
    ],
  },

  value: {
    title: 'When somebody is holding the whole picture',
    body: [
      'True calm is not the absence of things to do. It is the knowledge that somebody is already taking care of every one of them.',
      'At any moment you know what is being done now and what comes next.',
      'The budget is open before you, suppliers receive their answers, and decisions are made in time.',
      'The small details do not grow into a large worry in the final week.',
      'And in the evenings you talk about the wedding itself, not about its errands.',
      'One address walks beside you, from the first moment to the last.',
    ],
  },

  stage: {
    couple: 'Noa and Itai',
    days: 'days to the wedding',
    rows: ['Budget', 'Replies', 'Inspiration', 'Suppliers'],
  },

  journey: {
    title: 'How the road looks',
    steps: [
      'You leave your details',
      'We meet and get to know each other',
      'We set the budget and the direction',
      'We find and secure the venue',
      'We choose the right people around you',
      'We build and produce the wedding down to the last detail',
    ],
    link: 'See the whole process',
  },

  about: {
    title: 'Who walks beside you',
    body: [
      'Behind every production stand more than eight years and hundreds of events, from outdoor weddings to complex evenings of hundreds of guests.',
      'Those years taught us one simple thing: the pressure of the great day is not managed in the moment. It is prevented in advance.',
      'We listen to the end, check the numbers once more, and tell the truth even when it is not the comfortable answer.',
      'And when something shifts at the last minute, there is somebody at your side who has seen it all and stays calm.',
    ],
  },

  work: {
    title: 'Recent work',
    sub: 'Eight moments from one year of weddings. Behind each of them, months of quiet work.',
  },

  dayOf: {
    title: 'And on the day itself',
    body: [
      'And then the moment arrives when the planning ends and the celebration begins.',
      'The guests walk in, the music rises, and the evening you have waited for truly happens.',
      'Behind the scenes it is already known who has arrived, what was agreed, and what needs to happen in every minute.',
      'You are not meant to feel any of it. That is precisely the craft.',
      'All that is left for you is to celebrate.',
    ],
  },

  academy: {
    title: 'Would you rather plan it yourselves?',
    body: [
      'Some couples choose to hold the production in their own hands, and to do it properly.',
      'For them we built the online course: the same method we work by, stage after stage.',
      'From the budget and the venue through to suppliers, contracts and the day itself.',
      'You produce it yourselves, but you are not by yourselves.',
    ],
    cta: 'See the online course',
  },

  closing: {
    title: 'It starts with a conversation',
    body: [
      'It all begins with one conversation. Half an hour of acquaintance, no obligation.',
      'Tell us where you stand today and what wedding you see in your mind.',
      'If it feels right to walk together, we continue on that road. And if not, you leave with order and direction.',
    ],
    cta: 'Book an introductory meeting',
  },

  budget: {
    title: 'What does a wedding like this cost',
    sub: 'A few details, and within a minute you have an order of magnitude. An honest starting point, not a quote.',
    closing: 'Would you like to go over the numbers together? Book an introductory meeting, no obligation.',
  },

  lead: {
    title: 'Good to meet you',
    sub: 'Leave your details and we usually come back within one business day. A person answers, not a system.',
    fields: {
      name: 'Full name',
      phone: 'Phone',
      email: 'Email',
      kind: 'Type of event',
      date: 'Approximate date',
      guests: 'Number of guests',
      message: 'Anything we should know',
    },
    submit: 'Send',
    sending: 'Sending',
    okTitle: 'Thank you, we have it',
    okBody: 'Your details have been received. We usually come back within one business day.',
  },

  fab: {
    whatsapp: 'WhatsApp',
    booking: 'Book a meeting',
    bookingNote: 'Half an hour of acquaintance, no obligation',
    lead: 'Leave details',
    whatsappMessage: 'Hello, I came from the website and would love to hear about producing our wedding.',
  },

  nav: {
    philosophy: 'Approach',
    journey: 'Process',
    about: 'About',
    budget: 'Budget',
    shop: 'Shop',
    contact: 'Contact',
    login: 'Sign in',
  },

  footer: 'Event production. All rights reserved.',
};

/* ── The rest of the public site, in English ──────────────────────────────
   Everything a visitor can reach with the toggle on, and nothing a producer
   sees. Written as English rather than translated: the claims are identical
   and checkable against the same migrations, the sentences are ones somebody
   would write. Typed through `Wide<>` in content/ui.ts, so a key added to the
   Hebrew is a compile error here until it exists. */

export const authEn: AuthCopy = {
  title: 'Sign in to your area',
  sub: 'We will send you a one time code. No password to remember.',
  emailLabel: 'Email address',
  newHere: 'This is my first time here',
  nameLabel: 'Full name',
  brandLabel: 'Business name (producers)',
  submit: 'Send code',
  sending: 'Sending',
  note: 'Invited couples sign in with the address the invitation was sent to. A new producer goes to approval before the account opens.',
  codeTitle: 'The code is on its way',
  codeSentEmail: 'We sent a one time code to',
  codeSentPhone: 'We sent a one time code by text to',
  codeLabel: 'The code you received',
  codeSubmit: 'Sign in',
  codeChecking: 'Checking',
  codeBackEmail: 'Change address',
  codeBackPhone: 'Change number',
  validFor: 'The code is valid for another {t}',
  expired: 'The code has probably expired. You can ask for a new one.',
  resend: 'Send a new code',
  resendIn: 'You can ask for a new code in {s} seconds',
  resendSending: 'Sending a new code',
  resentEmail: 'We sent a new code to your email.',
  resentPhone: 'We sent a new code by text.',
  google: 'Sign in with Google',
  googleGoing: 'Taking you to Google',
  googleFailed: 'We could not open the Google window. You can sign in with a code below.',
  or: 'or',
  privacyNote: 'By signing in you agree to the ',
  legalJoin: ' and the ',
  signingIn: 'Signing you in',
  linkExpired: 'That link has already been used, or it expired. We will send a new code to the same address.',
  linkMissing: 'The link was incomplete. You can sign in from here.',
};

export const privacyCopyEn: PrivacyCopy = {
  title: 'Privacy policy',
  sub: 'What is collected here, why, who sees it, and how long it is kept. In plain English.',

  shortTitle: 'In short',
  short: [
    'We collect only what is needed to produce your event.',
    'Your guest list, your files and your budget are visible to you and to Barak Liver, and to nobody else.',
    'We do not sell data and we do not advertise from it.',
    'You can ask for all of it to be deleted, at any point, and it will be.',
  ],

  whoTitle: 'Who is responsible for the data',
  who:
    'Barak Liver, wedding and event production. Any privacy question can go straight to the address '
    + 'below, and we answer within a few business days.',

  whatTitle: 'What is collected, and why',
  what: [
    ['Your contact details',
     'Name, phone and email. This is what lets us get back to you, send a sign in code, and know who we are talking to.'],
    ['The event details',
     'Date, venue, expected guest count, budget and the tasks that were opened. This is the body of the work itself.'],
    ['The guest list',
     'Names, phone numbers, replies and dietary preferences, as you or your guests fill them in. '
     + 'This information is yours. We hold it in order to build seating, a run sheet and numbers for suppliers.'],
    ['Files you upload',
     'Inspiration photographs, the invitation, venue plans and anything else you send to the shared folder.'],
    ['Messages between us',
     'What is written in the conversation inside the system, so there is a record of what was agreed.'],
    ['Sign in data',
     'An email address or a phone number, and a one time code. We store no passwords, because there are none here.'],
  ],

  cookiesTitle: 'Cookies',
  cookies:
    'We use cookies for two things only: to remember that you are signed in, and to remember the '
    + 'accessibility and language settings you chose. There are no advertising cookies here, no cross '
    + 'site tracking, and no social network pixels.',

  whoSeesTitle: 'Who sees what',
  whoSees: [
    'Your area is visible to you and to Barak Liver. One couple never sees another couple’s event, '
    + 'and that is enforced in the database itself rather than only on the screen.',
    'Costs, crew pay and supplier assignments are the production side. They are not shown to the couple.',
    'A supplier who receives a signing link sees their own document only. Not the event, not the guests, not the budget.',
    'A guest filling in a reply sees their own row only.',
  ],

  thirdTitle: 'Where the data goes outside here',
  third: [
    ['Supabase', 'Stores the database and the files. The servers are in Europe.'],
    ['Resend', 'Sends the outgoing email: sign in code, invitation, notification.'],
    ['DigitalOcean', 'Hosts the server the site runs on.'],
    ['Anthropic', 'Runs the assistant on the site. Only what is written in the conversation itself is '
     + 'sent to it, without the event data attached.'],
    ['Google', 'Only if you chose to sign in with a Google account. In that case Google gives us the '
     + 'name, the email address and the profile picture, and we neither receive nor ask for anything '
     + 'else from your account.'],
  ],
  thirdNote:
    'We do not sell data, we do not rent it, and we do not pass it to advertisers. The list above is '
    + 'the complete list.',

  keepTitle: 'How long it is kept',
  keep:
    'Event data is kept while the event is active and for seven years afterwards, because invoices and '
    + 'contracts carry a statutory retention duty. An enquiry that never became an event is deleted '
    + 'within two years. You can ask for anything not under a retention duty to be deleted sooner, and '
    + 'we will do it.',

  rightsTitle: 'Your rights',
  rights: [
    'To know what is held about you and to receive a copy.',
    'To correct a detail that is wrong.',
    'To ask for deletion of anything not under a statutory retention duty.',
    'To ask us to stop sending email that is not directly about your event.',
  ],
  rightsHow:
    'Any such request is handled by one message to the address below. There is no form, no process, and '
    + 'no need to explain why.',

  securityTitle: 'How it is kept safe',
  security: [
    'The connection to the site is encrypted.',
    'Every table in the database carries its own access rule, so reaching somebody else’s data is '
    + 'blocked in the data layer and not only on the screen.',
    'Files you upload sit in private storage and open only through a signed, short lived link.',
    'A one time sign in code is valid briefly and for one use.',
  ],

  kidsTitle: 'Minors',
  kids:
    'The service is intended for adults. We do not knowingly collect data about children. If such data '
    + 'reached us through a guest list, it is treated like the rest of the guest list and deleted with it.',

  changesTitle: 'Changes to this policy',
  changes:
    'If we change something material, we will update the date below and tell everybody with an active '
    + 'event. We do not change the policy retroactively.',

  contactTitle: 'Privacy contact',
  contact: 'A question, a deletion request, or something that is not clear. Write to us.',
  updated: 'Last updated',
  back: 'Back to the home page',
};

export const termsCopyEn: TermsCopy = {
  title: 'Terms of use',
  sub: 'What is allowed here, what we commit to, and what we do not. In plain English.',

  shortTitle: 'In short',
  short: [
    'The site and your personal area are working tools. The agreement about the production itself is signed separately, and that is the one that governs.',
    'What you upload stays yours. We only hold it for you.',
    'Photographs from your event do not reach the portfolio unless you said yes.',
    'An order in the shop is a request, not a charge. No card is taken here.',
  ],

  whoTitle: 'Who operates the service',
  who:
    'Barak Liver, wedding and event production. The site, the personal area and the shop are operated '
    + 'by him. Anything about these terms reaches the address below.',

  scopeTitle: 'What the service includes',
  scope: [
    ['The site', 'A public page, a budget calculator, an enquiry form and a shop. Open to anybody, without signing up.'],
    ['Your personal area',
     'Opened for a couple with an active event. Inside it: the budget, the tasks, the guest list, the '
     + 'replies, the run sheet, the files and the conversation with the production.'],
    ['The shop', 'Products and services that can be requested through the site. Details below.'],
    ['The production itself',
     'The work we carry out. It is set by the agreement signed between the parties and not by this page.'],
  ],

  contractTitle: 'The production agreement governs',
  contract:
    'If anything here conflicts with the signed production agreement, the agreement governs. This page '
    + 'covers the use of the site and the personal area only, and it does not change, narrow or add '
    + 'anything to what was agreed in writing about the event.',

  accountTitle: 'Signing in',
  account: [
    'Sign in is by a one time code sent to your email, or through a Google account. There are no passwords here.',
    'The code is personal. Whoever has access to your inbox has access to your area, so it is worth protecting.',
    'Administrator rights belong to the business owner. An account that opens on its own waits for approval and sees nothing until then.',
    'If you think somebody else has been in your area, write to us and we will block access immediately.',
  ],

  useTitle: 'Fair use',
  useIntro: 'The things you may not do here are short and obvious:',
  use: [
    'Do not try to reach somebody else’s area, and do not look for ways around the permissions.',
    'Do not upload files carrying malware, and do not deliberately overload the service.',
    'Do not upload content you have no right to upload, and no abusive content.',
    'Do not scrape the site automatically and do not copy content from it for commercial use.',
  ],
  useNote:
    'An account doing this will be blocked. If it was a mistake, write to us and we will look. We '
    + 'prefer to talk before we block, where that is possible.',

  contentTitle: 'The content you upload',
  content: [
    'The files, the guest list and the text you upload stay yours. We do not become their owner.',
    'We receive one narrow permission: to hold the material, show it to you and to the production, and use it '
    + 'to produce the event. Nothing beyond that.',
    'You are responsible for having the right to upload what you uploaded. If you uploaded a '
    + 'photographer’s image, the agreement with the photographer is yours.',
    'A request to delete a file is carried out. What is deleted is not kept aside by us.',
  ],

  photosTitle: 'Photographs from your event',
  photos:
    'Photographs from your event enter the portfolio, social media or any other publication only after '
    + 'you approved it. One approval does not become an approval forever: you can withdraw it at any '
    + 'point, and we will take the photographs down from everywhere we control.',

  shopTitle: 'The shop',
  shop: [
    'Prices are in new shekels. A price shown in error is not binding, and if that happens we will tell '
    + 'you before any further step.',
    'An order sent from the shop is a request that reaches us, not a purchase. No payment method is '
    + 'given here and no card is charged.',
    'The deal closes in conversation, and a mutual commitment is created only once the terms and the '
    + 'payment are agreed by both sides.',
    'Until that point a request can be cancelled in one message, without a reason and at no cost.',
    'Once a deal has closed, cancellation follows what was agreed in it and the rights consumer law gives you.',
  ],

  availabilityTitle: 'Availability',
  availability:
    'We do what we can to keep the system available, and still: this is software running on servers. '
    + 'There will be maintenance windows and there can be faults. We do not promise uninterrupted '
    + 'availability, and we do promise to deal with a fault quickly and never to leave you without an answer.',

  dataTitle: 'Your data does not disappear in an update',
  data:
    'A version update deletes nobody’s data. That is an iron rule of this system, and it is checked '
    + 'before every release. If something did happen anyway, there is a backup and we restore it.',

  liabilityTitle: 'Liability',
  liability: [
    'Liability for the production itself is set by the production agreement.',
    'As for the site and the personal area: they are provided as they are. We are not liable for '
    + 'indirect damage caused by a technical fault, by a lost connection, or by use that does not follow these terms.',
    'We are liable for what we do negligently, and that is not something a web page can sign away.',
    'Links to other people’s services, such as an external booking calendar, are governed by the terms of those services.',
  ],

  endTitle: 'Ending',
  end:
    'You can ask to close an account at any point. We will close it and delete whatever is not under a '
    + 'statutory retention duty, exactly as the privacy policy says. If the event has already happened, '
    + 'the agreement about it continues to apply to whatever is still open in it.',

  changesTitle: 'Changes to these terms',
  changes:
    'If we change something material, we will update the date below and tell everybody with an active '
    + 'event. A change does not apply retroactively to something already agreed.',

  lawTitle: 'Governing law',
  law: 'These terms are governed by Israeli law, and jurisdiction lies with the competent courts in Israel.',

  contactTitle: 'Contact',
  contact: 'A question about the terms, or something that is not clear. Write to us and we will answer.',
  privacyLink: 'The privacy policy sits alongside this page and explains what is collected and who sees what.',
  updated: 'Last updated',
  back: 'Back to the home page',
};

export const a11yCopyEn: A11yCopy = {
  open: 'Accessibility menu',
  title: 'Accessibility settings',
  sub: 'Adjust the display to suit you. The settings apply on every screen and are kept in this browser.',
  font: 'Larger text',
  smaller: 'Smaller text',
  bigger: 'Larger text',
  contrast: 'High contrast',
  links: 'Emphasise links',
  readable: 'Wider spacing for reading',
  motion: 'Stop animation',
  cursor: 'Large cursor',
  reset: 'Reset settings',
  resetOk: 'Settings have been reset.',
  on: 'On',
  off: 'Off',
  close: 'Close',
  statement: 'Accessibility statement',
  statementBody:
    'This site is built to the Israeli standard IS 5568 and to WCAG 2.1 level AA: full keyboard '
    + 'navigation, screen reader support, compliant contrast, alternative text for images and personal '
    + 'adjustment. Ran into an accessibility problem? Write to us and we will fix it.',
  statementMore: 'Read the full accessibility statement',
  page: {
    title: 'Accessibility statement',
    sub: 'What was done here to make the site usable by everybody, and how to reach us if something does not work.',
    standardTitle: 'The standard this site is built to',
    standard: 'This site is built to the Israeli standard IS 5568 and to WCAG 2.1 level AA.',
    doneTitle: 'What the site has',
    done: [
      'Full keyboard navigation, including a skip link to the main content.',
      'Screen reader support: a sound heading structure, a label on every field, and alternative text on every image.',
      'Colour contrast measured rather than estimated. Every text and background pairing on the site is checked automatically against the WCAG threshold.',
      'A personal adjustment menu: larger text, high contrast, emphasised links, a readable spaced typeface, stopped animation and a large cursor.',
      'The settings are kept in the browser and continue to apply on every visit.',
      'The site respects the operating system setting for reduced motion.',
    ],
    limitsTitle: 'Known limitations',
    limits:
      'Files uploaded by users, such as photographs a couple adds to the inspiration folder, are not '
      + 'under our control and may arrive without alternative text.',
    contactTitle: 'Accessibility contact',
    contact: 'Ran into something that does not work, or have a suggestion? We would like to hear it and we will fix it.',
    updated: 'Last updated',
    back: 'Back to the home page',
  },
};

export const installCopyEn: InstallCopy = {
  title: 'Install it on your phone',
  sub: 'Your area opens like an ordinary app, with an icon on the home screen. There is nothing to download from a store, and it takes under a minute.',
  why: 'Why it is worth it',
  whyLines: [
    'Opens full screen, without the browser address bar.',
    'An icon on the home screen, like any other app.',
    'You stay signed in, without signing in again every time.',
  ],
  iphone: 'iPhone',
  iphoneSteps: [
    'Open the site in Safari. It has to be Safari and not Chrome.',
    'Press the share button at the bottom centre, the square with the arrow pointing up.',
    'Scroll and choose "Add to Home Screen".',
    'Press "Add" at the top right.',
  ],
  android: 'Android',
  androidSteps: [
    'Open the site in Chrome.',
    'Press the three dots at the top right.',
    'Choose "Add to Home screen" or "Install app".',
    'Confirm.',
  ],
  desktop: 'Computer',
  desktopSteps: [
    'In Chrome or Edge there is an install icon at the end of the address bar.',
    'Press it and confirm.',
  ],
  troubleTitle: 'Cannot find the option?',
  troubleLines: [
    'On an iPhone this works in Safari only. If you opened the link in Chrome or from inside Instagram, open it in Safari first.',
    'If you installed it once already, the option will not appear again. Look for the icon on your home screen.',
  ],
  backToApp: 'To my area',
};

export const storeCopyEn: ShopCopy = {
  shopTitle: 'What you can order',
  shopSub: 'Choose, leave your details, and we will come back to close it.',
  shopEmpty: 'The shop is empty right now. Talk to us and we will put an offer together.',
  addToCart: 'Add',
  cart: 'My basket',
  qty: 'Quantity',
  clear: 'Empty the basket',
  checkout: 'Send order',
  sending: 'Sending',
  cancel: 'Cancel',
  total: 'Total',
  kindProduct: 'Product',
  kindService: 'Service',
  buyerName: 'Full name',
  buyerPhone: 'Phone',
  buyerEmail: 'Email',
  buyerNote: 'Note',
  buyerNotePh: 'Event date, a question, anything',
  payLater: 'No card is charged. Send the order and we will come back to settle payment and a date.',
  thanksTitle: 'Order received',
  thanks: 'We saved the order and we will get back to you. Your order number is:',
  again: 'Another order',
  failed: 'We could not send the order. Please try again.',
};

export const rsvpCopyEn: RsvpCopy = {
  eyebrow: 'Reply',
  hello: 'Hello',
  invitedTo: 'You are invited to',
  question: 'Are you coming?',
  yes: 'Yes, we will be there',
  no: 'We cannot make it',
  howMany: 'How many of you will there be',
  howManyHint: 'Including you.',
  diet: 'Food preference',
  note: 'Anything we should know',
  notePh: 'An allergy, a high chair, anything',
  submit: 'Send your answer',
  sending: 'Sending',
  already: 'You have answered already. You can change your answer here.',
  okComing: 'Wonderful, see you there!',
  okComingBody: 'You are on the list. We look forward to seeing you.',
  okNotComing: 'Thank you for letting us know',
  okNotComingBody: 'A shame you cannot make it. Thank you for telling us.',
  changeLater: 'If anything changes, come back to this link and update it.',
  badLink: 'That link was not found',
  badLinkBody: 'The link may have been copied only in part, or the invitation is no longer valid. You can contact the couple.',
};

export const budgetSimCopyEn: BudgetSimCopy = {
  note:
    'Every number here is an estimate and none of it is exact. It is meant to give you an order of '
    + 'magnitude to start from, and it moves with the suppliers, the venue and the season. The real '
    + 'price is set only against quotes.',
  invited: 'How many invitations are you sending',
  attending: 'How many of them actually come',
  attendingHint: 'Catering is counted on the people who come, not the people invited.',
  tierLabel: 'Kind of venue',
  plate: 'Price per plate',
  plateHint: 'Have a quote already? Type the number you were given and the estimate follows it.',
  dayLabel: 'Day of the week',
  seasonLabel: 'Season',
  styleLabel: 'Style',
  barLabel: 'Alcohol',
  rangeLabel: 'Estimated budget range',
  to: 'to',
  attendingCount: 'Actually attending',
  tables: 'Tables',
  perGuest: 'Per guest',
  breakdown: 'Breakdown by item',
  marginal: 'Every ten more guests',
  tier: { garden: 'Garden venue', hall: 'Banquet hall', boutique: 'Boutique venue', field: 'Open field' },
  day: { weekday: 'Midweek', friday: 'Friday', saturday: 'Saturday' },
  season: { spring: 'Spring or autumn', summer: 'Summer', winter: 'Winter' },
  style: { classic: 'Classic', modern: 'Modern', rustic: 'Rustic', lux: 'Luxury' },
  bar: { venue: 'Included by the venue', external: 'External bar', none: 'No bar' },
  scale: { guest: 'per guest', table: 'per table', fixed: 'fixed' },
  line: {
    catering: 'Venue and catering',
    bar: 'Bar and alcohol',
    center: 'Table design',
    photo: 'Photography and video',
    music: 'Music and sound',
    design: 'Chuppah and design',
    prod: 'Planning and production',
    extra: 'Invitations, hair and makeup, extras',
  },
};

export const EVENT_KINDS_EN: EventKinds = [
  { value: 'wedding',   label: 'Wedding' },
  { value: 'corporate', label: 'Corporate event' },
];

export const conciergeCopyEn: ConciergeCopy = {
  title: 'Questions about the production',
  sub: 'Our digital assistant',
  open: 'Start a conversation',
  close: 'Close',
  greeting: 'Ask me how the process works, what a production includes, and what happens on the day itself. '
    + 'If you would like us to get back to you, leave me a name and a phone number.',
  starters: ['How does the process work?', 'What does a production include?', 'We want an outdoor wedding'],
  placeholder: 'What would you like to know',
  send: 'Send',
  thinking: 'One moment',
  wentWrong: 'Something jammed on my side. You can write to us on WhatsApp and we will get back to you.',
  disclaimer: 'General answers. Price and availability are settled at the meeting.',
};
