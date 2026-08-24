-- ============================================================================
--  0027 — a calendar subscription that a calendar can actually read
-- ============================================================================
--  Both .ics routes authenticate with a cookie, which works when a person
--  clicks a link in a browser they are signed into, and never works for the
--  thing those files exist for. Apple Calendar and Google Calendar fetch a
--  subscription from their own servers, on a schedule, with no cookies at all.
--  Handed a cookie-protected URL they get a redirect to the sign-in page and
--  subscribe to nothing.
--
--  This fails in the worst way available: the webcal:// link opens the
--  calendar app, the app says it subscribed, and the calendar is simply empty
--  forever. Nobody reports it, because it looks like it worked.
--
--  So a feed is addressed by a secret in its own URL. That is how every
--  calendar subscription on the internet works, and it has the property that
--  comes with it: the URL is the credential. Anyone holding it can read that
--  feed. Which is why it is long, random, revocable, and scoped to exactly one
--  producer's diary or one couple's event and nothing else.
-- ============================================================================

create table if not exists public.calendar_feeds (
  id         uuid primary key default gen_random_uuid(),
  /* The secret in the URL. Long enough that guessing is not a strategy, and
     url-safe so no mail client mangles it on the way. */
  token      text not null unique,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  /* Null means the whole diary. Set means one event, which is what a couple
     subscribes to. */
  client_id  uuid references public.clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  /* Revoked rather than deleted, so a feed that leaked stops working and the
     row stays as a record that it existed. */
  revoked_at timestamptz,
  constraint calendar_feeds_token_len check (length(token) >= 32)
);

create index if not exists calendar_feeds_owner_idx
  on public.calendar_feeds (profile_id, client_id);

comment on table public.calendar_feeds is
  'A secret URL a calendar app can fetch without a session. The token is the '
  'credential: long, random, revocable, and scoped to one diary or one event.';

alter table public.calendar_feeds enable row level security;

/* A person may see and revoke their own feeds. Nobody reads anybody else's,
   including the root admin: a calendar subscription is a credential, and there
   is no reason for an administrator to hold somebody else's. */
drop policy if exists calendar_feeds_own on public.calendar_feeds;
create policy calendar_feeds_own on public.calendar_feeds for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

grant select, insert, update, delete on public.calendar_feeds to authenticated;
grant select on public.calendar_feeds to service_role;


-- ── asking for your own subscription link ───────────────────────────────────
--  One per person per scope, reused rather than piling up: pressing the button
--  twice should hand back the same address, or every press would leave another
--  working credential behind that nobody remembers to revoke.
create or replace function public.calendar_feed_token(p_client uuid default null)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_token text;
begin
  if auth.uid() is null then
    raise exception 'אין הרשאה' using errcode = 'insufficient_privilege';
  end if;

  /* A feed for one event is only for somebody who may read that event. */
  if p_client is not null and not public.can_read_client(p_client) then
    raise exception 'אין הרשאה' using errcode = 'insufficient_privilege';
  end if;

  select token into v_token
    from public.calendar_feeds
   where profile_id = auth.uid()
     and client_id is not distinct from p_client
     and revoked_at is null
   limit 1;

  if found then return v_token; end if;

  /* 32 bytes from the same source the rest of this schema trusts, in url-safe
     base64 so no mail client, QR code or calendar app mangles it. */
  v_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');

  insert into public.calendar_feeds (token, profile_id, client_id)
  values (v_token, auth.uid(), p_client);

  return v_token;
end $$;

revoke all on function public.calendar_feed_token(uuid) from public;
grant execute on function public.calendar_feed_token(uuid) to authenticated, service_role;


-- ── turning a leaked link off ───────────────────────────────────────────────
create or replace function public.revoke_calendar_feed(p_client uuid default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.calendar_feeds
     set revoked_at = now()
   where profile_id = auth.uid()
     and client_id is not distinct from p_client
     and revoked_at is null;
end $$;

revoke all on function public.revoke_calendar_feed(uuid) from public;
grant execute on function public.revoke_calendar_feed(uuid) to authenticated, service_role;


-- ── what a calendar app is allowed to read with that token ──────────────────
--  The one function anonymous may call. It takes the secret and returns dated
--  rows, and it is deliberately the narrowest thing that can produce a
--  calendar: no ids to follow, no money the couple should not see, and nothing
--  at all for a token that is unknown or revoked.
--
--  A producer's diary carries their events, their dated tasks and their dated
--  payments. A couple's feed carries their event and its run sheet, which is
--  what they actually want on the morning.
create or replace function public.calendar_by_token(p_token text)
returns table (starts_on date, at_time time, title text, detail text, kind text)
language plpgsql security definer set search_path = public as $$
declare f record;
begin
  select cf.profile_id, cf.client_id into f
    from public.calendar_feeds cf
   where cf.token = p_token and cf.revoked_at is null
   limit 1;

  if not found then return; end if;

  if f.client_id is null then
    -- the producer's whole diary
    return query
      select c.event_date, null::time, c.display_name,
             coalesce(nullif(c.venue, ''), ''), 'event'
        from public.clients c
        join public.producers pr on pr.id = c.producer_id
       where pr.owner_id = f.profile_id
         and c.archived_at is null
         and c.event_date is not null;

    return query
      select t.due_on, null::time, t.title, coalesce(c.display_name, ''), 'task'
        from public.tasks t
        join public.clients c on c.id = t.client_id
        join public.producers pr on pr.id = c.producer_id
       where pr.owner_id = f.profile_id
         and c.archived_at is null
         and t.due_on is not null
         and not t.done;

    return query
      select p.due_on, null::time, p.title,
             coalesce(c.display_name, '') ||
               case when p.amount is not null then ' · ₪' || round(p.amount)::text else '' end,
             'payment'
        from public.payments p
        join public.clients c on c.id = p.client_id
        join public.producers pr on pr.id = c.producer_id
       where pr.owner_id = f.profile_id
         and c.archived_at is null
         and p.due_on is not null
         and not p.paid;
  else
    -- one event, for the couple
    return query
      select c.event_date, null::time, c.display_name,
             coalesce(nullif(c.venue, ''), ''), 'event'
        from public.clients c
       where c.id = f.client_id and c.event_date is not null;

    return query
      select c.event_date, d.at_time, d.title, coalesce(d.note, ''), 'schedule'
        from public.day_schedule d
        join public.clients c on c.id = d.client_id
       where d.client_id = f.client_id
         and c.event_date is not null;
  end if;
end $$;

revoke all on function public.calendar_by_token(text) from public;
grant execute on function public.calendar_by_token(text) to anon, authenticated, service_role;
