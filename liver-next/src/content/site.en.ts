import type { SiteCopy } from './site.ts';

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
 * The name stays as it is written. A producer's name is not translated.
 */
export const siteEn: SiteCopy = {
  brand: 'Barak Lior',
  tagline: 'Wedding and event production',

  hero: {
    eyebrow: 'Wedding and event production',
    headline: 'One perfect day, held together',
    name: 'Barak Lior',
    body: [
      'You already know the wedding you want.',
      'What you need is somebody who knows how to get you there.',
      'From the first meeting to the last song, Barak holds the plan, the budget, the suppliers and every detail in between.',
      'You stay close to every decision that matters to you.',
      'Without carrying the whole wedding on your shoulders.',
    ],
    cta: 'Let us meet',
  },

  philosophy: {
    title: 'Your wedding starts with you',
    body: [
      'Before a venue, a photographer or a look, we work out what matters to you.',
      'How you want the evening to feel.',
      'Who your people are.',
      'Where it is worth spending.',
      'And what you are not willing to compromise on.',
      'A wedding that fits you is built from there, in feeling and in budget alike.',
    ],
  },

  value: {
    title: 'When somebody is holding the whole picture',
    body: [
      'You know what is happening now and what comes next.',
      'The budget is in front of you.',
      'Suppliers get answers.',
      'Decisions are made in time.',
      'And small things do not become a large problem the week before the wedding.',
      'You have one address for the whole of it.',
    ],
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
    title: 'The person walking with you',
    body: [
      'With more than eight years producing hundreds of luxury events, outdoor weddings and complex productions, Barak Lior brings a rare combination to a wedding: command, strategy, a calm room, and a conversation at eye level.',
      'Somebody who knows when to listen, when to check the numbers again, and when to say that something is not right for you.',
      'Because in the end you need to feel that the person beside you is one you trust.',
    ],
  },

  work: {
    title: 'Recent work',
    sub: 'Eight moments from events produced over the past year.',
  },

  dayOf: {
    title: 'And on the day itself',
    body: [
      'The moment arrives when the planning stops.',
      'Your people walk in.',
      'The music starts.',
      'And the wedding you have been waiting for happens.',
      'Behind it Barak already knows who is arriving, when, what was agreed and what needs to happen at every moment.',
      'You are free to be at your own wedding.',
    ],
  },

  academy: {
    title: 'Would you rather plan it yourselves?',
    body: [
      'Some couples want to hold the production in their own hands.',
      'Barak built the online course for them.',
      'An ordered process for planning a wedding, with the knowledge, the tools and the stages a producer works to.',
      'From the budget and the venue through to suppliers, contracts and the day itself.',
    ],
    cta: 'See the online course',
  },

  closing: {
    title: 'It starts with a conversation',
    body: [
      'Tell Barak where you are today and what wedding you want.',
      'This is where a whole process turns simple, precise and calm.',
      'And where you find out whether it is right to walk it together.',
    ],
    cta: 'Book an introductory meeting',
  },

  budget: {
    title: 'What does a wedding like this cost',
    sub: 'Enter a few details for an opening breakdown. A starting point, not a quote.',
    closing: 'Want Barak to go through the numbers with you? Book an introductory meeting',
  },

  lead: {
    title: 'Good to meet you',
    sub: 'Leave your details and Barak usually comes back within one business day.',
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
    okBody: 'Your details reached Barak and he will be in touch shortly.',
  },

  fab: {
    whatsapp: 'WhatsApp',
    booking: 'Introductory meeting',
    bookingNote: 'Half an hour in Barak’s diary',
    lead: 'Leave your details',
    whatsappMessage: 'Hi Barak, I came from the website and would love to hear about producing our wedding.',
  },

  nav: {
    philosophy: 'Approach',
    journey: 'Process',
    about: 'About Barak',
    budget: 'Budget',
    contact: 'Contact',
    login: 'Sign in',
  },

  footer: 'Event production. All rights reserved.',
};
