import type { GuideBook, GuideUi } from './guide';

/**
 * The couple's operating book, in English.
 *
 * Only the couple's half is translated: the personal area speaks both
 * languages, so its book must too. The producer's console is Hebrew, and a
 * translated book for an untranslated console would name screens that do not
 * exist in the reader's language.
 *
 * Same type as the Hebrew, so a chapter added to one is a compile error until
 * it exists in the other.
 */

export const guideUiEn: GuideUi = {
  pageTitle: 'The handbook',
  pageSub: 'How to work the system, step by step. Read it in order, or search for a question.',
  search: 'Search the handbook',
  searchPh: 'What did you want to do? For example: add a guest',
  clear: 'Clear search',
  results: '{n} answers',
  resultsOne: 'One answer',
  noResults: 'No answer for that here. Ask the assistant, or write to us and we will answer.',
  askTitle: 'Did not find it?',
  askBody: 'The digital assistant in the corner of the screen knows this handbook and can point the way. Ask it exactly as you would ask a person.',
  coupleBookNote: 'This is the handbook your couples see in their personal area.',
};

export const clientGuideEn: GuideBook = {
  title: 'Your personal area, explained',
  sub: 'What lives here, how to begin, and what to do when a question comes up.',

  start: {
    title: 'First steps',
    sub: 'Five steps, and you are home.',
    steps: [
      {
        title: 'Sign in with the address you were invited on',
        body: 'You sign in with the email address the invitation was sent to, and a one-time code that arrives there. There is no password to remember.',
      },
      {
        title: 'Install it on your phone',
        body: 'The install page explains how, in under a minute. It opens like a regular app, with an icon on your home screen, and nothing to download from a store.',
      },
      {
        title: 'Go through your tasks',
        body: 'The task list shows what is waiting on your decision and what is already settled. Whatever is marked as yours really is yours.',
      },
      {
        title: 'Fill in what only you know',
        body: 'The songs you want, who walks with you, and what matters to you. It sits on your page, waiting for your words.',
      },
      {
        title: 'When a question comes up, write to us',
        body: 'The messages at the foot of the page go straight to the production. And for an urgent moment, the floating call button is always there.',
      },
    ],
  },

  chapters: [
    {
      id: 'enter',
      title: 'Signing in and installing',
      sub: 'The door, and how to put it in your pocket.',
      entries: [
        {
          q: 'How do I sign in?',
          steps: [
            'Open the sign-in screen and enter the email address the invitation arrived at.',
            'A one-time code is sent to that address. Type it in, and you are in.',
          ],
          note: 'There is no password. The address is the key, so always use the same address you were invited on.',
        },
        {
          q: 'I signed in and I cannot see our event. What happened?',
          steps: [
            'It is almost always a different address. Check which address you signed in with, it is shown on the page.',
            'If you used Google sign-in, make sure it is the account of the invited address.',
            'Still nothing? Write to us and we will sort it out.',
          ],
        },
        {
          q: 'How do I install it on my phone?',
          steps: [
            'Open the install page, the invitation email links to it.',
            'Follow the three steps for your phone. There is nothing to download from a store.',
          ],
        },
        {
          q: 'How do I switch language?',
          steps: [
            'There is a language button at the top of the site. The choice is remembered, and your personal area follows it.',
          ],
        },
      ],
    },
    {
      id: 'around',
      title: 'What lives here',
      sub: 'A short tour, top to bottom.',
      entries: [
        {
          q: 'What should I see when I open it?',
          steps: [
            'At the top: how many days are left, and the numbers that matter at a glance.',
            'Tasks: what is waiting on you and what is done.',
            'Payments: what was paid and what is coming up.',
            'The inspiration board: the pictures you are collecting.',
            'Guests and seating: the list, the replies, and the tables.',
            'The day’s schedule, the contracts, the files, and the messages between us.',
          ],
          note: 'Anything that does not appear simply is not open on your event. Ask, and it opens.',
        },
      ],
    },
    {
      id: 'do',
      title: 'The everyday actions',
      sub: 'The things you will do here again and again.',
      entries: [
        {
          q: 'How do we keep the photographs in order?',
          steps: [
            'Before uploading, pick a word: venue, design, inspiration or suppliers. Everything you add now carries it.',
            'In the grid, the strip of words at the top filters. Tapping a picture opens it large, and the arrows walk through the set.',
            'Manage opens a word picker beside each picture, and a remove button on the ones you added.',
          ],
        },
        {
          q: 'How do I mark a task as done?',
          steps: [
            'In the task list, tick the box beside the task.',
            'The production sees it immediately. No separate message needed.',
          ],
        },
        {
          q: 'How do I add a picture to the inspiration board?',
          steps: [
            'On the board, choose a picture from your phone and upload it.',
            'The board is shared: what you add, the production sees, and the other way round.',
          ],
        },
        {
          q: 'How do I add guests and collect replies?',
          steps: [
            'In the guest list, add a name, a phone number and how many are coming together.',
            'Every guest has a personal reply link. Copy it and send it to them, and they answer on their own.',
            'The answers update in the list by themselves.',
          ],
        },
        {
          q: 'How do I send every guest one link?',
          steps: [
            'Once the production switches on the guests\' page, a card with the link for your guests appears in your area.',
            'Copy it and send it on WhatsApp to everyone invited, groups included.',
            'Each guest opens it, sees when and where, and replies using the phone number they were invited with.',
          ],
          note: 'For a guest to be found, their phone number has to be on the guest list.',
        },
        {
          q: 'How do I upload a file?',
          steps: [
            'In the files area, upload anything that belongs to the event: the invitation, lists, documents.',
            'Files are visible to you and to the production only.',
          ],
        },
        {
          q: 'How do I write to the production?',
          steps: [
            'In the messages at the foot of the page, write as you would in any chat.',
            'What is written stays there. Decisions do not get lost between phone calls.',
          ],
        },
        {
          q: 'Where do I see what has been signed?',
          steps: [
            'The contracts area shows every document: signed, or waiting and with whom.',
          ],
        },
      ],
    },
    {
      id: 'help',
      title: 'When you need help',
      sub: 'Two floating buttons, and a person behind them.',
      entries: [
        {
          q: 'How do I reach the producer right now?',
          steps: [
            'The floating phone button opens the ways in: a call, WhatsApp, or booking a meeting.',
          ],
        },
        {
          q: 'Something on the screen is not working. What do I do?',
          steps: [
            'The second floating button, with the triangle, opens a short report.',
            'Pick a topic, write a sentence, and send. It reaches us directly.',
          ],
        },
      ],
    },
  ],
};
