-- ============================================================================
--  0096 — a deck the producer opens
-- ============================================================================
--  Seventy-four cards a couple plays through together, months before the
--  wedding, and whose whole point is that the two of them answer separately
--  and then look at each other. It is not part of the platform's workspace and
--  it deliberately does not behave like one: a couple in the game is in the
--  game, on a page with no menu, no tabs and no way back into the app until
--  they close it.
--
--  Two decisions are worth the ink.
--
--  **The switch is the root address's alone.** Not "the producer's": the one
--  account. That is what was asked for, and it is enforced here rather than by
--  hiding a button, because a button is a suggestion. `clients_write` lets any
--  approved producer update their own events, and it should — the date and the
--  venue are theirs. So the column that opens the game is fenced by a trigger
--  instead: change it without being the super admin and the write is refused,
--  whatever wrote it and from wherever. The screen that draws the switch is
--  root-only too, but that is now the second line rather than the only one.
--
--  **The address is the credential, exactly as 0045 did for the guests' page.**
--  A wedding has two people and usually one account between them, so an
--  invitation that demanded a sign-in would be a game one of them can play.
--  The token opens one event's game and nothing else; the function below hands
--  back the two names and the brand and stops there. It cannot reach the
--  budget, the guest list or the brief, because it does not select them.
--
--  Nothing here holds an answer. The game as asked for is open a card, read
--  it, press next — the couple talks, the deck does not listen. If the answers
--  are ever wanted in their file that is a table of its own and a separate
--  conversation; leaving it out now is what keeps this a game rather than a
--  form.
--
--  No row is touched except to mint an address for events that predate this
--  file, and every one of those is minted switched off.
-- ============================================================================


-- ── the two columns ─────────────────────────────────────────────────────────
alter table public.clients
  add column if not exists game_token text,
  add column if not exists game_on    boolean not null default false;

comment on column public.clients.game_token is
  'The unguessable address of this event''s game. Minted by trigger, frozen on '
  'update, and meaningless while game_on is false.';
comment on column public.clients.game_on is
  'The switch, and the super admin''s alone — see guard_game_token() below.';

/* Every event that already exists gets an address now, switched off. Minted
   on demand would mean the link changes the first time it is opened, and a
   link already sent to a couple would then point at nothing. Same reasoning
   as the guests' token in 0045, and the same ordering: the backfill runs
   before the trigger exists, because the trigger's whole job on an update is
   to refuse to let this column move. */
update public.clients
   set game_token = encode(gen_random_bytes(16), 'hex')
 where game_token is null;

create unique index if not exists clients_game_token_idx
  on public.clients (game_token);


-- ── the door, and who is allowed to open it ─────────────────────────────────
--  Two jobs in one trigger because they are one concern: the address of the
--  game and the switch in front of it.
--
--  The token is minted on insert and frozen on update, the same shape as
--  guard_guest_token in 0045 and guard_invite_token in 0006. No search_path
--  pin, for the same reason those two have none: it calls pgcrypto, which
--  lives in `extensions` on Supabase and resolves through the caller's path.
--
--  The switch is refused to everybody but the super admin. `is distinct from`
--  rather than `<>` on purpose: an update that happens to carry the column at
--  its current value is not a change and must not be refused, or every
--  ordinary save on the event file would start failing the day somebody adds
--  game_on to a select list.
create or replace function public.guard_game_token() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.game_token := encode(gen_random_bytes(16), 'hex');
    if new.game_on and not public.is_super_admin() then
      raise exception 'the wedding game is opened by the platform owner only'
        using errcode = 'insufficient_privilege';
    end if;
  else
    new.game_token := old.game_token;
    if new.game_on is distinct from old.game_on and not public.is_super_admin() then
      raise exception 'the wedding game is opened by the platform owner only'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists clients_guard_game_token on public.clients;
create trigger clients_guard_game_token before insert or update on public.clients
  for each row execute function public.guard_game_token();


-- ── what the game reads ─────────────────────────────────────────────────────
--  The two names, the date, and the producer's brand for the footer. That is
--  the whole list, and it is the list for the same reason 0091's crew
--  functions are: a policy grants rows and rows carry columns, so the way to
--  hand a stranger one fact about an event is a function that selects one
--  fact. The deck itself is not in the database at all — it is seventy-four
--  pictures and a manifest in the build, the same for every wedding.
--
--  A switched-off game and a wrong token both return no row, so neither can
--  be told from the other by trying.
create or replace function public.wedding_game(p_token text)
returns table (
  couple     text,
  event_date date,
  producer   text
)
language sql stable security definer set search_path = public as $$
  select c.display_name,
         c.event_date,
         p.brand_name
    from public.clients c
    join public.producers p on p.id = c.producer_id
   where c.game_token = p_token
     and c.game_on
     and c.archived_at is null
   limit 1
$$;

comment on function public.wedding_game(text) is
  'The game''s whole public surface: two names, a date, a brand. Anonymous by '
  'design — a wedding has two people and one account between them.';
