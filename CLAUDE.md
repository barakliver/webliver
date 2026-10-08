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
  on arrival: their picture and name, the countdown, the five opening
  questions, the one thing to do next, and four figures. Everything else —
  their tasks included — is behind six rows that say what is inside them, in
  `components/Fold.tsx` (not `components/portal/`, which is where this said
  to look for two months). Closed it is 1,777px on a phone and open it is
  16,743, which is the whole argument. The six rows are one object rather
  than six cards: `FoldGroup` is the surface, each row carries its section's
  mark and how much is behind it, and an open drawer is a tray sunk into the
  list. That is the reference he sent — a competitor's app whose whole
  quality is that it reads as organised rather than as full — and the same
  move the four figures above it already made. Two rules come with it. The
  order of that screen is decided in `PortalWorkspace` alone: the portal page
  hands its own panels in as `slots` rather than printing them under it,
  because when it printed them the suppliers were in one file and the
  supplier desk in the other. And every
  link into a section now points inside something closed, so `lib/reveal.ts`
  opens it first — the quick-jump uses it and so does `FoldReveal`, which
  catches every ordinary `#` link on the page. Without it the button on "מה
  עכשיו" scrolls nowhere in most browsers.
- **That screen answered two questions and never the third.** The count says
  how long is left and the card under it says what to do next; nothing on it
  ever said that a couple is fine. A screen that only ever lists what is open
  teaches somebody that opening it produces work, and a screen like that gets
  opened less and less. "87 ימים" is the fear and there was no reply to it.
  So `lib/standing.ts`, pure and tested beside `bingo` and `crewNeeds`, with
  two readings of the same rows and one fact object feeding both, so the
  sentence and the strip can never disagree about what is late. `standing()`
  is a ladder of eight verdicts and `behind` is checked first and before the
  wedding is even known to be in the future, because being told everything is
  fine while a supplier is unpaid is the one failure that would make the
  whole sentence worthless. It prints no number: the card above already names
  the one that matters and the strip marks the month it sits in, and a third
  copy of the same figure is how a screen starts to read as nagging. Only
  **their own** rows count, their tasks and their payments and never the
  producer's work, because telling somebody they are behind on a thing they
  have no button for is the one move this card must not make; both module
  gates are applied inside the lib rather than at the call site, which is
  where they would be forgotten. `Standing` sits inside the header object
  under the countdown rather than in a card of its own, because it is the
  answer to that number and not a fourth thing to read, and it is never
  absent: a band that is only there when the news is good is a band nobody
  believes. Nothing in it is red. Two verdicts carry no tick at all - a green
  check beside "עוד אין תאריך" is congratulation for a blank page, which is
  the kind of praise that teaches somebody the screen is not paying
  attention.
- **And the year, which nothing on that screen showed.** Every figure on it
  was about now, so a couple could not tell a crowded fortnight from a
  crowded wedding and had no sense of having got anywhere. `timeline()` lays
  the months from this one to the wedding's across `MonthsLeft`, and four
  rules are in the lib and tested because each is obviously right and quietly
  wrong. A month with nothing in it is still a cell: the gap is the
  information, and a strip drawn only where there is work is a strip whose
  spacing lies - the thing a couple is looking for is the empty September.
  Late things fold onto the current month rather than being drawn where they
  fell, because a strip that grows backwards opens on a couple's own history
  of being behind. An undated task is open and not due, so it is never given
  a month and is counted in a line of its own instead. And past twelve months
  the strip is not drawn and a sentence says why, the same move the bingo
  makes under nine tasks: thirteen cells on a phone is a bar chart nobody can
  read. The cells are capsules rather than one of the three radii, because
  they are marks on a chart and should not be mistakable for something to
  press, and because at twelve across a phone they are 23px and at three they
  are 40px, and a 12px corner reads as a rounded box at one of those and as a
  stadium at the other. Neither it nor the sentence is a row in
  `portalSections.ts`, for the same reason the countdown and the four figures
  are not: they carry no row the screen does not already have, ask the
  database nothing, and belong to the open screen rather than to what is
  behind the six drawers.
- **What the couple sees is decided by a switch and by nothing else.** Every
  section of their screen is a row in `content/portalSections.ts`, and that one
  list is read by four things: the couple's screen, the producer's preview of
  it, the switches he flips, and the couple's assistant. Adding a row there is
  the whole of adding a shareable section - the switch board, the per-tab
  switch and the save action all derive from it, which is how the alcohol
  calculator went from producer-only to shared in one line. The rule that was
  learned the hard way is the second half: **a panel must never hide itself on
  its own data.** Two did. The hall comparison vanished once a venue was typed
  on the event, which is months before anything is signed, so couples touring
  halls lost the screen for touring halls. The supplier desk needed a supplier
  to exist before it would draw, so it was missing for exactly the couple who
  has booked nobody. Both looked like a switch that did not work, and neither
  was reportable, because nobody reports a screen they never knew was there. A
  drawer opened and found empty costs one press; a drawer that is not there
  costs the feature. The one honest exception is a panel whose props cannot be
  built without a row at all - the brand studio - and that is a missing object
  rather than a hidden one.
- The wedding bingo is that list drawn as a game, and **its squares are real
  tasks and its press is the real tick**. Nothing about it is stored: no
  table, no row, not even the layout. `lib/bingo.ts` computes the board from
  the tasks already on the screen and `useTaskPress` does the pressing, which
  is the same hook the checklist row uses — so a supplier square opens the
  same form asking who was hired, and filling it in still writes the supplier
  and the budget line. A bingo with a list of its own would be a second
  checklist, and by the end of the first week a couple would have two answers
  to "did we book the photographer" and no way to tell which one is the
  wedding. Three rules are in `lib/bingo.ts` and tested because each is the
  kind that is obviously right and quietly wrong. The board is only ever a
  full square, three or four a side: a blank cell sits on lines, and a line
  that can never complete makes a board unwinnable while looking exactly like
  a board, so under nine tasks the panel says so in a sentence instead. What
  goes on it is decided without ever reading `done` — selecting on what a tick
  changes means winning a line rebuilds the board under the finger that won
  it. And each task's place comes from a hash of the wedding and the task
  rather than from shuffling the array, because a shuffle re-runs whole and a
  seventeenth task would move the sixteen already there.
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
  platform. Sixty-six cards he drew himself, in `public/game/cards`, played
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
  their own place in the deck, not their own deck. The two rule cards each
  talk about a neighbour, so `lib/game.ts` deals them into interior positions
  instead of shuffling them — never first, never last, never two in a row,
  which a plain shuffle breaks rarely enough never to show up while anybody is
  watching and often enough to be somebody's first game. And the table has
  a **definite** `h-[100svh]`, not a minimum: a percentage height inside a
  flex column only resolves when the column's height is definite, and under
  `min-h` the card computed to nothing and the screen drew a blue dot. The
  words are Hebrew only, in `content/game.ts`, because the cards are pictures
  with Hebrew set into them and English chrome around Hebrew artwork is a
  half-translation. The notebook in 0097 is the one thing the deck keeps: one
  note per card per player, upserted so the table can never hold more than a
  hundred and thirty-two rows for a wedding, which is what makes an
  anonymous write endpoint a bounded object rather than an open one.
  `game_notes` has row level security on and **not one policy** - no producer
  reads it and neither does he - and `check-rls.mjs` grew a
  `SEALED_BY_DESIGN` list so that stays a decision rather than looking like a
  forgotten one. An empty note is a delete, decided in the database so the
  screen and the table cannot disagree about what "never mind" means. The
  drafts were filtered here once, twelve of eighty-six cut and the reasons
  written down; that whole exercise is gone, because he sent the finished deck
  and the finished deck is the deck. Two things came out of the replacement
  worth keeping. **The ids in `content/cards.ts` are his file names**, not a
  numbering of our own: the drafts had none and got one invented for them,
  the final cards arrived numbered, and card 37 is `37.webp` is the 37th card
  he drew, so "look at 37" survives the trip from a phone call to a file. That
  is also why the rule cards are 100 and 101 with a gap in front of them, and
  closing that gap to make the list tidy would undo the only thing the ids are
  for. And **three of his pictures are printed but never dealt**, each drawn
  where it belongs instead: 102, "איך משחקים?", is the rules screen, because a
  deck that deals its own instructions halfway through a game is a bug
  somebody has to explain; 103 is his contact card, which in the printed box
  is the one at the bottom of the pile, so here it is the screen after the
  last card rather than a turn in the game; and the back is the back, behind
  every face-down card. That last one was a drawn stand-in for two releases —
  a hairline frame with a heart character in it — because the file did not
  exist yet, and the difference between it and the real picture is the whole
  of whether the table reads as a deck of cards or as a web page doing an
  impression of one. A test walks every id to its file and back and asserts
  the three undealt ones are undealt, so a card without a picture fails the
  build rather than drawing a broken image inside his frame.
- The ground is a pale blue, #F1F4F9, everywhere: the app, the public site and
  the guests' page alike, with #4D68A0 as the brand blue. It was warm ivory
  before, and a pale blue before that, and slate before that; the rule that
  settles it is that his latest instruction wins, and the reasoning for each
  move is written above the values in `globals.css`. Everywhere, rather than
  in the app alone, because the whole point of the ivory move was that the
  shopfront and the workspace must not read as two businesses.
  This entry said #F2F6FC for a while and the code said #FCFCFA, because the
  blue was withdrawn a round later and this line was never brought back. A
  palette is the one thing a person checks here instead of rendering the
  page, so when it moves again, move it here in the same commit.
  The brand blue was #4F6BA5, which he picked, and it is three percent
  darker now: on its own 8% wash it measured 4.33 against a bar of 4.5 and
  on the step up 4.40, and both of those are the tinted chip this interface
  is full of. `accent-bright` moved two percent for the same reason. Neither
  is a different colour; each is the same colour clearing the bar it was
  always meant to clear.
  The blue is a default rather than a decree: `producers.accent` still wins
  for a producer who picked their own, and all six of those accents are
  measured against these grounds in both palettes by `npm run contrast`.
  **That script carries a hand-written copy of the palette on purpose** -
  reading the values out of the stylesheet would mean it passes whenever the
  stylesheet is self-consistent, and the question it asks is whether the
  numbers somebody wrote down are the numbers that are readable. The copy is
  the second pair of eyes. What the argument did not survive is the thing it
  was built to catch: the copy was never brought across when the ground went
  from ivory to blue, so for two redesigns the script measured a palette the
  product had stopped using and reported that every pairing passed. It was
  telling the truth about colours nobody could see. The copy stays and it is
  now compared against `globals.css` token by token on every run, failing
  with both values named - somebody still writes each number down twice,
  deliberately, and can no longer do it once and walk away. Three producer
  `light` tones moved by one and two percent when the real dark ground came
  into view for the first time.
- **The typeface is Heebo and there is only one.** Not Heebo for the
  interface and a serif for the headings, which is how it was built: Heebo
  everywhere, on `/app`, on the couple's screen, on the shopfront, on the
  guests' page, in Hebrew and in English alike. He asked for it in one
  sentence and his latest instruction wins, the same rule that settles the
  ground colour. Frank Ruhl Libre, Lato and Playfair Display are no longer
  downloaded at all, and `font-serif` is kept as a name whose face is Heebo,
  because a producer's brand kit still sets `--font-editorial` to the
  display font they chose for their own wedding. Two things travel with the
  family and were got wrong the last two times it moved: the tracking, which
  is negative for this face and positive for the serif and lives in
  `globals.css` and `tailwind.config.ts`; and `scripts/verify.mjs`, which
  asserts the face reached the build and would roll a release back on the
  wrong assertion. Heebo sets real Latin, which is why the English page no
  longer swaps in a second family.
- **Every size below 30px is one of eight named steps**, in
  `tailwind.config.ts`: `micro` 11.5, `meta` 12.5, `body` 14, `lead` 15.5,
  `head` 17, `subhead` 19, `panel` 22, `figure` 26. There were thirty-five
  before, and twelve of them were heading sizes. Nobody chose thirty-five;
  they accumulated one at a time, each a reasonable local decision, and half
  a pixel is invisible in one panel and is exactly what makes a whole screen
  read as assembled rather than designed. The steps are the values the
  product already used most, so the rename moved 1,800 call sites and moved
  no text by more than a pixel; what it did change is that 13px and 14.5px
  became the same step, because an interface has one body size. The steps
  carry **no line height** on purpose - an arbitrary `text-[14px]` set the
  size and nothing else, and attaching a leading here would have silently
  relaid out every screen. 30px and up stays arbitrary: those are nine
  one-off art directions, and forcing a hero onto a shared step only grows
  the scale to defeat the rule. `npm run type` fails the build on anything
  below 30 that is not a step, for the same reason `npm run classes` does it
  for colour - the failure it catches is a mistake that looks like a
  decision.
- **A radius says what a thing is**, and the three are `card` 16 for a
  panel, `card-sm` 14 for a surface inside one, and `control` 12 for
  anything pressed or typed in; `sheet` 22 is what floats. `xl2` is the
  legacy alias for 12 and is still on 325 controls, which is correct for a
  control and was wrong on the thirty-four bordered boxes that were reading
  as panels at the radius of a button. Nested surfaces step down rather than
  matching: an inner box at the outer box's radius is what makes a card look
  like a sticker on a card.
- **A budget line can be corrected, and that was missing for a year.**
  `budget_items` had add and delete and no update at all, so the agreed
  price - the one figure that by definition arrives late, after somebody
  negotiates - could only ever be set at creation. Recording June meant
  deleting the line and retyping four fields from memory, which is how a
  budget stops being true. `updateBudgetItem` in `actions/money.ts` is the
  fix, and it refuses silently-empty updates: an update that matched no row
  returns an error rather than "saved", because the screen would otherwise
  say saved and show the old number. Blank clears the agreed price on
  purpose, since a supplier can fall through and the line goes back to being
  an estimate. The panel is one list of rows at every width now, each a
  `<details>` opening onto its own form; the four-column table it replaced
  is the shape of a spreadsheet, which promises you can click a cell and
  change it, and that one could not. Two implementations of the same rows
  also meant an edit had to be built twice, which is how it got built
  nought times.
- **A payment and a guest can be corrected too, and until now neither
  could.** Both panels had add and delete and no update, and in both the
  delete destroyed more than the mistake. A payment carries `paid` and
  `paid_on`, so fixing a slipped date on an instalment that had already been
  settled deleted the record that the money moved — a product asking
  somebody to choose between a wrong book and a shorter one. A guest carries
  `status`, `party_size` and `responded_at`, so a typo in a name cost the
  RSVP, and nobody rings an aunt a second time over a spelling: the name
  stayed wrong and was printed on the seating chart. `updatePayment` and
  `updateGuest` write the fields the form carries and deliberately never the
  reply or the settlement — `togglePaid` and `setGuestStatus` are the other
  act, and keeping them apart is the point. Both refuse an update that
  matched no row, because "saved" over an unchanged value is the one outcome
  worse than failing. The guest's form is a `Sheet` rather than an inline
  row because that list is drawn twice, as cards and as a table, and a thing
  built twice is a thing built nought times — which is exactly how it went a
  year with no way to fix a name at all.
- **Nine panels could add and destroy and not fix, and now none of them
  can.** After the budget, the payment and the guest came the rest of the
  class: the ledger entry, the envelope, the car, the face, the reference
  picture, the table's name, the caption on the board, the wedding in the
  journal and the post in the circle. The shape is always the same and worth
  recognising on sight - an `add` and a `delete` in the same actions file
  with nothing between them - but what the delete costs is different each
  time, and that is the part to read before writing the fix. Deleting a VIP
  takes the photograph out of storage, so fixing a spelling cost a picture
  somebody scrolled back through a phone to find. Deleting a journal entry
  takes up to twenty. Deleting an envelope takes `delivered_at`, which is the
  one question that table exists to answer. Deleting a table unseats
  everybody at it. In every case the product was asking somebody to destroy
  the record in order to correct it, and the answer is the same each time:
  the update writes the words and never the other act - never `paid`, never
  `delivered_at`, never `status`, never `photo_url` or `image_path` or
  `sort` - and refuses an update that matched no row, because "saved" over
  an unchanged value is worse than failing. Two of them needed more than
  that. The journal **appends** its photographs rather than replacing them,
  because the screen only ever holds signed URLs and never the paths behind
  them, so a form submitting "the photographs" would submit whichever ones
  were uploaded in that sitting and silently drop the rest. And the circle
  is the only one of the nine whose record is not private, which is why it
  is the only one that stamps `edited_at` and shows "נערך": a post is
  answered underneath, and a rewrite with no mark leaves four replies
  answering a question nobody can see, which makes the people who replied
  look careless. The circle's edit also goes through a definer function
  rather than a plain update, for the same reason its delete does - `select`
  is revoked on those tables, so an update can neither ask for RETURNING nor
  tell a refusal from a miss.
- **`npm run check:full` boots the product, because two checks needed one
  and so never ran.** `check-a11y.mjs` and `check-hydration.mjs` had existed
  for months and neither had ever been run: each needs a `--url` and a server
  behind it, so neither could go into `npm run check`, and a check that is
  not in the one command somebody types is a check that does not exist. That
  is the contrast script's failure a second time. `check:full` starts
  `next dev` on its own port - dev and not a build, because `/design` is the
  page both lean on hardest and it is gated on `NODE_ENV` - waits for it,
  runs both, and puts it away. It stays out of `npm run check`, which has to
  finish fast enough that nobody skips it. Its first run found six faults
  nothing else could see, and the one worth naming is **a form inside a
  form**: the browser drops the inner one while parsing, React's tree and the
  DOM stop matching, and the whole page is thrown away and rebuilt. It
  rendered correctly and the suite was green.
- **Opacity is not a mute.** It was used for three "set back" states - the
  out-of-month calendar cell, a past crew shift, a switched-off lead channel -
  and at 60% `ink-mute` composites to 2.51 against white, so every word in
  those cards went under the bar at once, the buttons included. The one state
  a producer most needs to read carefully was the one they could not. All
  three are set back with paper now: a background tint and a softer border,
  with the ink left alone. The same rule caught two more: the couple's own
  colour behind the text of a calendar chip (it is a dot beside the words
  now - an accent is chosen to be beautiful and that is a different job from
  being read, which is what `readableAccent` already settles on the brand
  pieces), and `accent-bright` on a 17px metric row, where it gives 3.33
  against a 4.5 bar. That colour exists for a 62px numeral at the 3:1 large
  bar; the tone map was shared between the two sizes, so every linked figure
  on every summary read as a decision rather than as the borrowed value it
  was.
- **The raw `<img>` tags are deliberate, and `next/image` would be wrong
  here.** Almost every picture in this product is a signed one-off Supabase
  URL for somebody's private wedding photograph, valid for an hour. Routing
  those through the image optimiser would put every guest's face and every
  supplier contract through a transform and leave the result in a disk cache
  on a one-gigabyte droplet, keyed by a URL that expires. The three fixed
  assets that are not private already use `next/image`. Of the fourteen raw
  ones, eleven reserve their space in CSS and shift nothing; the three that
  shifted were logos sized `w-auto`, which means the header does not know how
  wide it is until the file lands, and a logo is the one image always above
  the fold and therefore the one whose shift is always seen. They have a
  reserved box now and the picture fits inside it.
- **The `revalidatePath` calls are not over-invalidation, and narrowing them
  would be churn.** It looks like over-invalidation: `/app/portal` is named in
  31 places and `/app` in 22, so editing one envelope appears to refresh the
  couple's whole screen. Two things make that reading wrong. The counts are 31
  *different actions* each correctly naming a screen their write changes, not
  one action calling it 31 times; the worst single `touch()` names four paths
  and the day's data really is on all four. And Next's own documentation for
  this version says a `revalidatePath` from a server function "currently also
  causes all previously visited pages to refresh when navigated to again" —
  so naming a narrower path buys nothing today, and the only effect of the
  change would be to alter behaviour unpredictably on the day that temporary
  behaviour is fixed. Every route here reads cookies through `supabaseServer`,
  which makes it dynamic whether or not it declares `force-dynamic`, so what
  these calls actually buy is the client Router Cache being dropped: without
  them a couple edits a row, navigates away and back, and reads the old list.
  Leave them naming the screens they change.
- **A heading is one of three classes**, `head-panel`, `head-section` and
  `head-sub`, in `globals.css` beside `.card` and `.eyebrow`. There were 83
  written out by hand, and because they were written out they were written
  out slightly differently. A figure that shares the treatment keeps its own
  classes: a number is not a heading.
- **A function whose return table may ever move is dropped before it is
  created.** `create or replace` cannot change a return type, and sync.sql
  replays every migration on every deploy - so widening a reader in a later
  migration makes the earlier `create or replace` fail on the *second*
  replay, with ON_ERROR_STOP taking the thousands of lines after it. That is
  the shape of the fault that stopped 2.6 and 2.7, and 0100 walked into it
  with the three circle readers. `npm run schema` catches it, because it
  applies the whole thing twice.
- **The category on a budget line is a guess you can overrule.**
  `categoryOf` in `lib/budgetPlan.ts` reads `category` first and then the
  label's own Hebrew words, so most lines file themselves; a hall called
  "אצל דודה" files itself under `other` and quietly bends the tracker's
  plan-against-actual. The add form never asked for a category at all, so
  every line was created blank. Both forms now carry the select, blank means
  "work it out from the label", and every row prints the area it landed in -
  nobody reports a category they cannot see.
- **A wedding's accent is chosen to be beautiful, not to be read**, and those
  are different jobs. The default gold is 2.87 against the default ivory,
  where the bar for a sentence is 4.5, and it is no better anywhere else:
  3.09 on pure white, 2.80 on the platform's own blue. That is a fact about a
  light gold rather than about a ground, so no change of paper rescues it,
  and it matters because the guests' page is public and the people reading a
  wedding invitation on a phone in poor light are often the grandparents. So
  small text on a brand piece asks `readableAccent` in `content/brandKit.ts`
  and gets the accent only when the accent clears the bar; the hairlines, the
  ampersand and the filled pill still take it directly, because decoration
  carries no meaning. Nobody's palette is overruled - a couple who chose a
  dark accent keeps it everywhere. `inkOn` beside it used to answer by a
  luminance cut-off at 0.4, which is right at the ends and wrong in the
  middle, and the middle is exactly where an accent lives: the RSVP pill came
  out ivory on gold at 2.86 while charcoal on the same gold is over 5. It
  measures both and takes the better one now. Both are tested.
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
