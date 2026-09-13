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
- `supabase/setup.sql` builds a database from nothing.
  `supabase/sync.sql` brings an existing one up to date and cannot touch a row.
  Both are generated — edit migrations, then run `build-setup-sql.mjs`.

## What he cares about

A version update must never destroy data. He has said so in capitals. Every
answer about the database is written with that as the first question, and
"probably safe" is not an answer — `npm run check` includes a test that proves
it against a real Postgres.
