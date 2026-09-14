-- ============================================================================
--  0092 — a crew member has a rate
-- ============================================================================
--  `crew.fee` has been there since 0025 and it is the right column: what this
--  person is paid for THIS evening, which is the figure the margin is worked
--  out from. What was missing is the thing above it. Tal is on nine weddings
--  a year at the same rate, and that rate was typed nine times or, more often,
--  not typed at all — so the ledger read every one of those evenings as if the
--  crew were free.
--
--  So the directory carries the usual rate and the assignment takes a copy of
--  it, exactly the way it already takes a copy of the name. Copy rather than
--  reference, for the reason 0090 gives: raising somebody's rate next March
--  must not quietly rewrite what last August's wedding cost. The number on the
--  evening is what was agreed for that evening, forever.
--
--  Null is a real value on both, and stays one. Half a crew is on a day rate
--  agreed by message and not written anywhere yet, and a column that insists
--  on a number is a column that gets a made-up one.
--
--  Nothing here is readable by a crew member. `crew_my_events` and
--  `crew_my_event` select neither `fee` nor `rate`, and the test in
--  `crewDoor.test.ts` fails if either word ever appears in them: two people
--  working the same evening for different money is normal, and it is not
--  theirs to see.
--
--  Nothing here touches a row. One nullable column, and one function that
--  fills one more field than it did.
-- ============================================================================

alter table public.crew_members
  add column if not exists rate numeric(12,2);

alter table public.crew_members drop constraint if exists crew_members_rate;
alter table public.crew_members add constraint crew_members_rate
  check (rate is null or rate >= 0) not valid;

do $$
begin
  alter table public.crew_members validate constraint crew_members_rate;
exception when check_violation then
  raise notice 'crew_members.rate applies to new rows; some existing rows are outside the rule.';
end $$;

comment on column public.crew_members.rate is
  'What this person usually costs for an evening. Copied onto crew.fee at assignment, never read '
  'through afterwards: raising a rate must not rewrite what an old event cost. Producer-only.';


-- ── the assignment takes the rate with the name ─────────────────────────────
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
    /* Already on this evening: a change of role, not a second card. The fee
       is deliberately left alone — it may have been negotiated for this
       evening, and moving somebody from assistant to manager is not a reason
       to throw that away and put the list price back. */
    update public.crew set slot = p_slot where id = v_id;
    return v_id;
  end if;

  insert into public.crew (client_id, crew_member_id, name, role, phone, slot, fee)
  values (p_client, m.id, m.name, coalesce(p_slot, ''), m.phone, p_slot, m.rate)
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.assign_crew(uuid, uuid, text) from public;
grant execute on function public.assign_crew(uuid, uuid, text) to authenticated, service_role;
