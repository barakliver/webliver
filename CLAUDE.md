# Working with Barak

## Every code block says where it runs. No exceptions.

Barak runs commands in three different places and they are not interchangeable.
Most of the friction in this project has come from a block of text arriving with
no label on it: a connection string pasted at a shell prompt, a line of a
script's own output pasted back in as a command, an SQL file pasted into a
terminal. Every one of those was a reasonable reading of an unlabelled block.

So every block of text he might act on gets a heading above it naming exactly
where it goes. In Hebrew, in bold, on its own line:

    **להריץ בשרת (קונסולת DigitalOcean):**
    **להריץ בעורך ה-SQL של Supabase:**
    **להדביק בתוך הסקריפט, אחרי שהוא שואל:**
    **זה מה שהמסך יראה — לא להדביק כלום:**

That last one matters as much as the others. Sample output, an error message
being explained, the shape of a string — anything shown for reading rather than
for running — is labelled as such, or it will eventually be pasted somewhere.

Two rules that follow from it:

- **Nothing in a command may need editing before it is run.** A placeholder that
  can be pasted will be pasted; it has happened three times, once leaving the
  Hebrew words describing the value in a config file. If a command needs a
  secret or a name, write a small script that asks for it instead.
- **One block, one place.** Never mix a server command and an SQL statement in
  the same block.

## His name

ברק ליור in Hebrew, Barak Liver in English. The two do not match and that is
not a mistake to fix. The Hebrew was changed to ליבר once, to agree with the
domain, and it reached twenty-five strings including the name couples read on
their own screens. `STATE.md` had said ליור the whole time. Read it there
before touching it anywhere.

## Secrets

API keys, passwords and connection strings go into `/etc/liver-next.env` on the
droplet and nowhere else. Never ask him to paste one into the chat, and never
print one back — not in a command, not in an example, not in a diagnostic.
Diagnostics that read the environment file must filter connection strings out of
their own output. A password that reaches this conversation has to be reset, and
that has happened once.

## Where things are

- The platform is `liver-next/`, deployed on a 1GB DigitalOcean droplet.
- Development happens on `design-overhaul`. Never push anywhere else.
- A release is made by moving the `release` branch. The agent on the droplet
  checks every five minutes, backs up, applies only migrations the release adds,
  builds, and rolls back on its own if a screen check fails.
- "Released" is not "live". The agent gives up on a commit after two failed
  screen checks and says so only in `/var/lib/liver-agent/agent.log` — for five
  days in September every release was rolled back and nobody knew. The
  release card on `/app/admin` now reads that directory; look there, or ask
  him for the log, before saying a release is live. `scripts/verify.mjs`
  reads its expected palette from `globals.css`, so a design change cannot
  fail it again; do not put literals back.
- Releases have numbers, because a commit hash is not a thing he can say out
  loud. `liver-next/version.json` holds the current one and is bumped by hand
  in the commit worth a number: a fix is the third digit, a batch of work the
  second. The agent reads that file out of the commit it deploys and writes
  the number beside it, so the card on `/app/admin` says "ליור 2.1" with the
  commit underneath in small print. Talk to him in numbers, not hashes.
- The couple's screen shows almost nothing at rest and has lost nothing. Open
  on arrival: the countdown, the five opening questions, the one thing to do
  next, and four figures. Everything else — their tasks included — is behind
  six rows that say what is inside them, in `components/portal/Fold.tsx`.
  Closed it is 1,871px on a phone and open it is 15,746, which is the whole
  argument. Two rules come with it. The order of that screen is decided in
  `PortalWorkspace` alone: the portal page hands its own panels in as `slots`
  rather than printing them under it, because when it printed them the
  suppliers were in one file and the supplier desk in the other. And every
  link into a section now points inside something closed, so `lib/reveal.ts`
  opens it first — the quick-jump uses it and so does `FoldReveal`, which
  catches every ordinary `#` link on the page. Without it the button on "מה
  עכשיו" scrolls nowhere in most browsers.
- The producer has a list of his own, separate from every wedding's:
  `producer_tasks`, drawn by `components/app/MyTasks.tsx` on `/app` under the
  attention pile, and on the calendar for whatever carries a date. The part
  that is not another task list is `repeat_every`: a routine is never done, so
  ticking it writes the day and moves `due_on` to the next occurrence, and one
  row carries "every month" for its whole life. The date arithmetic is in
  `lib/producerTasks.ts` and is pure so it can be tested — the 31st of January
  plus a month is the 28th of February, and a routine ticked eleven days late
  comes back in the future rather than already overdue.
- The list of events is read by season, not as one run of cards: years first,
  soonest first, dateless last, and inside a year the two things a couple can
  be buying. Nothing about that is configured — `lib/eventGroups.ts` reads the
  years off the dates, so opening an event in 2028 makes a 2028 heading exist
  and the year nobody has an event in does not. A list of years somebody has
  to maintain is wrong the first time nobody maintains it. The two kinds are
  `clients.service`: `production` is the whole year of it, `management` is the
  evening itself for a couple who planned their own, and it is a property of
  the engagement rather than of the account — `account_kind` already answers
  the different question of whether somebody has a producer at all. Anything
  that is not one of the two reads as a production rather than vanishing off
  the screen, and a heading is never drawn over nothing. Each year is a
  `<details>` and only the nearest one is open, for the same reason the
  couple's screen is folded: a season eighteen months out is a thing to know
  exists, not a thing to scroll past on the way to the wedding in five weeks.
  The row says how many are inside it, so closing one hides nothing.
- The crew is two tables, the same way suppliers are. `crew_members` is the
  producer's own people, `crew` is one of them working one evening, and the
  booking keeps its own copy of the name so renaming somebody cannot rewrite
  what last August says happened. What has no parallel on the supplier side is
  `roles`: a person is several answers at once, so it is a set of three, closed
  because a rule is written about it. The rule is `lib/crewNeeds.ts` and it is
  pure: up to 350 guests a manager and an assistant, above 350 a manager and
  two, social offered at every evening and required at none. It is staffed
  against the larger of the producer's estimate and the guest list, because
  one assistant over costs a fee and one under costs the evening. `crew.role`
  next door stays free text on purpose, for the twelfth job nobody listed.
- A crew member is the third audience, after the producer and the couple, and
  the narrowest. **No row level security policy was widened for them.** They
  read through two security-definer functions in 0091, `crew_my_events` and
  `crew_my_event`, which return exactly the columns they may see. That is the
  whole design, and it is deliberate: a policy grants rows, and rows carry
  columns, so "staff may read clients they are crewed on" would also hand over
  the budget target, the couple's phone and the brief. The sharpest case is the
  fee on their own crew row — two people on the same evening for different
  money is normal — so the functions never select it, and a node test reads the
  migration and fails if any of those words appears in them. `clients.crew_note`
  is a field written *to* the crew for the same reason: pointing their screen at
  `brief` would publish nine months of private notes in a one-word diff. They
  land on `/app/shifts` through `requireCrew`, and the invitation email carries
  no token at all — the address is the invitation, and the sign-in page mails a
  code to whoever owns that inbox.
- The season board at the bottom of `/app/crew` is every open event by three
  role columns, with each person's load beside their name. It moves people two
  ways on purpose: dragging, which is right with a mouse, and press-a-person
  then press-a-cell, which is the same two targets and is the one that works on
  a phone, with a keyboard and with a screen reader. The press path is the
  implementation and the drag is decoration over it — a long press on a phone
  is text selection and a drag is a scroll, and he works from a phone. The
  board moves first and the server catches up, because a staffing screen that
  waits a round trip per drag is a screen somebody drags twice. It also
  carries the money: income, crew, costs and margin per event and for the
  whole season, from `ledgerOf` in `lib/finance.ts` — the same function the
  money tab uses, so staffing an evening and reading what is left of it can
  never disagree. Income is the couple's payment schedule; before anything is
  billed the board says so rather than reporting a loss, because costs before
  billing is the ordinary shape of an event three months out.
  `crew_members.rate` is the usual fee and `assign_crew` copies it onto
  `crew.fee`, the same copy-on-write as the name: raising a rate next March
  must not rewrite what last August cost. Neither word reaches a crew
  member — `crewDoor.test.ts` fails if `rate` or `fee` appears in their two
  functions. Two things the season knows that no evening does are in
  `lib/crewLoad.ts`, pure and tested: a person booked on two events on one
  night — which neither event can see, because each is perfectly staffed on
  its own — and what each person has been paid across the year. An undated
  event never clashes, or every half-opened file would carry a red mark. The
  warning sits at the top of `/app/crew`, names both events as links, and has
  no dismiss button: it goes away when it is fixed.
  A crew member reaches their own screen through `crew.crew_member_id`, so
  somebody typed straight onto an event without going through the directory
  cannot see it. That is the trade for not matching people by name.
  Every cell on the board opens its own searchable list of the whole crew.
  There is no "add a slot" control because there are no slots: a cell holds as
  many people as are put in it and the rule only says how many it expects, so
  a third assistant is just a third assistant. What somebody is owed for an
  evening is `crewPay` in `lib/finance.ts` — `fee + extra_hours × hour_rate` —
  in one place because three screens add it up. Hours rather than a lump sum:
  the amount is what gets forgotten, the hours are what can be checked against
  somebody's memory of a night that ran until three. `monthsOf` groups it the
  way the paying happens, newest month first, and the hours are edited there
  rather than inside nine event files. The copy-on-write has one cost worth
  knowing: a season is staffed before the money is typed, so assignments made
  before the rates existed carry nothing and read as free evenings.
  `fill_crew_fees()` fills those blanks from the directory and **only** the
  blanks — a figure already written was agreed for that evening, and
  replacing it would undo the negotiation the copy exists to protect. The
  month sheet marks an evening with no cost rather than letting it contribute
  a quiet zero, and the cost is editable there, beside the total it feeds.
  Income is `clients.producer_fee` when it is typed and the couple's payment
  schedule when it is not — and that choice is made inside `ledgerOf`, which
  both the season board and the money tab read, so there is one answer to
  "what is this event worth" rather than two that disagree by next week. The
  schedule is right when it exists and wrong on most events for most of their
  life, because the figure is agreed on a phone call months before anybody
  breaks it into payments. A fee of zero is kept rather than falling back: an
  event given away is a fact, not a missing number. The cost of one person on
  one evening is editable on the board's own chip, because the directory rate
  is the usual figure and tonight is sometimes a different one.
- The card game is the fourth audience and the only one that is not the
  platform. Seventy-four cards he drew himself, in `public/game/cards`, played
  at `/play/<token>` — a route outside `/app` on purpose, because that is the
  whole of how "they are in the game and not in the site" is built: no header,
  no tabs, no bell. The switch that opens it is the root address's alone, and
  that is a fact about the database rather than about a screen: the trigger in
  0096 refuses a change to `clients.game_on` from anybody but the super admin,
  so hiding the button is the second line and not the only one, and
  `check-schema.mjs` proves both branches against a real Postgres using one
  producer twice — with their own address, refused; with the root address,
  through. The link is anonymous like the guests' page, for the reason a
  wedding always gives: two people, one account between them. Three things in
  it are load-bearing. Both partners get **the same deck order** from the same
  token, because "answer the next card as your partner" is a game only if
  they are looking at the same next card; the two doors give each of them
  their own place in the deck, not their own deck. The three rule cards each
  talk about a neighbour, so `lib/game.ts` deals them into interior positions
  instead of shuffling them — never first, never last, never two in a row,
  which a plain shuffle breaks in about one game in twelve. And the table has
  a **definite** `h-[100svh]`, not a minimum: a percentage height inside a
  flex column only resolves when the column's height is definite, and under
  `min-h` the card computed to nothing and the screen drew a blue dot. The
  words are Hebrew only, in `content/game.ts`, because the cards are pictures
  with Hebrew set into them and English chrome around Hebrew artwork is a
  half-translation. Nothing is saved: open a card, talk, press next. Twelve of
  his eighty-six drawn cards are not in the deck and `content/cards.ts` says
  which and why — four answered themselves, six repeated another card, one was
  a heading, and one told the couple which supplier to hire.
- The ground is a pale blue, #F2F6FC, everywhere: the app, the public site and
  the guests' page alike. It was warm ivory before, and slate before that; the
  rule that settles it is that his latest instruction wins, and the reasoning
  for each move is written above the values in `globals.css`. Everywhere,
  rather than in the app alone, because the whole point of the ivory move was
  that the shopfront and the workspace must not read as two businesses.
- The platform also has a dark palette. There are two controls for it and
  neither owns the state: a one-press switch in the app header beside the
  language one, and the full three-way choice in the accessibility menu —
  follow the device, light, dark. Both go through `useTheme`, so pressing
  either moves the other. It is one class on `<html>` and a block of
  token overrides in `globals.css`, so no component knows it exists. It
  applies to `/app` and `/design` and deliberately not to the public site or
  the guests' page: their headlines are light because they lie on a
  photograph, so flipping the palette under them draws a near-black title on
  a picture of a bride. Every tone in both palettes is measured by
  `npm run contrast`, the producers' accents included.
- `npm run classes` now also checks that `globals.css` parses. The suite reads
  that file as text and never as CSS, and for one commit everything was green
  on a stylesheet the build could not read at all: an edit had cut a two-line
  comment in half. Do not write a comment terminator inside a comment.
- The deploy builds into `.next-build` and renames it into place, and installs
  dependencies only when the lockfile changed, so a release does not take the
  live site down while it builds. Keep it that way.
- The deploy clears `.next/types` before the standalone type check, and that
  line is load-bearing. Those route types are generated and belong to the
  build that is currently serving, and `tsconfig.json` includes them — fine
  going forwards, fatal going backwards. Rolling back to a commit with fewer
  screens left `.next/types/validator.ts` importing pages the checked-out
  source no longer has, so `tsc` died on TS2307 and **no rollback could ever
  build**. That is how 2.16 became "failed, and the rollback also failed,
  needs a person": the release was recoverable and the recovery was not. The
  file is compiler-facing output, `next build` writes it again, and the
  running server never reads it.
- **Every drag in this app is written on pointer events**, through
  `useDragOnto` in `components/app/DragOnto.tsx`. Not a style preference:
  `dragstart` never fires on a touch screen, so the HTML drag and drop API
  does nothing at all on a phone, and the seating plan shipped on it for
  months while being dead on the one device it is used from — standing in a
  venue. `verify.mjs` fails any build whose bundle carries
  `dataTransfer.setData`, and that check is what caught 2.16: the crew board's
  own comment said the drag was decoration over a press, and the code had
  written the decoration in the API that breaks. A grip lifts and the rest of
  the row presses, because a finger landing on the row is scrolling.
- A check constraint added to a table that already has rows must be written
  `not valid`, and validated separately. sync.sql replays every migration on
  every deploy with ON_ERROR_STOP, so one old row that refuses one constraint
  does not fail once — it fails every five minutes forever and takes the
  thousands of lines after it with it. That is what stopped 2.6 and 2.7:
  0068 adds `meeting_kind` without 'note' and 0080 adds it with, so a blank
  page he wrote on is refused by the earlier line and allowed by the later
  one — which never runs, eleven hundred lines down. The data was never
  wrong. The whole suite stayed green because a database built from these
  files replays them in the same order and can never hold a row from the
  future; `npm run schema` now plants one.
- `supabase/setup.sql` builds a database from nothing.
  `supabase/sync.sql` brings an existing one up to date and cannot touch a row.
  Both are generated — edit migrations, then run `build-setup-sql.mjs`.

## What he cares about

A version update must never destroy data. He has said so in capitals. Every
answer about the database is written with that as the first question, and
"probably safe" is not an answer — `npm run check` includes a test that proves
it against a real Postgres.
