-- ============================================================================
--  0091 — a crew member can read their own evening
-- ============================================================================
--  0090 put the crew in a directory and on events. It did not let any of them
--  in. Tal is assigned to a wedding and still finds out where to be, when, and
--  with what by asking — which is the phone call the whole platform exists to
--  stop.
--
--  This is a third audience, after the producer and the couple, and it is the
--  narrowest of the three. Everything about how it is built follows from one
--  decision: **no row level security policy is widened**. Not one of the
--  existing tables gains a policy for this role. A crew member reads through
--  two security-definer functions that return exactly the columns they may
--  see, and nothing else in the database answers them at all.
--
--  That is deliberate, and it is the safer of the two designs by a distance.
--  A policy saying "staff may read clients they are crewed on" would also let
--  them select every other column of that row — the budget target, the
--  contact's phone, the brief — because a policy grants rows, not columns. The
--  fee on their own crew row is the sharpest case: two people working the same
--  evening for different money is normal and is not theirs to see. So the
--  functions below never select it.
--
--  What a crew member gets: the events they are on, and for each one the date,
--  the place, their own call time, their own role, the note written to them,
--  the run sheet, the kit list, and the producer's notes for the crew. That is
--  the list that was asked for, and it stops exactly there.
--
--  `clients.crew_note` is new rather than reusing `brief`: the brief is the
--  producer's own working note about the couple and has money and opinions in
--  it. A field written *to* the crew is a different field, and pointing the
--  crew at an existing one would have published nine months of private notes
--  the first time somebody was assigned.
--
--  Nothing here touches a row. Two nullable columns and two functions.
-- ============================================================================

-- ── the person behind the crew row ──────────────────────────────────────────
alter table public.crew_members
  add column if not exists profile_id uuid references public.profiles(id) on delete set null;

create index if not exists crew_members_profile_idx
  on public.crew_members (profile_id) where profile_id is not null;

-- ── what the producer wants the crew to know ────────────────────────────────
alter table public.clients
  add column if not exists crew_note text not null default '';

comment on column public.clients.crew_note is
  'Written to the crew and read by them. Deliberately not `brief`, which is the '
  'producer''s own note about the couple and has money in it.';


-- ── a signed-up address that is on somebody''s crew ─────────────────────────
--  Same shape as the couple''s route in 0022: the decision about what an
--  account is happens once, at the door, rather than in every screen.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  addr       text := nullif(lower(btrim(coalesce(new.email, ''))), '');
  tel        text := public.normalize_phone(new.phone);
  is_root    boolean;
  is_invited boolean;
  is_crew    boolean;
  existing   uuid;
  new_role   app_role;
begin
  select id into existing from public.profiles
   where (tel is not null and phone = tel)
      or (addr is not null and lower(email) = addr)
   limit 1;

  if existing is not null then
    update public.profiles
       set phone = coalesce(phone, tel),
           email = coalesce(email, addr)
     where id = existing;
    return new;
  end if;

  is_root := addr is not null and addr = public.root_admin_email();

  is_invited := exists (
    select 1 from public.client_authorized_emails e
     where (addr is not null and e.email is not null and lower(e.email) = addr)
        or (tel is not null and e.phone is not null and e.phone = tel)
  );

  /* On somebody's crew list, by address. Not by phone: a crew phone number is
     typed for ringing at eleven at night and is not an identity anybody
     checked, and a wrong digit would hand a stranger an evening. */
  is_crew := addr is not null and exists (
    select 1 from public.crew_members m
     where nullif(btrim(m.email), '') is not null
       and lower(btrim(m.email)) = addr
       and m.archived_at is null
  );

  /* An invited couple outranks a crew list. The couple's address is bound to
     one event and is the more specific claim; a producer who also has that
     address in their crew list is the unusual case, and the couple's own
     screen is the one they are expecting. */
  new_role := case
    when is_root    then 'super_admin'::app_role
    when is_invited then 'client'::app_role
    when is_crew    then 'staff'::app_role
    else 'producer'::app_role
  end;

  insert into public.profiles (id, email, full_name, role, phone)
  values (new.id, addr, coalesce(new.raw_user_meta_data->>'full_name',''), new_role, tel)
  on conflict (id) do nothing;

  if is_invited then
    update public.client_authorized_emails
       set profile_id = new.id
     where profile_id is null
       and ((addr is not null and email is not null and lower(email) = addr)
         or (tel is not null and phone is not null and phone = tel));
  end if;

  if is_crew then
    update public.crew_members
       set profile_id = new.id
     where profile_id is null and lower(btrim(email)) = addr;
  end if;

  /* Staff get no workspace. They are somebody else's crew, not a business. */
  if new_role in ('producer','super_admin') then
    insert into public.producers (owner_id, brand_name, contact_name, contact_email, status)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'brand_name',''),
      coalesce(new.raw_user_meta_data->>'full_name',''),
      coalesce(addr, ''),
      case when is_root then 'approved'::producer_state else 'pending'::producer_state end
    );
  end if;

  return new;
end $$;


-- ── added to a crew after they already had an account ───────────────────────
--  Without this, somebody who signed up first stays whatever they were and
--  never sees the evening they were put on.
create or replace function public.bind_crew_email() returns trigger
language plpgsql security definer set search_path = public as $$
declare p record; addr text := nullif(lower(btrim(coalesce(new.email, ''))), '');
begin
  if addr is null then
    return new;
  end if;

  select id, role into p from public.profiles where lower(email) = addr limit 1;
  if not found then
    return new;
  end if;

  new.profile_id := p.id;

  /* Never demote the root account, never demote a couple away from the event
     they are planning, and never demote a producer who owns an approved
     workspace. Being on a crew list is the weakest claim of the four, so it
     only ever applies to somebody who has nothing else. */
  if p.role = 'producer'
     and not exists (select 1 from public.producers pr
                     where pr.owner_id = p.id and pr.status = 'approved') then
    update public.profiles set role = 'staff' where id = p.id;
  end if;

  return new;
end $$;

drop trigger if exists crew_members_bind on public.crew_members;
create trigger crew_members_bind
  before insert or update of email on public.crew_members
  for each row execute function public.bind_crew_email();


-- ── the evenings this person is on ──────────────────────────────────────────
--  Definer, and the only door. The columns listed here are the whole of what
--  a crew member can ever learn from this platform.
create or replace function public.crew_my_events()
returns table (
  client_id    uuid,
  display_name text,
  event_date   date,
  venue        text,
  slot         text,
  role         text,
  call_time    time,
  note         text,
  brand        text
)
language sql stable security definer set search_path = public as $$
  select
    c.id, c.display_name, c.event_date, coalesce(c.venue, ''),
    w.slot, w.role, w.call_time, w.notes, coalesce(p.brand_name, '')
  from public.crew w
  join public.clients   c on c.id = w.client_id
  join public.producers p on p.id = c.producer_id
  join public.crew_members m on m.id = w.crew_member_id
  where c.archived_at is null
    and (
      m.profile_id = auth.uid()
      or (nullif(btrim(m.email), '') is not null
          and lower(btrim(m.email)) = lower(coalesce(auth.jwt() ->> 'email', '')))
    )
  order by c.event_date nulls last, c.display_name;
$$;

revoke all on function public.crew_my_events() from public;
grant execute on function public.crew_my_events() to authenticated;

comment on function public.crew_my_events is
  'Every event the signed-in crew member is on. No fee, no budget, no contact details: '
  'a definer function rather than a policy, because a policy grants rows and rows carry columns.';


-- ── one of those evenings, in full ──────────────────────────────────────────
create or replace function public.crew_my_event(p_client uuid)
returns json
language plpgsql stable security definer set search_path = public as $$
declare mine record; out json;
begin
  /* The same test as the list above, and it is the only authorisation in this
     function: if the caller is not on this evening there is nothing to
     return, and no part of the query below runs. */
  select w.slot, w.role, w.call_time, w.notes
    into mine
    from public.crew w
    join public.crew_members m on m.id = w.crew_member_id
   where w.client_id = p_client
     and (
       m.profile_id = auth.uid()
       or (nullif(btrim(m.email), '') is not null
           and lower(btrim(m.email)) = lower(coalesce(auth.jwt() ->> 'email', '')))
     )
   limit 1;

  if not found then
    return null;
  end if;

  select json_build_object(
    'event', (
      select json_build_object(
        'id', c.id, 'name', c.display_name, 'date', c.event_date,
        'venue', coalesce(c.venue, ''), 'crewNote', c.crew_note,
        'brand', coalesce(p.brand_name, '')
      )
      from public.clients c
      join public.producers p on p.id = c.producer_id
      where c.id = p_client
    ),
    'mine', json_build_object(
      'slot', mine.slot, 'role', mine.role,
      'callTime', mine.call_time, 'note', mine.notes
    ),
    /* The run sheet, which is the answer to "when am I doing what". */
    'schedule', coalesce((
      select json_agg(json_build_object(
        'id', d.id, 'at', d.at_time, 'title', d.title, 'note', d.note, 'track', d.track
      ) order by d.at_time)
      from public.day_schedule d where d.client_id = p_client
    ), '[]'::json),
    /* The kit, which is the answer to "what am I bringing". */
    'kit', coalesce((
      select json_agg(json_build_object(
        'id', e.id, 'item', e.item, 'needed', e.needed, 'sorted', e.sorted, 'note', e.note
      ) order by e.item)
      from public.event_equipment e where e.client_id = p_client
    ), '[]'::json),
    /* Who else is on it, by name and role alone. Not their phone, not their
       fee: knowing there are two other people and what they are doing is what
       the evening needs, and the rest is the producer's to hand out. */
    'crew', coalesce((
      select json_agg(json_build_object('name', w2.name, 'slot', w2.slot, 'role', w2.role)
        order by w2.call_time nulls last, w2.name)
      from public.crew w2 where w2.client_id = p_client
    ), '[]'::json)
  ) into out;

  return out;
end $$;

revoke all on function public.crew_my_event(uuid) from public;
grant execute on function public.crew_my_event(uuid) to authenticated;

comment on function public.crew_my_event is
  'One evening, for somebody working it. Returns null rather than raising when the caller '
  'is not on it, because "you are not on this event" and "this event does not exist" are '
  'the same answer to somebody who should not be asking.';
