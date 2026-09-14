-- ============================================================================
--  0093 — hours on top of the fee
-- ============================================================================
--  The fee is what was agreed for the evening, and most evenings it is the
--  whole story. Then the wedding runs until three, everybody stays, and two
--  people are owed something the agreed figure does not cover.
--
--  That has always been settled by message and remembered wrong. So the
--  assignment carries the hours and the rate they are paid at, and what
--  somebody is owed for an evening is:
--
--      fee + extra_hours × hour_rate
--
--  Three columns rather than one "extra" amount, because the amount is the
--  thing that gets forgotten and the hours are the thing that gets argued
--  about. A number of hours beside an hourly rate can be checked against
--  somebody's memory of the night; a lump sum cannot.
--
--  The rate is copied onto the assignment the same way the fee is, and for
--  the same reason 0090 and 0092 give: raising somebody's hourly rate next
--  March must not rewrite what last August's overrun cost.
--
--  Nulls everywhere, deliberately. Most evenings have no extra hours, and an
--  hourly rate nobody has agreed is not zero.
--
--  None of this reaches a crew member: `crew_my_events` and `crew_my_event`
--  select none of these columns, and `crewDoor.test.ts` fails on the words.
--
--  Nothing here touches a row.
-- ============================================================================

-- ── what an hour of overrun costs, usually ──────────────────────────────────
alter table public.crew_members
  add column if not exists hour_rate numeric(12,2);

alter table public.crew_members drop constraint if exists crew_members_hour_rate;
alter table public.crew_members add constraint crew_members_hour_rate
  check (hour_rate is null or hour_rate >= 0) not valid;

do $$
begin
  alter table public.crew_members validate constraint crew_members_hour_rate;
exception when check_violation then
  raise notice 'crew_members.hour_rate applies to new rows.';
end $$;

comment on column public.crew_members.hour_rate is
  'What an extra hour usually costs for this person. Copied onto crew.hour_rate at assignment '
  'and never read through afterwards. Producer-only.';


-- ── and what actually happened on the night ─────────────────────────────────
alter table public.crew
  add column if not exists extra_hours numeric(6,2);
alter table public.crew
  add column if not exists hour_rate numeric(12,2);

alter table public.crew drop constraint if exists crew_hours;
alter table public.crew add constraint crew_hours
  check (
    (extra_hours is null or (extra_hours >= 0 and extra_hours <= 24))
    and (hour_rate is null or hour_rate >= 0)
  ) not valid;

do $$
begin
  alter table public.crew validate constraint crew_hours;
exception when check_violation then
  raise notice 'crew.extra_hours applies to new rows; some existing rows are outside the rule.';
end $$;

comment on column public.crew.extra_hours is
  'Hours worked beyond what the fee covers, on this evening. Paid at crew.hour_rate. '
  'Hours rather than a lump sum on purpose: an amount is what gets forgotten, hours are what '
  'can be checked against somebody''s memory of the night.';


-- ── the assignment takes the hourly rate with the fee ───────────────────────
create or replace function public.assign_crew(p_client uuid, p_member uuid, p_slot text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare m record; v_id uuid;
begin
  if not public.owns_producer(public.producer_of_client(p_client))
     and not public.is_super_admin() then
    raise exception 'אין הרשאה' using errcode = 'insufficient_privilege';
  end if;

  if p_slot is not null and p_slot not in ('manager','assistant','social') then
    raise exception 'תפקיד לא מוכר' using errcode = 'check_violation';
  end if;

  select * into m from public.crew_members
   where id = p_member
     and (public.owns_producer(producer_id) or public.is_super_admin());
  if not found then
    raise exception 'איש הצוות לא נמצא' using errcode = 'no_data_found';
  end if;

  select id into v_id from public.crew
   where client_id = p_client and crew_member_id = p_member limit 1;
  if found then
    /* Already on this evening: a change of role, not a second card. The money
       is left alone — it may have been negotiated for this night, and moving
       somebody between roles is not a reason to put the list price back. */
    update public.crew set slot = p_slot where id = v_id;
    return v_id;
  end if;

  insert into public.crew
    (client_id, crew_member_id, name, role, phone, slot, fee, hour_rate)
  values
    (p_client, m.id, m.name, coalesce(p_slot, ''), m.phone, p_slot, m.rate, m.hour_rate)
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.assign_crew(uuid, uuid, text) from public;
grant execute on function public.assign_crew(uuid, uuid, text) to authenticated, service_role;
