-- ============================================================================
--  0045 — the guests' site
-- ============================================================================
--  The one thing every consumer planner ships and this platform did not: a
--  page the couple can send to everyone they invited. When, where, how to get
--  there, the order of the evening, a few words from the couple, and a way to
--  confirm. Until now a guest only ever got a personal RSVP link, one at a
--  time, and the couple had nothing to paste into the family WhatsApp group.
--
--  Three columns on the event rather than a table of their own: the page is a
--  property of the event, it has no rows of its own, and a join for three
--  fields is a join for nothing.
--
--    guest_token     the unguessable address of the page, minted by trigger
--                    like the RSVP token in 0006, never settable from outside
--    guest_site_on   the switch; a minted token with the switch off is a page
--                    that does not exist, so every event can carry one safely
--    guest_note      the couple's words: dress code, parking, whatever matters
--
--  Two functions are the whole public surface. The table stays shut, exactly
--  as 0006 did for replies: an anonymous visitor can read one event's public
--  face by its token, and can find their own invitation by their own phone
--  number, and nothing else.
-- ============================================================================


-- ── the columns ─────────────────────────────────────────────────────────────
alter table public.clients
  add column if not exists guest_token   text,
  add column if not exists guest_site_on boolean not null default false,
  add column if not exists guest_note    text not null default '';

alter table public.clients
  drop constraint if exists clients_guest_note_len;
alter table public.clients
  add constraint clients_guest_note_len check (char_length(guest_note) <= 1200);

/* Every existing event gets an address now, switched off. Minting on demand
   would mean a page whose URL changes the first time it is switched on, and
   a link already pasted somewhere would then point at nothing. */
update public.clients
   set guest_token = encode(gen_random_bytes(16), 'hex')
 where guest_token is null;

create unique index if not exists clients_guest_token_idx on public.clients (guest_token);


-- ── the token is a credential, so it must not be settable from outside ──────
--  The same shape as guard_invite_token in 0006: minted on insert, frozen on
--  update. No search_path pin on purpose - it calls pgcrypto, which lives in
--  `extensions` on Supabase, and resolves through the caller's path.
create or replace function public.guard_guest_token() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.guest_token := encode(gen_random_bytes(16), 'hex');
  else
    new.guest_token := old.guest_token;
  end if;
  return new;
end $$;
drop trigger if exists clients_guard_guest_token on public.clients;
create trigger clients_guard_guest_token before insert or update on public.clients
  for each row execute function public.guard_guest_token();


-- ── what a guest sees when they open the link ───────────────────────────────
--  Only the public face: names, date, venue, the couple's note, the producer's
--  brand for the footer, and the key moments of the schedule. Not the guest
--  list, not the budget, not the run sheet's staffing lines. A switched-off
--  page returns no row, which the route renders as "not found" - the same
--  answer a wrong token gets, so the two are indistinguishable from outside.
create or replace function public.guest_site(p_token text)
returns table (
  event_name text,
  event_date date,
  venue      text,
  note       text,
  producer   text,
  moments    jsonb
)
language sql stable security definer set search_path = public as $$
  select c.display_name,
         c.event_date,
         c.venue,
         c.guest_note,
         p.brand_name,
         coalesce((
           select jsonb_agg(jsonb_build_object('at', d.at_time, 'title', d.title) order by d.at_time)
             from public.day_schedule d
            where d.client_id = c.id
              and d.key_moment
         ), '[]'::jsonb)
    from public.clients c
    join public.producers p on p.id = c.producer_id
   where c.guest_token = p_token
     and c.guest_site_on
   limit 1
$$;


-- ── a guest finds their own invitation ──────────────────────────────────────
--  By the phone number the invitation was addressed to. Compared on the last
--  nine digits so 050-123-4567 and +972501234567 are the same person, which
--  they are. Hands back only the invitation token, and only on a page that is
--  switched on: the token opens that one guest's own reply and nothing else.
--  The route in front of this rate limits by visitor, so a page's token is
--  not a licence to walk the phone book.
create or replace function public.guest_find(p_token text, p_phone text)
returns text
language sql stable security definer set search_path = public as $$
  select g.invite_token
    from public.guests_rsvp g
    join public.clients c on c.id = g.client_id
   where c.guest_token = p_token
     and c.guest_site_on
     and length(regexp_replace(p_phone, '\D', '', 'g')) >= 9
     and right(regexp_replace(g.phone, '\D', '', 'g'), 9)
         = right(regexp_replace(p_phone, '\D', '', 'g'), 9)
   limit 1
$$;

revoke all on function public.guest_site(text) from public;
revoke all on function public.guest_find(text, text) from public;
grant execute on function public.guest_site(text) to anon, authenticated;
grant execute on function public.guest_find(text, text) to anon, authenticated;
