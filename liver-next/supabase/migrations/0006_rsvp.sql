-- ============================================================================
--  0006 — guests answering their own invitation
-- ============================================================================
--  A guest has no account and never will, so the reply has to work from a
--  link alone. The tempting shortcut is to let anonymous callers read the
--  guest table filtered by token, but a policy like that is one mistaken
--  query away from handing over an entire guest list — names, phones and all.
--
--  So the table stays closed to anonymous callers entirely, and two
--  security definer functions are the only way in. Each takes a token,
--  touches exactly the row that token belongs to, and returns only what that
--  guest needs to see about their own invitation and the event.
-- ============================================================================

-- how many people this guest actually brings, for counting
alter table public.guests_rsvp
  add column if not exists reminded_at timestamptz;

-- ── what the guest sees when they open their link ───────────────────────────
create or replace function public.rsvp_lookup(p_token text)
returns table (
  guest_name  text,
  event_name  text,
  event_date  date,
  venue       text,
  status      rsvp_state,
  party_size  int,
  diet        diet_pref,
  note        text,
  responded   boolean
)
language sql stable security definer set search_path = public as $$
  select g.full_name, c.display_name, c.event_date, c.venue,
         g.status, g.party_size, g.diet, g.note,
         g.responded_at is not null
    from public.guests_rsvp g
    join public.clients c on c.id = g.client_id
   where g.invite_token = p_token
   limit 1
$$;

-- ── the reply itself ────────────────────────────────────────────────────────
--  Returns whether a row was actually matched, so a wrong or expired link is
--  told plainly instead of appearing to succeed.
create or replace function public.rsvp_respond(
  p_token      text,
  p_status     rsvp_state,
  p_party_size int,
  p_diet       diet_pref,
  p_note       text
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  hit int;
  size int;
begin
  if p_status not in ('attending','declined') then
    raise exception 'a reply is either attending or declined';
  end if;

  -- somebody who is not coming brings nobody, whatever the form said
  size := case when p_status = 'declined' then 0
               else greatest(1, least(coalesce(p_party_size, 1), 20)) end;

  update public.guests_rsvp
     set status = p_status,
         party_size = size,
         diet = coalesce(p_diet, 'none'),
         note = coalesce(left(p_note, 500), ''),
         responded_at = now()
   where invite_token = p_token;

  get diagnostics hit = row_count;
  return hit > 0;
end $$;

-- the functions are the whole public surface; the table itself stays shut
revoke all on function public.rsvp_lookup(text) from public;
revoke all on function public.rsvp_respond(text, rsvp_state, int, diet_pref, text) from public;
grant execute on function public.rsvp_lookup(text) to anon, authenticated;
grant execute on function public.rsvp_respond(text, rsvp_state, int, diet_pref, text) to anon, authenticated;

-- ── the token is a credential, so it must not be settable from outside ──────
create or replace function public.guard_invite_token() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.invite_token := encode(gen_random_bytes(16), 'hex');
  else
    new.invite_token := old.invite_token;
  end if;
  return new;
end $$;
drop trigger if exists guests_guard_token on public.guests_rsvp;
create trigger guests_guard_token before insert or update on public.guests_rsvp
  for each row execute function public.guard_invite_token();

create index if not exists guests_token_lookup on public.guests_rsvp(invite_token);
