# Liver Productions → Before I Do

Written the night of 30 September 2026, from the diagram he sent. Everything
here was read out of the code rather than remembered. Where something is a
decision rather than a fact, it says so.

The shape he drew:

```
beforeidoevent.co.il   ─301─┐
beforeidoevents.co.il  ─301─┼──→  beforeidoevent.com        the business, he + en
liverproductions.com   ─301─┘           │
                                        ├──→  app.beforeidoevent.com   the platform
                                        └──→  beforeido.co.il          the game
```

---

## The two things that cost real money

Everything else on this page is work. These two are losses, and both are
silent, which is what makes them worth putting first.

### 1. The lead webhooks stop, and nobody is told

`actions/leadChannels.ts` builds every producer's channel address out of
`publicEnv.siteUrl`:

    https://liverproductions.com/api/leads/webhook?c=<token>

Those strings are not in this product. They are pasted into Meta Business
Suite and Google Ads by each producer, by hand, once. The moment `siteUrl`
becomes `beforeidoevent.com`, every address already sitting in an ad console
points at the old domain.

**A 301 does not save them.** The other links in this product are GETs that a
person follows in a browser, and a browser follows a redirect. These are POSTs
from Meta's and Google's own delivery infrastructure, which is not obliged to
follow a redirect and commonly drops the body when it does. The failure is
also the quietest one in the product: a channel that stops delivering looks
exactly like a week nobody enquired.

The money spent on those ads is spent whether or not the lead arrives — that
sentence is already in the header of `api/leads/webhook/route.ts`, and it is
the whole reason this matters more than the tidiness of a redirect.

**So `liverproductions.com/api/leads/webhook` must keep answering for real,
not redirect, until every channel has been re-pasted** — and the only person
who can confirm a re-paste is the producer who owns the ad account.

Two things worth building before the move, and both are small:

- the channel card already has a test button, and it already proves the whole
  path end to end. It should say which host a channel's address is on, so
  "this one is still on the old domain" is readable rather than inferred.
- `lead_channels` has `last_lead_at`. A channel that was delivering and then
  stopped is a fact the database already holds and nothing currently reads.

### 2. Every subscribed calendar doubles — fixed tonight

`PLATFORM_HOST` was one constant doing two jobs: the public address, and the
namespace half of every iCalendar UID. Four feeds mint them — the producer's
calendar, one event's file, the couple's own date, the crew feed — and all
four are *subscribed* to rather than downloaded, so Google and Apple re-read
them forever.

A UID is how a calendar decides whether an event it is handed is one it
already holds. Change the string after the `@` and every subscriber is told
that every event they hold has been withdrawn and a different event has
appeared instead — and the old ones do not leave, because a feed cannot
delete what it has stopped mentioning. A couple who subscribed in March would
have two of their own wedding at the same hour. A crew member would have two
of every shift this season. Nobody could fix that from inside the product.

`UID_HOST` is now its own constant, frozen at `liverproductions.com`, and
deliberately not readable from the environment: a variable is a thing somebody
can set, and the one guarantee this needs is that nobody can. A test asserts
all four feeds use it, that none of them uses `PLATFORM_HOST`, and that the
constant is a literal. The rename is exactly the day somebody reaches for
`PLATFORM_HOST` here, because for a year the two were the same string and it
reads like a tidy-up.

---

## What already works, and is worth knowing before the move

`lib/tenant.ts` was built for this and it holds up:

- `app` is already in `PLATFORM_LABELS`, so `app.beforeidoevent.com` resolves
  to the platform and not to a producer whose slug happens to be "app". The
  file's own header names that exact trap.
- the root domain is read from `NEXT_PUBLIC_ROOT_DOMAIN`, so the tenant
  arithmetic follows the move with one variable.
- `PLATFORM_HOST` is now `NEXT_PUBLIC_PLATFORM_HOST` with the old value as its
  default, so the address moves without a code change and nothing moves until
  somebody sets it.

What does *not* exist yet is the split itself. Routing in this app is by path,
not by host: `/` is the marketing home and `/app/*` is the console, on
whatever host answers. So today `app.beforeidoevent.com/` would serve the
**marketing site**, not the app. Making the subdomain mean something is new
work in `proxy.ts` and it is the main piece of engineering in this migration.

---

## The decision I cannot make for him: one session or two

Every cookie in this product is host-only. There is no `Domain` attribute
anywhere — I checked the Supabase client, the flash cookie and the locale
action. That is not an oversight; the flash cookie carries the `__Host-`
prefix, which *forbids* a Domain by definition, and its comment explains why:
the apex has carried a WordPress install, and a cookie that any host on the
domain could set is an opening this product did not want.

So when the platform moves to `app.beforeidoevent.com`:

**Option A — the session lives on `app.` alone.** Sign-in, the console and the
couple's portal are all under one host. Nothing is shared with the apex,
`__Host-` stays intact, and a producer's own subdomain
(`keren.beforeidoevent.com`) can never see a platform session. The cost is
that the marketing site cannot know whether a visitor is signed in, so its
header says "sign in" to everybody.

**Option B — a session shared across the domain.** Auth cookies get
`Domain=.beforeidoevent.com`. The apex can greet somebody by name. The cost is
real: every subdomain under that root can read the session cookie, and this
product hands subdomains to producers.

**I would take A**, and I would take it without hesitating. "The marketing
page knows your name" is worth very little; "a tenant's subdomain cannot read
the owner's session" is worth a great deal, and it is a property this codebase
has today by accident of never having set a Domain. Option B spends it.

This is his call and nothing should be built until he makes it.

---

## The rest, in the order I would do it

1. **Make the host configurable and prove nothing moved.** Mostly done
   tonight. What is left is `scripts/check-mail.mjs`, which defaults to the
   old domain, and three fixtures in `/design` that name it.
2. **Teach `proxy.ts` what a host means.** `app.<root>` serves the console,
   the apex serves the site. One function, tested the way `tenantOf` is
   tested — pure host arithmetic, no server needed.
3. **The game's own domain.** `beforeido.co.il` is a different registrable
   domain, so nothing is shared with it and nothing needs to be: the game is
   anonymous, the token is the whole credential, and `game_notes` has row
   level security on with not one policy. It is the cleanest piece of this
   migration. The open question is the path — `beforeido.co.il/<token>`
   reads better than `/play/<token>` on a domain that is only the game, and
   that is a one-line rewrite rather than a route move.
4. **The copy.** "Before I Do" is already in the product as the *game's* name,
   in `content/game.ts` and on the portal's own card. The business taking the
   same name is a decision with a consequence worth naming: `beforeido.co.il`
   and `beforeidoevent.com` differ by one word, and the one couples paste to
   each other is the shorter one. Expect mistypes in both directions, and
   make each domain answer for the other rather than 404.
5. **"ברק ליור" is not the brand and must not be swept up.** It is his name,
   it appears in eighteen strings, and in the privacy copy it is the data
   controller. `STATE.md` has the spelling and `CLAUDE.md` records what
   happened the one time it was "corrected". A rebrand touches the business
   name; it does not touch his.

---

## Still open from before this, unchanged

- **`npm run contrast` measures a palette from two redesigns ago.** It carries
  a hard-coded copy — `inkMute: '#6E6C64'` where `globals.css` says `#586782`,
  `surface: '#FCFCFA'` where the ground is `#F1F4F9`. It passes, and it is
  measuring colours the product stopped using. `verify.mjs` already learned
  this lesson and reads its palette from the stylesheet; this script never
  did.
- **Six questions for the legal drafts** — entity, turnover, marketing mail,
  privacy officer, asset licences, and what `/sign` actually concludes.
- **`event_vendors`** — the boundary tests and migration 0069 disagree, and
  `npm run db` fails on it.
