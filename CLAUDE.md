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
  **Each square carries a picture, and the picture is a guess the words
  make.** Sixteen squares of two-word Hebrew read as a form, not a game, and
  a board that looks like a form is opened like one. `markOf` in
  `lib/bingo.ts` reads the task's category first and its title second, and
  the title reading is anchored on the start of a word with one Hebrew
  prefix letter allowed in front of it, because the first version matched
  substrings and "לדבר עם דודה" got a cocktail glass. The picture never
  changes when a square is ticked: a tick that swaps every icon for the same
  check mark makes eleven of sixteen squares identical, which is the board
  losing the thing the pictures were added for. Nothing falls through to a
  blank; the last rung is a plain list mark, and a test walks every task
  category in `content/eventFile.ts` and fails if one of them lands there.
  That list and not `content/production.ts`: the two vocabularies look alike
  and only one of them is what a task carries.
- **A task row on a phone is the title, then everything else.** It was one
  flex line with four things on it, and the Hebrew sentence got whatever
  width the checkbox, the date and two text buttons left, which was one or
  two letters per line. The title has the row now, and the date, the owner
  and the two actions share one quiet line under it, the actions as icons
  with their names in `aria-label`. A late row is a red edge rather than a
  red card, because a card that turns red turns its own text under the bar.
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
- **From group 11 he stopped choosing and asked me to run the rest on my own,
  with movement and something to be curious about on every page.** 3.17.
  The canvas stays as the record of the two options drawn for group 11
  (R, W, S, P, E, U, each A and B); what shipped is a mix decided here, and
  nothing in it is invented for the sake of motion: each thing that moves or
  surprises is a fact the page already held. **R, the reply:** a's single
  object with b's colour - the invitation's names on the band, the days left
  counting up, the two answers as the two largest things on the screen (a yes
  is the rubine and a no is the camel, so what somebody has said reads from
  across a room), a stepper for how many (nobody on a phone wants the keyboard
  to say they are two) with the line "we are keeping N seats for you", and a
  yes ends in a burst of petals and a button that adds the day to their
  calendar, built in the browser as a data address because the invitation link
  is a credential and a second route that answers to it is a second thing to
  protect. **W, the guests' page:** the days counted up, sections that rise as
  they scroll into view, and the evening as a line down the page that on the
  day itself knows which moment is under way and which is next (`LiveMoments`,
  read in Israel's zone after hydration and never during it, so server and
  client draw the same list). It stays in the couple's own brand: no band, only
  the ink and surface tokens, because their accent is chosen to be beautiful
  and not to be read. **S, signing:** three steps and a line that fills as the
  terms go past (`SignSteps` reads the page and gates nothing - a button
  disabled because a scrollbar has not arrived is a rule about how people read
  dressed as a safeguard), the amount as the figure on the band, and a drawn
  tick with petals once it is signed. **P, the supplier's page:** faces as
  portraits with their instruction at the size of the name, a face with no
  picture gets its tone and first letter rather than a hole, the references as
  a mosaic, and any picture opens large (`ZoomPhoto`, on `useOverlay`) because
  a thumbnail is not a face you can find across a hall. **E and U:** the door
  is a card with the cover to its edges and its three ways in arriving one
  after another; unsubscribe is a sentence and a tick, and nothing else moves,
  because the person reading it wanted out. The three pieces of motion are CSS
  and nothing else - `count-up` is generated content on a registered integer so
  there is nothing to hydrate and an engine that cannot animate it shows the
  final figure; `reveal` is a view timeline, so there is no observer and no
  flash of hidden content; `petals` and `draw-check` are keyframes - and all of
  it is off under reduced motion. The card game (`/play`) is not in this group
  and was not touched: its pictures are his.
- **Group 10, chosen as a mix, and the pages now carry letters.** 3.16. He
  said "a mix" and asked that every page he is sent be named with an English
  letter so he can say "this from A, that from B"; from here a board is
  `<group><A|B>` and each page inside it is lettered, and the mix is said back
  to him in the same letters. **The couple's screen** took b's two columns
  from `lg` up and a's order everywhere: the header, what to do and the year
  on one side, the four figures and the six drawers on the other, in the same
  document order as the phone, so a grid with one column is the stack it
  always was and nothing about tab order moved. **The circle** has b's topics
  as four swatches in a rail from `lg` (the open one ringed, the others not
  dimmed, because a colour that fades reads as disabled) and pills with a
  dot on a phone, and a's composer as the first row of the feed, drawn as the
  field it opens; a topic keeps its tone on the rail, on the chip of a post
  and on the dot (`toneAt` over the closed list in `lib/tone.ts`, which is
  also where the class strings for the four tones live, written out in full).
  **The journal** is a's timeline down a line on the start side, a mark for
  each wedding, with b's mosaic inside an entry (the first picture takes four
  cells, rows have a fixed height so a signed picture landing moves nothing),
  and the summary areas are tones. **The questionnaire** is b's chapter cards
  with a bar each and the chapter's own tone on its letter, and from `lg` a's
  rail of the six chapters beside the one being answered; moving along the
  rail is safe because every answer already has its own timer and nothing on
  the rail holds one. Not done: counts on the topics (the feed is filtered
  before it arrives, so a count would be a second query for a number that
  changes every time somebody posts).
- **Group 9, chosen as a mix: the documents of the event, with the colour on the
  screen and the paper left white.** 3.15. The run sheet, the numbers sheet and
  the production book are print-first, and paper stays white, so what was
  redesigned is the screen around the paper and nothing printed. `DocSwatches`
  is the strip over a document, `no-print` by construction: over the run sheet
  the version, whether it is locked and when, how many lines and the span of the
  evening (producer's side only; a couple holding their own sheet is not shown
  the machinery); over the numbers sheet the four figures a supplier asks for;
  over the book a tile per section saying how much of it is there. **A blank
  tile is drawn as an outline and not a fill** - `quiet` - because a running
  order that is empty is information and should not look like a swatch of
  something. What is in the book is `bookSections` in `lib/bookSections.ts`,
  pure and tested: a supplier list with an unsigned supplier, an invitation
  list with unanswered invitations and a payment list with an unpaid instalment
  are partial and not full, and the task list is full when nothing is *open*,
  the reverse of how a count usually reads. **The numbers sheet** takes b's
  idea that each supplier is given what they ask for: five parts, left off with
  `?off=diet,seating`, so the choice is an address somebody can send and the
  paper is the paper they chose; `NumbersSheet` takes `off` and defaults to the
  whole sheet, which is what it always was. **The live screen** has the clock as
  the biggest thing on it while the evening runs (the browser's, so it matches
  the watch on the wrist), what is happening now as the rubine and what is next
  as the camel, so colour says which is which in a hall with the lights down.
  **The note** has the other pages of the event in a margin from `lg` up, newest
  first and capped; on a phone it is still the whole screen. Not done: b's
  "delay ten minutes" button on the live screen already exists as `shiftAfter`
  in the run of show and was left where it is, and the couple's preview is
  group 10's screen.
- **Group 8, chosen as a mix: the profile, the knowledge shelf and the wait,
  in the tones.** 3.14. He said the pages were good, asked for a mix and said
  the colours should be as on the numbers screen, so each took its structure
  from one option and its colour from the system in the tone entry below.
  **The profile** is b's head and rail with a's cards: who this is on a swatch
  of the tamarind (picture, name, and the address the account is keyed on,
  which is the one thing there that cannot be edited), a rail of anchors
  beside it from `lg` with a colour dot each and the way out at the foot, and
  under it the details, the alerts and a new display card with the three
  buttons (`DisplayChoice`, through `useTheme`, so it moves the header switch
  and the accessibility menu). **The knowledge shelf** is b's three shelves as
  three swatches that say what is inside them (`shelfSubs`, the count in the
  corner), the open one ringed and the others not dimmed, because colours that
  fade when not chosen read as disabled; and a's chapters beside the page,
  which is `GuideBookView`'s own change and so reaches the couple's guide as
  well: first steps as swatches with the number written on them, a rail of
  chapters with a dot each, a filled mark on every chapter title. **The wait**
  puts the one sentence that is about the reader, what they asked for, on a
  tamarind swatch. Not done, and said so: b's "the last chapter you read" needs
  a place to remember it, and a column on the profile for a reading position
  is not worth the migration; and `/app/sop` is still a redirect that never
  renders, with no screen of its own to design.
- **An instalment says who paid it, how, and on what day, and the panel cuts
  the money at the evening.** 3.13, migration 0108. `payments` is the
  couple's schedule to the producer, and it could say what, how much, when due
  and whether paid - not who of the two paid, not through what, and not the
  day the money really moved, which is the thing a producer is asked while a
  couple works out what the wedding costs month by month. Two text columns,
  empty by default so older rows read "not said": `paid_by` is free text,
  because a couple's names are typed by hand and a closed set would refuse the
  row the day a spelling was corrected, and holds one of the two names or
  `JOINT_PAYER` (a sentinel and not the word, so Hebrew and English group
  together); `method` is a closed set in `lib/payMethods.ts` because the
  cash-flow groups by it, and the constraint is `not valid`, as every one is.
  The two names come from `coupleNames` in `lib/coupleNames.ts`, read out of
  the event's name ("נועה ואיתי": the ו stuck to the second name is the "and"),
  because there is no column of partner names and adding one is a second place
  to type the same two words; anything that is not clearly two names gives none
  and "joint" is the only choice. A name already on a row that is no longer in
  the list stays selectable, so correcting a spelling never silently
  reassigns an old payment. Marking paid is a form that opens (`settlePayment`:
  the day, who, how) rather than a flag that flips, because the day is usually
  not today; `togglePaid` is still the undo, and `updatePayment` still never
  writes `paid` - it writes `paid_on` only on a row that is paid, guarded in the
  query, since the table refuses a day on an unpaid one. The cut is
  `paymentFlow` in `lib/paymentFlow.ts`, pure and tested: paid and due, before
  and after the evening, and the paid part by method and by payer. The day
  itself is before; an unpaid instalment with no date is in neither half and on
  its own line, because filing it under either would misstate the year; with no
  event date there is no cut to make and the panel says so. The date field on a
  phone ran off the edge of a 390px screen, because date inputs carry an
  intrinsic width of their own: width and min-width are stated and the native
  appearance dropped, which is what makes iOS listen.
- **The palette is varied by tone, not only used.** 3.12. The five colours on
  the card were one rubine action on a camel page, and the card itself is
  four blocks of colour with something written on each. So the four that are
  not the ink are tones - camel, boho, rubine, tamarind - each as four tokens:
  `--tone-X-rgb` the fill, `-on` what is written on it, `-wash` a ground that
  sits under ink, `-ink` the colour that reads on that wash, in `globals.css`,
  `tone-X` in Tailwind (`bg-tone-boho text-tone-boho-on`, always written out
  in full because Tailwind reads class names as text), in both palettes and
  collapsed to one in the high-contrast mode, where four browns told apart by
  hue is not what was asked for. After dark the rubine and the tamarind are
  lifted so a fill stands off the roast. Every fill against its label, the
  label at 90% (80% of white over the boho is 4.2), every wash against its
  ink and the accent on every wash are in `npm run contrast`, and the hand
  copy is compared with the stylesheet token by token like the rest.
  Where they are used, and the rule behind each: **a figure is a swatch**
  (`Metric`/`MetricBlock` take `fill`, used by the numbers screen, the admin
  console, the couple's four figures, which are two by two now, and the leads
  column of the producer's desk); **a set is told apart by colour as well as by
  word** (the four groups of the event rail, the five stages of the leads
  board, the three roles of an evening, the two things a couple can be buying,
  the kinds on the calendar, and the six drawers of the couple's screen, whose
  mark is a filled square); and **a screen carries its area** (`AreaBar` over
  every title, `areaOf` in `lib/area.ts`, tested: events and the home are the
  rubine, leads, the crew and the brand the boho, the inbox, calendar and
  suppliers the camel, the numbers and the console the tamarind). A path nobody
  owns gets the default, so a new screen is coloured on the day it is made.
  What was kept off the tones on purpose: late money and the waiting count
  on the desk's money card stay white with the brick, because the red on a
  camel fill measures 3.2 and a figure that is late must be readable before it
  is pretty. The tone is which figure it is; the label and the number still
  say what is wrong.
- **The way in is Google's alone, and a new account says what it came for.**
  3.11, migration 0107. The sign-in screen is one button: the emailed code
  and the form that asked for it are off the screen, and the two actions
  behind them refuse on `CODE_SIGN_IN` in `actions/auth.ts`, because a form is
  a suggestion and an action is a URL anybody can post to. It is one constant
  to unbolt, and `/auth/callback` still honours a link carrying a token, so a
  mail sent before the change keeps working. What somebody *is* is still
  decided at the door by their address in `handle_new_user`, which has not
  moved: an address he invited beforehand is a client bound to that event the
  moment it signs in and lands on its own screen, a crew address is crew, the
  root address is root. Everybody else is a pending producer, as before, and
  that is where the new question lives - on `/app/pending`, which was already
  where a not-yet-let-in account goes, not on a screen of its own. First
  "producer or making an event", then for the second "which event, a wedding
  or a business one"; two steps in the address bar, so Back works and nothing
  needs a script, drawn by `SignupPath` so `/design` can show it. The answer is
  `profiles.signup_intent` and it is a **request**: `choose_my_path` is the
  only writer, only for the caller, only while their producer row is pending,
  never for the root address, and a changed answer rings the root bell once.
  It grants nothing - `role` and `producers.status` are still the only things
  any screen decides from. The queue on `/app/admin` shows the request on the
  card, and for a wedding or a business event the primary button is "approve
  and open their event", which is `set_account_kind('diy')`; that function now
  opens a `corporate` event for a business answer and a `wedding` otherwise.
  The producer approval stays for everybody else and is hidden for somebody
  who said they are making an event, because approving them as a producer
  opens a client list for a wedding. Referral codes ride the Google round trip
  as `?ref=` on the callback, which claims them once there is a session; they
  used to be claimed after the code step, which no longer exists.
  **0107 also closes a hole 0104 opened.** The budget sheet wrote
  `or is_super_admin()` into the policies on `budget_items`,
  `budget_item_private` and `budget_payments`, so the platform owner could
  read every producer's budget, their private notes on a line and every
  payment - the one thing 0030 took away on purpose. It was found because
  `npm run schema` had not been run against a regenerated `sync.sql` for four
  releases: the generator read the second line of a block comment in 0105 that
  began with the word "update" as a data statement and cut the comment in
  half, so regenerating produced a file that would not load, and the committed
  copy had simply stopped being regenerated. `build-setup-sql.mjs` now skips
  block comments, and the schema check proves the sign-up path against a real
  Postgres: the request, the bell once, the three refusals, and the approval
  opening a business event.
- **The palette is five colours on a card he sent, and it is the whole site.**
  Camel Coat #C6B39A, Boho #7B694E, Rubine #6D3A3C, Tamarind #361319 and
  Italian Roast #280B0F: his latest instruction, replacing the plum below, and
  Heebo stays the one font. The card's hex labels disagree with its own RGB
  values for two of them (it prints #8D3A3C for the rubine and #3B1319 for the
  tamarind, and 109 58 60 and 54 19 25 for the same swatches); the RGB is what
  the swatch is, so that is what ships, and the printed #8D3A3C is kept as
  `accent-bright`, for large numerals. The card has no light ground, and a page
  of camel is not a page you read, so the ground is the camel thinned toward
  paper, #F3EDE4, on white cards over a camel hairline #E2D6C6, with the roast
  as the ink and the rubine as the action (white label, 9.1:1). The band is the
  tamarind, with the camel as its light. The secondary ink is Boho a step
  darker, #6A5942, because the card's own Boho reads 4.0 on the step up #E9DFD1.
  The producer's desk is the dark palette: the roast as the ground, the
  tamarind for the cards, #4A2228 for the step up, the camel as the action with
  the roast on it, and ink #F3EDE4. **The rubine is the action, so "bad" had to
  be somebody else**: a brick, #A33A33, with the status tones solved around it,
  and nothing in the product is yellow: the warning is a burnt copper
  (#7D511B, and #D9A066 after dark). The focus ring is Boho in daylight, which
  no filled control is. Five of the six producer `base` tones moved one to three
  percent darker, because the ground is a little darker than the blush and a
  wash over it darker still. Same rule as every palette before it: this entry,
  `globals.css`, `PAGE_GROUND` and the hand copy in `scripts/check-contrast.mjs`
  moved in one commit, and `npm run contrast` passes on all of it.
- **The palette was plum at night, and the rest of this entry is its history, number 17 of seventeen directions, and
  there is one font, Heebo, everywhere.** He picked it by number with one
  condition: the font the same for everything. So Frank Ruhl Libre is no
  longer downloaded at all, `--font-display` and `--font-editorial` are both
  Heebo, `font-serif` is a name whose face is Heebo, and the large display
  lines that were regular are Heebo at 300, which is where the elegance the
  serif carried now lives. The one place a second face still appears is a
  wedding's own brand kit, on its invitation pieces and guests' page: that is
  the couple's chosen typeface for their wedding, not the platform's.
  The couple's screen is powder blush #FAF3F0 under plum ink #3B2E33, white
  cards on a hairline #EBDCDD with a soft lift (`--card-shadow`, none in the
  dark palette), and their name sits on a deep plum band #2B2228
  (`.band-dark`) in the light rose. The action is the rose #97535F with a
  white label; the design drew #A6616F, which is 4.20 on the blush, so the
  drawn rose is `accent-bright` for large numerals and the secondary ink is
  #7A5F67 rather than the drawn #8A6E75 for the same reason. `bad` is a wine
  #8E3B46 rather than a red, because red on blush shouts. No yellow anywhere;
  he ruled it out. The producer's desk is the dark palette: #2B2228 under
  #F6EEF0, card #3A2E34, step up #45373E, the rose #E3B5BC as the action
  with the plum on it. **On "auto" the desk is dark and the couple's screen
  follows the device** (`isCoupleScreen` and `resolve` in `lib/theme.ts`,
  and the same rule inside the boot script), which is the split the design
  was drawn as; light and dark stay a choice that outranks it. Radii are
  22 for a card, 14 inside one, 12 for a control, buttons pills. The
  standing sentence writes itself in with a clip, not letter by letter, so a
  screen reader has the whole sentence from the first frame. Four producer
  `light` tones and five `night` tones moved two to four percent to clear
  the new plum grounds. The paragraph below is the history of the
  HoneyBook move.
- **The pages are being rebuilt one group at a time, each chosen from two
  drawn options (a or b) on a canvas before any code is written.** He asked
  for every page of both the producer's side and the couple's, two options
  per page, and chooses by letter. A five-minute reminder in the session
  keeps the order; the groups are twelve and the first is the events list.
  **Group 1, chosen: b.** The list of events is cards, two across on a wide
  screen and one on a phone (`StatusBoard`), each with a ring that is a
  year long, empty at a year away and full on the day, so two cards side by
  side compare without reading the numbers (`.ring-arc`, drawn once, the
  undrawn length passed in as `--to`); the name beside a pill that says
  whether the couple bought the production or the evening; the date, place
  and guest estimate; the gaps as outlined pills, red and amber by level;
  the next task; and the attending figure over a bar that grows from where a
  line starts (`.grow-x`). The years are still drawers with only the
  nearest open, and the two kinds are still a subheading only when both are
  in one year. The tabs are a pill track, the summary under the title writes
  itself in. A grid column is `grid-cols-1` and the card `min-w-0`: a long
  event name pushed a card past the edge of a phone until both were there.
  **Group 2, chosen as a mix of a and b: the event file.** He took the
  rail from a and the ring from b. The sixteen sections stand in four groups
  (`EVENT_TAB_GROUPS` in `content/eventTabs.ts`, a test holds that each tab is
  in exactly one) and `EventTabs` draws one set of links two ways: a rail
  beside the file from `lg` up, group names over it and a rose dot on the open
  section, and below that the same links as one row that scrolls with an
  accent underline, in the groups' order, so the arrow keys walk what the eye
  sees. Over it is `EventHead`: the same ring, service pill and gap chips as
  the card for this event on the list, drawn from `getBoard({ only })`, which
  is the list's own reading of one event, because a second reading of what
  is missing would give two answers by the first week somebody fixed one.
  `PageHead` is gone from this screen, so `LoadTrouble` is drawn by the page.
  **Group 3, chosen: a on a desk, and b's short list on a phone.** The leads
  board is five columns across (new to won) with the two a lead steps off the
  path into, nurture and lost, folded to a strip that is still a drop target
  and opens on a press; the three figures are one object with hairlines
  between them, and every card carries its score as a ring (`ScoreRing`, the
  chip's three-way colour, a dashed ring and no number for a lead nobody has
  scored). On a phone it is not seven lanes to drag through but the answer to
  the one question the screen is opened for: who is waiting, then everything
  else that is open, with stage tabs that filter it. `useDesk` in
  `lib/useWide.ts` reads the `lg` breakpoint so only one of the two is built,
  with the same null-means-the-server-drew-it contract as `useWide`. The row
  on the phone opens the card and does not carry a WhatsApp button of its
  own: the press that writes the first-response stamp is on the card, and a
  second one here would be a second place to forget it. The card is a header
  with the ring, five stages as the real control on a desk (a press is the
  select's write) and a bar and a sentence on a phone, where the select is the
  control; its message, draft and summary reorder with `order-*` rather than
  being drawn twice, and WhatsApp and the call sit in a bar over the tab bar.
  **`input` was never a class.** Five files wrote `className="input"` and it
  compiled to nothing, so the lead card's fields were the browser's own, white
  boxes on the dark desk. They are `field` now, which is the class every other
  form is built from; the classes check did not catch it because the word is
  also an HTML element.
  **Group 4, chosen: a for the inbox and a for the calendar, and the calendar
  gets both.** The inbox is a list of what arrived and the open message beside
  it from `lg` up, so a morning is one press per message and the answer never
  leaves the screen; on a phone it is the list and a press opens the message
  with a way back, and a push link to `#item-<id>` opens that message on its
  own tab. The sentence the reading made of a message is the largest thing in
  the pane. The calendar is the month as a board of tiles with the open day
  beside it (under it on a phone), and the same rows as a running list with the
  day as a big numeral. The choice between them is the reader's:
  `CalendarViews` draws both on the server, hides one, and remembers the
  choice in the browser; a day in the address brings the month forward,
  because that day's panel lives there. The Hebrew calendar's verdicts are no
  longer yellow: a day that depends on custom is a rose wash and a payment is a
  rose outline, so the only amber left on that screen is the one warning.
  **Group 5, chosen: a, except that suppliers on a phone are b's plain list.**
  Insights are four tiles in the order a morning asks them (what is signed,
  what is late in work, what is late in money, who is waiting), the months
  ahead beside the funnel and the channels beside what became of the
  enquiries, one column on a phone in the same order. The months ahead are
  `cashByMonth` in `lib/analytics.ts`, pure and tested, with the same rules
  as the couple's year strip: only unpaid money, late money counted in this
  month because a chart that grows backwards shows a producer their own
  history of being owed, an empty month still a column, and a payment with no
  date left out of the chart while the figures beside it still count it. Late
  is the wine and nothing on that screen is amber. The supplier book is cards
  three across on a desk and, on a phone, a row per supplier with a circle
  for the initial, because a book of hundreds is read with a thumb and a card
  each is a screen per three; the kinds are a row of pills in place of a
  select, and the scout is a banner whose button opens it.
  **Group 6, chosen in pieces: people first on the producer's desk, the
  season as a card per evening on his phone, and the crew member's evening as
  a list beside one evening.** `/app/crew` is one column whose order is set per
  screen: clashes, then the people as cards in a grid (the one being edited
  takes the whole row, with `:has(details[open])`, because a form does not fit
  in a third of a screen), then the season board, then what to pay; on a phone
  the board comes before the people, because who is on Saturday is what a phone
  is opened for. A card draws how busy somebody is against the busiest.
  The crew member's `/app/shifts/<id>` has the other evenings in a margin from
  `lg` up (`ShiftRail`, read through the same `crew_my_events`), the days left
  as a numeral, and two things for the person working. **An alarm**, which a
  web page cannot set on a phone and can hand the calendar: `alarm.ics` is one
  entry at the call time with a ring before it, read through `crew_my_event`
  like the screen, so it can carry no fee, and there is no file without a call
  time. **A note on any line of the evening**, kept on that phone only: a crew
  member has nowhere to write to, by design in 0091, and a private reminder
  does not need a place. The screen says it is saved on this device.
  **Group 7, chosen: a throughout.** The brand screen is the link as a slim
  banner, the form on one side and what it will look like on the other, sticky
  while the page scrolls (under the fields on a phone); the pictures sit beside
  the form rather than in it, because a form inside a form is dropped by the
  browser while it parses. The store is the shelf and the orders side by side
  from `xl`, and the shelf stays a sortable list: a grid would have broken the
  drag that orders it. The admin screen puts the queue of accounts waiting beside
  the release card, and the release card says the version as a numeral, because
  it is the answer to the question that screen is asked most. The reports are a
  list and the open report, chosen in the address (`?t=`) so a report can be
  sent and a reload keeps it; on a phone the list, then the report with a way
  back. The site editor already had the rail and needed nothing.
- **The screens are the plum design's screens, not only its colours.**
  He asked why the app did not look like the mockups, and the answer was
  that 3.1 had changed the skin and not the layout. So 3.2 rebuilt three:
  the producer's home is a desk of three columns on a wide screen (two on
  a laptop, one on a phone, same order): his own tasks and the folded pile
  first, as he ruled; the season by year in the middle (`SeasonColumn` in
  `components/app/Desk.tsx`), the next event as the filled rose circle,
  which is where the old "next event" card went; and the lead figures and
  the money as bars on one scale on the far side, each row still a way in
  to the same screen it went to before. The figures come from
  `pipelineStats`, the same function the leads board and the morning
  letter use, and `getOverview` now returns `season` and `leads`. Under the
  greeting is the morning in one sentence, each part dropped at zero. The
  phone bar marks the current tab with a rose dot above the word, on the
  card colour, and the "more" button matches it. The couple's band draws
  the days as one 64px number in the light rose beside "ימים לאירוע",
  start-aligned; the one-muted-line rule from the quiet-luxury round is
  overruled by the design he chose. The desk is in `/design` like every
  other component.
- **The palette was HoneyBook's, exactly, read out of their own stylesheet
  rather than guessed from a screenshot.** He asked for it in one sentence
  and his latest instruction wins. White ground, #FFFFFF, with the card
  white on a hairline #E0E5E7 at a 20px corner and the step up #F3F5F6;
  the ink is their near-black #142127 and so is the accent, because their
  one action on a screen is a black pill with a regular-weight label and
  their links are black words underlined. Secondary text #63696C, the
  control edge #7D8488 (theirs is #B0B8BC at 2.0:1 and the 3:1 rule
  outranks it). The brand's one colour is honey, #FFFA56, and it is never
  words and never a ground under words on the light palette: it is
  `--accent-line`, so it is the line under the selected tab and the rule
  under a section (`.rule-gold` is 3px of it, the marker they draw under a
  word), and on the dark band it is the words, at 14.9:1. Statuses are the
  Untitled UI pairs they use, #027A48 on #ECFDF3, #B54708 on #FFFAEB and
  #B42318 on #FEF3F2; `sage` and `blush` carry their mist and oat. Buttons
  are pills (`rounded-button` is 9999px), controls 10px, a surface inside a
  card 12px. Headings are the sans at regular weight and the hierarchy is
  size, so `--font-display` is Heebo again and every `font-display` site
  went from 500 to 400 in one pass; `head-sub`, the small one inside a
  card, keeps 500 because at 17px over a 14px body a regular heading is a
  line of body. Frank Ruhl Libre is reachable only as `font-serif`, for
  the one accent word, which is how their serif is used too. The focus
  ring is a blue, #1E5BD6, because a ring in the ink looks like the button
  it is drawn beside. They have no dark palette, so ours is their black
  band as a whole screen: #142127 under #F3F5F6, the card #1C2B32, the
  step up #25353C, and the action is honey with the ink on it. Five
  producer `night` tones moved two to three percent for the lighter step
  up. The paragraph below is the history of the quiet-luxury move.
- **The ground was a warm cream, #FAF8F4, everywhere, the ink was a warm
  near-black, #1C1A17, and the one accent was a deep bronze, #7A5D33.** That
  was the quiet-luxury brief, in his words: a lot of room, one good face, one
  quiet colour, no noise; hotel, not bank. The card is white on a hairline
  #E6E1D8 and carries no shadow (`shadow-lift` is still a name and draws
  nothing); the step up is #F2EFE9; the statuses are a muted green #3F6A4A,
  amber #7F5A1B and clay #9B4A3C, each solved on its own wash. The dark
  palette is #161411 under #EDE8E0 with the accent lifted to #C9A86C. Every
  one of these clears its bar in `npm run contrast`, which was moved token
  by token in the same commit. Headings are Heebo at 500, never bolder:
  every `font-semibold` and `font-bold` in the product became `font-medium`
  in one pass, and Heebo is loaded at 300, 400 and 500 only.
  Before this it was a pale blue, #F1F4F9 with #4D68A0, and the paragraph
  below is kept as the history of that move.
- The ground was a pale blue, #F1F4F9, everywhere: the app, the public site and
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
- **Two faces were kept for a release: Heebo for everything operated and
  Frank Ruhl Libre, at 300 and 400, for display alone.** Display is Heebo
  again under the HoneyBook entry above; the serif stays loaded for
  `font-serif`. The rest of this entry is the history of that round. The page title,
  the couple's greeting and the one big number on a summary; never a panel
  title, never a table, never bolder than regular. `--font-display` and
  `--font-editorial` resolve to it, `.app-type` no longer overrides it, and
  Hebrew is never tracked, so both tracking tokens are 0. The paragraph
  below is the history of the one-face era and its reasons still hold for
  the body.
- **The typeface was Heebo and there was only one.** Not Heebo for the
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
- **Every side is a logical side, and the check is at zero.** `npm run
  rtl` tokenises every class string under `src` and fails on `ml-`, `mr-`,
  `pl-`, `pr-`, `left-`, `right-`, `border-l`, `border-r`, `rounded-l`,
  `rounded-r`, `text-left` and `text-right`, with two exceptions that are
  physical on purpose: a line that declares `dir="ltr"`, and a token with
  an `ltr:` or `rtl:` prefix. It was written as a ratchet with a baseline
  and the baseline is zero now, because the twenty-one it found were the
  search box's two icons, a form's accent border, and a column of numbers
  aligned "left" by habit where `text-end` is the word. `DESIGN_MIGRATION.md`
  is the brief's §6 as a table of what was removed and what was kept on
  purpose; `design-qa/` holds the harness at 375 and 1280 in both
  palettes. The countdown on the couple's screen is one muted line under
  their name now, not a pill in the accent, because the brief is right
  that a number drawn that way is a timer.

- **The run of show is built from the wedding-day answers, and a secret
  never reaches the couple.** `content/weddingDay.ts` is forty questions
  in six chapters, drawn by the same `Questionnaire` as the intake with
  two more kinds of answer, a time and a table; `lib/runOfShow.ts` turns
  the answers into lines on `day_schedule`, deterministically, from four
  anchors (the reception, the chuppah, the party, the end) with everything
  else derived by the brief's offsets, and three weddings are held in a
  test. Every entrance to the chuppah is its own line with its own song,
  because "the song for entrance four" is what the DJ reads at 19:42.
  Building replaces only lines whose `source` begins `questionnaire:`; a
  line typed by hand is never touched, so "build" after a changed answer
  is the same press as the first. A surprise is `is_secret` with
  `secret_from`: the couple's policy on `day_schedule` excludes it, and
  `forAudience` is the one function every printed version goes through,
  with a test that the couple's version holds none and the DJ's holds the
  songs. The cascade is `shiftAfter`: everything at or after a time moves,
  nothing before it. `runsheet_locked_at` and `runsheet_version` on the
  client are the lock two days out; opening it is a new number, which is
  what a producer says on the phone. The evening writes two columns and
  rewrites nothing: `actual_at` when the night slips, `note_live` between
  two things happening. Not built: the per-audience PDF pipeline (the run
  sheet prints from the browser by audience as before), offline caching of
  the live screen, realtime between two producers, and the supplier
  send-outs.

- **A couple is known from one questionnaire, and the screen bends to
  it.** Six chapters in `content/intake.ts`, fifty-two questions with
  stable keys, answered in stages from a phone by either partner;
  `Questionnaire` draws eleven kinds of answer and saves each one on its
  own eight hundred milliseconds after the typing stops, so nothing is
  lost to a refresh and nobody presses save. The questions are code and
  not a table, because they are Hebrew wording versioned with the product.
  The answers are `questionnaire_responses`, one row per partner per
  question, and a trigger in 0105 derives `couple_profiles` from them so
  every screen reads one row; a node test reads the migration and fails if
  the trigger names a key the content does not ask, or divides by a count
  that is not the number of questions. Three things are private and each
  is a row or a table rather than a column: the "between us" chapter is
  written `private` by the action whatever the form says, and the policy
  hands it to its writer and the producer only; the producer's note on an
  answer is `questionnaire_notes`; and the sensitivities and surprises are
  `couple_profiles_private`, which also holds the one-page meeting brief
  the model writes from the answers. The checklist in `content/timeline.ts`
  carries `needs` on six steps (kashrut, the rabbinate file, a start after
  Shabbat, a kids corner, the after party, outdoor gear), and a blank
  answer keeps the step: a condition that removes a step on a question
  nobody answered removes it from every couple who never opened the
  questionnaire. The greeting is the nickname they asked for, and a card
  under "what now" asks for the rest until seventy percent is answered.

- **The budget is a sheet now, and "paid" is never typed.** `BudgetGrid`
  replaced the list of rows that each opened onto a form: press a cell,
  type, Enter, and every total moves before the server is told. The sheet
  moves first and `patchBudgetCell` is called four hundred milliseconds
  later with one field, so a write that fails puts the one figure back and
  says so rather than losing a form. All the arithmetic is
  `lib/budgetGrid.ts`, pure and tested: VAT on a price quoted without it, a
  hall priced per plate, three payments against one line, `12k` and
  `12 אלף` as numbers. Four things are deliberate. `budget_payments` is a
  table of its own and not more columns on `payments`, because `payments` is
  the couple's schedule to the producer and `ledgerOf` counts it as income;
  a photographer's deposit written there would read as money arriving. The
  producer's note on a line is `budget_item_private`, a table the couple has
  no policy on, for the crew's reason: a private column on a shared row is
  not private. The couple may type into their own sheet, and two figures
  are refused by the action rather than hidden by the screen, the plan once
  they approved it and the agreed price once booked, because the screen is
  not the fence. And `estimate` is still called `estimate`: it is the
  planned figure, fifteen weddings carry it, and a rename is a data
  migration wearing a tidier name. The backfill in 0104 runs inside the
  branch that adds `status`, because sync.sql replays the file every five
  minutes and an unguarded update would put a line back to booked every
  time somebody moved it off. The Excel export writes formulas, not
  values, so a parent who changes one price sees the total move.

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
- **An enquiry is one card, and the same couple twice is one card.** 0102.
  Five doors end in `leads` (the site form, a channel address, the shared
  key, a phone call typed in, `/api/leads/ingest` for anything we write
  ourselves), and before 0102 none of them could recognise a couple who had
  written on Sunday and again on Tuesday. The fold is a `before insert`
  trigger, `leads_fold_twin`, and not a branch in one function, because a
  rule that lives in one of five doors is a rule four of them do not have:
  same producer, same phone in any spelling or the same address, ninety days
  back, not lost, and the second arrival is a `message_in` on the first
  card's timeline. The trigger returns null, which drops the row; a caller
  that needs the id asks `lead_twin()`, and `submit_lead` was dropped and
  re-created to return it. `lead_events` is the timeline: arrival and status
  moves by trigger, messages, calls and readings by the app, `first_response_at`
  stamped by whichever came first. The schema check plants the same number in
  two spellings and proves one row.
- **Then it is read, scored and announced, and each of those is best effort
  beside the row that already exists.** `lib/leadIntake.ts` is where every
  door ends. One fast-model call turns a paragraph into the card's fields, an
  intent and a draft reply, and fills only what is blank; the score is rules
  in `lib/leadScore.ts`, tested, with its reasoning kept beside the number,
  because a score the model invents is a score nobody can explain to the
  producer asking why. Spam is zero and rings nobody. The alert is three
  channels with one text: WhatsApp through the webhook the producer already
  had, a Web Push to every browser they said yes in (`push_subscriptions`,
  VAPID keys in the environment file, no provider), and the bell. Quiet hours
  are the producer's own, in `notification_preferences`, and a lead at 80 or
  more rings through them because that is the one that is answered by whoever
  answers first. The site form runs the intake in `after()`, so the visitor
  is not waiting on a model call. The cron grew `?job=morning` and
  `?job=leads`; both lines are in `ensure-schedule.sh`, which the agent runs.
- **The leads screen is the pipeline, and the select is the real control.**
  Columns by status, moved by `useDragOnto` the way every drag in this app is
  moved, with the select on each card being the implementation and the drag
  the decoration over it. The list view is the old rows handed in by the page,
  so the two views cannot drift. `lib/pipeline.ts` is pure and tested: the
  three figures at the top and the morning letter count the same cards with
  the same function, so they cannot disagree about who is waiting. The card
  page's WhatsApp button writes a `message_out` on press; not because the
  message was certainly sent, but because the first response is the number
  the screen is judged on and the moment the producer reached for the phone
  is the honest stamp for it.
- **What arrives is read, and what is read waits for a yes.** 0103, and the
  rule is in capitals in the brief: nothing a model reads is written to an
  event without a press. `inbox_items` is what arrived, whole; `suggested_actions`
  is what the reading proposes, each a kind from `lib/inbox/kinds.ts`, a
  payload and a sentence; `activity_log` is what happened, written always.
  A payload is validated twice, into the row and again at the press, and
  `applyAction` in `lib/inbox/apply.ts` is the only way a proposal becomes a
  row: it writes exactly the columns the kind allows, checks the event
  belongs to the producer on the action, and ticks a task through
  `toggleTask` like every other tick, because the actions check holds every
  file to that. Whose a message is comes from the sender's phone or address
  first (`lib/inbox/context.ts`) and from the text only when it must, and a
  supplier on three weddings is a medium match on purpose. The doors are
  Resend's receiving webhook, Twilio or Green API for the business WhatsApp
  (each verified the way its maker documents), and a file or a paragraph
  dropped on the event file, which is the door that proves the pipeline with
  no provider at all. Every reading is a line in `ai_calls` with a rough cost.
  **Buckets are rows and sync.sql carries no rows**, so the inbox bucket is
  made at first use by `ensureInboxBucket` rather than by a migration anybody
  has to remember to replay.
- **The guest list a couple actually has is in a chat, not in a spreadsheet.**
  The importer read every paste as a table, which is right for a file out of
  Excel and wrong for the thing people do, which is paste what their mother
  sent on WhatsApp. "דני כהן 050-1234567" is one cell, so the phone went into
  the name, "משפחת לוי 4" became a guest called that, and nothing was reported
  as skipped: two hundred rows that all have to be retyped, under a green
  line saying 183 added. `readGuestList` picks the reader off the text rather
  than off which box it arrived in - most lines having more than one cell is
  a table and anything else is prose - and `readGuestLine` takes a line apart
  instead of splitting it. The phone comes out before the count, because a
  phone ends in digits and a count is digits at the end, and run the other
  way round the last two digits of every number become a party of 67. The
  phone pattern is anchored on the Israeli prefix rather than matching any run
  of digits, because the thing most likely to sit beside a name on a guest
  list is a small number saying how many of them are coming. A plus means one
  more than the person named and every other notation means how many
  altogether, which is the literal reading of each and the single most likely
  thing in the whole importer to be wrong about somebody's list.
- **Which is why it is two presses now.** Pasting two hundred lines and
  pressing once was the only write on that screen with no way back, since
  deleting two hundred guests one at a time is not a recovery, and it was
  also the write most likely to be quietly wrong. So the first press reads
  and shows and the second writes, both running the same two functions over
  the same text, which travels in the form rather than being remembered on a
  server - a server that holds what somebody pasted is a server with their
  guest list sitting in it. The preview puts how many second, directly after
  the name: it was fourth in a 420px table, which on a phone put the one
  figure the table exists for off the side of the screen. A chosen file is
  read into the box rather than posted as a file, because a file input's
  value cannot be filled in by script and the confirm is a second form: a
  file would have been read for the preview and then gone missing at the
  press that writes. It also lets somebody fix a line before importing it.
  The list can move between the two presses if the producer adds somebody in
  another tab, and that is handled rather than guarded - the write dedupes again, so it shows
  up as one more duplicate and never as a doubled guest.
- **And the quick add box had a parser of its own, which was `split(',')`.**
  Two boxes on the same panel coming to different conclusions about the same
  four lines, one of them silently dropping whatever it could not use. It
  reads through the same function now, writes the party size it was never
  writing, and says how many went in and how many lines carried no name: a
  list that swallows two of twelve without a word is a list somebody counts
  by hand later.
- **That file had no tests at all, and it is nothing but judgement.** Which
  line is a header, which run of digits is a phone, who is the same person
  twice. It could not be tested because it imported `@/lib/csv`, and an alias
  is a bare specifier to node, so the test would not have run. One relative
  import with the extension on it was the whole barrier. The preview hands
  back the names it set aside and not only how many: the dedupe rule has one
  way to be wrong, two people genuinely called the same thing with no phone
  between them, and its price is a guest who silently never arrives on the
  list. A number cannot be checked against anything and a name can.
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
- **Every route in the product carried 35KB of gzipped Hebrew, including the
  pages with no app on them.** `CopyProvider` defaulted its context to
  `APP_UI_HE` so that a screen with no provider rendered Hebrew rather than a
  blank panel. The reasoning was good and the cost was invisible: a default is
  an import, `APP_UI_HE` reaches `content/site.ts`, and that file is a quarter
  of a megabyte of wording for every screen there is. One reference from one
  client module keeps the whole object alive through tree-shaking, and that
  was the only one. Every page in the product got 35KB lighter the moment the
  line changed: the guests' page from 240KB gzipped to 205, the shopfront from
  261 to 226, the couple's screen from 413 to 378. (Those were first written
  as 73 to 38 and so on, which was the bundle checker measuring a fifth of the
  page; the saving was always 35KB.) A grandparent opening a wedding
  invitation on a phone was downloading the producer's crew board labels.
  `GameTable` already knew: it writes twenty lines of `Sheet`'s behaviour out
  by hand rather than import it, and says why. So `useCopy()` throws now, and
  the soft failure is replaced by a proof rather than given up:
  `npm run copy` walks what every router mount imports and fails if anything
  that reads the wording sits under no provider. It walks imports rather than
  trusting a list, it covers `loading` and `error` as well as `page` because
  those are mounted in the same place, and it strips comments first - its
  first run reported the card game, whose only `useCopy()` is inside the
  comment explaining why it does not use one. **The one mount that made the
  default load-bearing was `VersionWatch`**, which sits in the root layout
  and so stands over the shopfront, the guests' page and the card game as
  well as the app, none of which has a provider. It takes its wording as a
  prop now, the way `A11yPanel` beside it in the same layout already did.
  The check did not find it: the first version of it walked `src/app/app`
  only, said every screen was covered, and the dev server threw on `/design`
  four seconds later. It walks the whole router now, layouts included, and
  that is the general lesson rather than a detail - a checker that defines
  its own scope will define it as the part somebody was thinking about.
- **And a ceiling, because a bundle grows the way a type scale grows.** One
  reasonable local decision at a time, nobody looking at the total.
  `npm run weigh` reads each route's own client manifest, gzips what that
  route asks for, and fails over a budget - the same answer `npm run type` is
  for font sizes. Three budgets and not sixty, because a number per route is a
  table nobody maintains and because the three are a real distinction: a
  stranger or a guest who followed a link to an invitation gets the tightest,
  the couple's own screen is allowed more because it carries their whole
  wedding, the console is cached after the first load. The sign-in page has a
  fourth of its own, caught by the first run being lumped in with the guests:
  it is the only page that needs the auth client and nobody arrives at it from
  an invitation. `/design` is exempt and that is not a loophole - it mounts
  every component at once, it is a 404 in production, and holding it to a
  budget would mean deleting panels from the harness to stay under a number.
  **The numbers are set just above where the product is, deliberately.** The
  first ones written were round and generous, and the regression the check
  exists to catch would have passed under them with room to spare. It lives
  inside `check:full` rather than beside it, for the reason the next entry
  gives.
  **And for a day it measured a fifth of the truth.** It summed each route's
  own `entryJSFiles` and left out the framework, the runtime and the
  polyfills - Next lists those separately, as `rootMainFiles`, which is
  exactly how they went missing. It reported the privacy page at 37KB and the
  live privacy page downloads 200. The saving it was built to measure was
  real, because before and after were counted the same way; the budgets were
  nonsense, because they were set against a number nobody waits for. It
  surfaced only by fetching the live site after a release and weighing what
  the HTML actually asks for, which is the lesson: **a measurement checked
  against itself is not checked.** Worth knowing when reading the budgets:
  166KB of every one of them is React, Next and the polyfills, the same on
  every page and cached after the first, and nothing in this repository can
  move it. It is counted anyway, because a budget that excluded the largest
  thing on the page would be measuring our own work and calling it the
  visitor's wait.
- **What the measurement did not find is worth as much.** 148 of 257
  components carry `'use client'`, which reads as a boundary drawn far too
  low, and it is not: all but three of them call a hook, and nearly every one
  of those is `useCopy()`. The three that do not are thin wrappers over a
  client child and moving them saves nothing. The next real lever is measured
  and deliberately not taken: the couple's screen is 212KB against an app
  floor of 127, and the difference is the panels behind the six folds, which
  are rendered eagerly because a `<details>` holds its children in the DOM.
  Mounting them lazily would cut it hard and would break the quick-jump,
  because `lib/reveal.ts` opens a fold to reach an anchor and an anchor that
  has not mounted is not there. That is a real piece of work and not a tidy-up.
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
- **A long list drew every row, and the guest list drew every row twice.**
  The guests panel is two layouts, a stack of cards for a phone and a table
  for a desk, with CSS hiding one. That design is right and argued for where
  it is written: six columns is a desktop shape, and a 680px table inside a
  horizontal scroller on a 390px screen asks a thumb to drag sideways inside
  a page that also scrolls down. What it cost is that both are built.
  `display: none` makes the hidden one free to lay out and free to paint, and
  not free to build, so a four hundred guest wedding was eight hundred rows in
  the DOM and eight hundred components in React, half of them for a layout
  nobody on that device can see. `lib/useWide.ts` reads the breakpoint and the
  panel builds one of them. The server does not know how wide a screen is, so
  the server snapshot is `null`, meaning "not known yet": the panel draws both,
  which is byte for byte what it drew before, and the real answer arrives on
  the same tick as hydration and removes the half that was already hidden.
  `useSyncExternalStore` and not an effect, because an effect runs after paint
  and the browser would build both trees and then throw one away.
- **And the rows that are left are skipped while they are off screen.**
  `.rows` in `globals.css` is `content-visibility: auto`, on the guests'
  cards, the supplier book and the ledger. A virtualised list would get the
  same frame rate and take away find-in-page, anchors and the screen reader's
  walk through the whole thing; this keeps all three, because the rows are
  still in the document and only their layout and paint are deferred. **It has
  one sharp edge and it was measured rather than assumed: the same declaration
  on a `<tr>` does nothing at all**, since table layout has to size every row
  to size the columns. So the guests' table gets no help from it, and the only
  way to make a long table cheap is to draw fewer rows. That is not done here:
  a cap would have to change what "select all" means, and the comment above
  that control already says why reaching past what is on screen is wrong.
- **Six of the thirteen things that open over the page gave the keyboard
  back to nothing, and two had no keyboard exit at all.** `check-a11y` prints
  this in its own list of what it cannot test: "close a dialog: focus returns
  to the control that opened it". axe reads a tree and that is a sequence, so
  no automated pass here was ever going to see it. The sharpest one was the
  accessibility menu, under a comment that said "Escape closes, and focus
  goes back to the button that opened it" and did only the first half:
  somebody who reached it by keyboard, turned on larger text and pressed
  Escape was returned to the top of the document. `Shop`'s cart, which is on
  the public site, and the supplier capture, which interrupts a couple
  ticking a task off, had no Escape at all.
  The four behaviours are `lib/useOverlay.ts` now, once: Escape closes it,
  focus moves in and returns to the opener, the page behind holds still, and
  Back closes the panel rather than the screen. **It asks for no wording,
  which is the point** - `GameTable` had written the same twenty lines out by
  hand rather than import `Sheet`, because Sheet reads one label through
  `useCopy()`, and that reason is gone now. `npm run overlays` is what keeps
  the fourteenth from being written without it: it requires the hook rather
  than grepping for something focus-shaped, because a component that reads
  `activeElement` and throws it away is most of how these went wrong. Five
  panels that predate the hook and were checked by hand are named in a list
  the check also fails on if one of them stops being a dialog.
  One thing came out of it that is worth knowing: **a dialog that locks the
  page cannot be left mounted open**, and the harness was holding the
  supplier capture open so it could be looked at, which the moment the lock
  arrived meant `/design` could not scroll. It is behind a button there now,
  which is also the more truthful harness.
- **The event file is the one screen with no title, and the one where it is
  worth the most.** A producer works with six of them open and six tabs all
  reading the same thing is six tabs somebody clicks through. It costs one
  small query of its own, because `generateMetadata` runs beside the page
  rather than inside it, and it is scoped by row level security like
  everything else, so a producer who cannot see the event gets the plain
  title rather than somebody else's names. `/app/sop` still has none and
  should not: it is a redirect that never renders.
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
