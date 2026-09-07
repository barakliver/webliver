-- ============================================================================
--  0056 — the faces the photographer must not miss, and the looks
-- ============================================================================
--  Two things every wedding needs written down and neither had anywhere to go.
--
--  The first is a face. "Don't miss grandma" is the single most common
--  instruction a photographer is given and the least reliable: it arrives as a
--  sentence in a WhatsApp thread three weeks earlier, addressed to somebody
--  who has never met her, about a room of two hundred people. A name and a
--  photograph on one sheet is the whole of the fix.
--
--  The second is a look. Hair, makeup and outfit references live in a couple's
--  camera roll and reach the stylist as a screenshot of a screenshot, or not
--  at all. They belong on the event, next to the schedule that says when the
--  stylist arrives.
--
--  Both hang off the event, not off a person. That is the difference between
--  this and the version that was sketched: a roster keyed to an account gives
--  a producer with twenty weddings one list with everybody's grandmother in
--  it, and gives a couple's own producer no access at all. `client_id` here
--  means what it means everywhere else in this schema — the event.
--
--  Read and write follow can_read_client, the same rule as the schedule and
--  the checklist: the producer who owns the event, and the couple invited onto
--  it, both hold and both edit. Between them there is nothing to negotiate;
--  the couple knows who the aunt is and the producer knows what the
--  photographer needs.
-- ============================================================================

-- ── the faces ───────────────────────────────────────────────────────────────
create table if not exists public.event_vips (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  name       text not null,
  relation   text not null default '',
  photo_url  text,
  note       text not null default '',
  /* Hand ordered. A photographer works down this list in the order the
     couple thinks of them, which is not alphabetical and not chronological. */
  sort       integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  alter table public.event_vips add constraint event_vips_name_len check (char_length(name) between 1 and 80);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.event_vips add constraint event_vips_relation_len check (char_length(relation) <= 60);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.event_vips add constraint event_vips_note_len check (char_length(note) <= 400);
exception when duplicate_object then null; end $$;

create index if not exists event_vips_client_idx on public.event_vips(client_id, sort);

alter table public.event_vips enable row level security;
drop policy if exists event_vips_all on public.event_vips;
create policy event_vips_all on public.event_vips for all
  using      (public.can_read_client(client_id))
  with check (public.can_read_client(client_id));

comment on table public.event_vips is
  'The people a photographer must not miss, with a face. Keyed to the event, '
  'so a producer running twenty weddings has twenty rosters and not one.';

-- ── the looks ───────────────────────────────────────────────────────────────
do $$ begin create type prep_look as enum ('hair','makeup','outfit','other');
  exception when duplicate_object then null; end $$;

create table if not exists public.event_looks (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  category   prep_look not null default 'other',
  image_url  text not null,
  note       text not null default '',
  sort       integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  alter table public.event_looks add constraint event_looks_note_len check (char_length(note) <= 400);
exception when duplicate_object then null; end $$;

create index if not exists event_looks_client_idx on public.event_looks(client_id, category, sort);

alter table public.event_looks enable row level security;
drop policy if exists event_looks_all on public.event_looks;
create policy event_looks_all on public.event_looks for all
  using      (public.can_read_client(client_id))
  with check (public.can_read_client(client_id));

comment on table public.event_looks is
  'Hair, makeup and outfit references for one event. The stylist reads them '
  'through a share link; nobody signs in to look at a picture.';

-- ── the link a stylist or a photographer opens ──────────────────────────────
--  A supplier is not going to open an account to look at eight photographs,
--  so this is the same door 0037 opened for a contract and 0045 for the
--  guests: a long random token, and no account behind it.
--
--  The token is minted by the database and frozen on update, like every other
--  token in this schema. A credential a browser can choose is not a
--  credential.
create table if not exists public.event_prep_shares (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  token      text not null,
  /* What this particular link opens. A photographer has no business in
     somebody's makeup references and a stylist has none in a family roster,
     and one link that opens everything is the link that gets forwarded. */
  scope      text not null default 'all' check (scope in ('all','faces','looks')),
  label      text not null default '',
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists event_prep_shares_token_idx on public.event_prep_shares(token);
create index if not exists event_prep_shares_client_idx on public.event_prep_shares(client_id);

alter table public.event_prep_shares enable row level security;
drop policy if exists event_prep_shares_all on public.event_prep_shares;
create policy event_prep_shares_all on public.event_prep_shares for all
  using      (public.can_read_client(client_id))
  with check (public.can_read_client(client_id));

create or replace function public.guard_prep_token() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.token := encode(gen_random_bytes(16), 'hex');
  else
    new.token := old.token;
  end if;
  return new;
end $$;

drop trigger if exists prep_shares_guard_token on public.event_prep_shares;
create trigger prep_shares_guard_token before insert or update on public.event_prep_shares
  for each row execute function public.guard_prep_token();

-- ── what the holder of a link actually gets ─────────────────────────────────
--  A function that takes the token, and no anonymous policy on either table.
--  That distinction is the whole security of this feature and it is worth
--  stating plainly, because the obvious alternative looks equivalent and is
--  not: a SELECT policy saying "readable if a share row exists for this
--  event" never sees the token the caller presented. It answers yes to
--  anybody who asks, for every event that has ever been shared once.
--
--  Here the token is an argument. No token, no row, whatever else is true.
create or replace function public.prep_sheet(p_token text)
returns table (
  event_name text,
  event_date date,
  venue      text,
  producer   text,
  scope      text,
  faces      jsonb,
  looks      jsonb
)
language sql stable security definer set search_path = public as $$
  with grant_row as (
    select s.client_id, s.scope
      from public.event_prep_shares s
     where s.token = p_token
       and s.revoked_at is null
       and (s.expires_at is null or s.expires_at > now())
     limit 1
  )
  select
    c.display_name,
    c.event_date,
    c.venue,
    coalesce(nullif(pr.brand_name, ''), nullif(pr.contact_name, ''), ''),
    g.scope,
    case when g.scope in ('all','faces') then coalesce((
      select jsonb_agg(jsonb_build_object(
               'name', v.name, 'relation', v.relation,
               'photo_url', v.photo_url, 'note', v.note)
             order by v.sort, v.created_at)
        from public.event_vips v where v.client_id = g.client_id
    ), '[]'::jsonb) else '[]'::jsonb end,
    case when g.scope in ('all','looks') then coalesce((
      select jsonb_agg(jsonb_build_object(
               'category', l.category, 'image_url', l.image_url, 'note', l.note)
             order by l.category, l.sort, l.created_at)
        from public.event_looks l where l.client_id = g.client_id
    ), '[]'::jsonb) else '[]'::jsonb end
  from grant_row g
  join public.clients c on c.id = g.client_id
  left join public.producers pr on pr.id = c.producer_id
$$;

comment on function public.prep_sheet(text) is
  'Everything a share link opens, and nothing else. The token is an argument '
  'rather than a condition inside a policy, which is what makes it a '
  'credential: a policy asking whether a share row exists cannot see which '
  'token was presented and would answer yes to anybody.';

revoke all on function public.prep_sheet(text) from public;
grant execute on function public.prep_sheet(text) to anon, authenticated;
