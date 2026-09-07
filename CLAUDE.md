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
- `supabase/setup.sql` builds a database from nothing.
  `supabase/sync.sql` brings an existing one up to date and cannot touch a row.
  Both are generated — edit migrations, then run `build-setup-sql.mjs`.

## What he cares about

A version update must never destroy data. He has said so in capitals. Every
answer about the database is written with that as the first question, and
"probably safe" is not an answer — `npm run check` includes a test that proves
it against a real Postgres.
