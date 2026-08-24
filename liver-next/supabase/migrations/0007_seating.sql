-- ============================================================================
--  0007 — seating that cannot quietly overfill a table
-- ============================================================================
--  A table has a number of seats and guests arrive in parties, so the count
--  that matters is people rather than rows. Nothing stopped a party of six
--  being dropped onto a table with two seats left, and the error would only
--  surface on the night, when somebody is standing.
--
--  Note on shape: releasing a seat and checking capacity are one trigger on
--  purpose. Split across two, PostgreSQL fires BEFORE triggers in name order,
--  so the capacity check ran first and rejected a guest who was cancelling —
--  the very update that was about to free their chair. One function has no
--  ordering to get wrong.
-- ============================================================================

-- how many people are already sitting at a table
create or replace function public.table_taken(p_table uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(party_size), 0)::int
    from public.guests_rsvp
   where table_id = p_table and status = 'attending'
$$;

create or replace function public.guard_seating() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cap   int;
  taken int;
  mine  int;
begin
  -- somebody who is not coming holds no chair, so withdrawing frees it
  -- rather than being refused
  if new.status <> 'attending' then
    new.table_id := null;
    return new;
  end if;

  if new.table_id is null then
    return new;
  end if;

  select seats into cap from public.tables_seating where id = new.table_id;
  if cap is null then
    raise exception 'that table does not exist';
  end if;

  -- what this guest already occupies there, so an edit is not counted twice
  mine := case
    when tg_op = 'UPDATE' and old.table_id = new.table_id and old.status = 'attending'
    then old.party_size else 0 end;

  taken := public.table_taken(new.table_id) - mine;

  if taken + new.party_size > cap then
    raise exception 'the table seats %, and % would be seated', cap, taken + new.party_size;
  end if;

  return new;
end $$;
drop trigger if exists guests_guard_seating on public.guests_rsvp;
drop trigger if exists guests_release_seat on public.guests_rsvp;
create trigger guests_guard_seating before insert or update on public.guests_rsvp
  for each row execute function public.guard_seating();

-- ── shrinking a table must not leave people sitting in seats that are gone ──
create or replace function public.guard_table_seats() returns trigger
language plpgsql security definer set search_path = public as $$
declare taken int;
begin
  if new.seats >= old.seats then
    return new;
  end if;
  taken := public.table_taken(new.id);
  if taken > new.seats then
    raise exception '% people are already seated here, so it cannot go down to %', taken, new.seats;
  end if;
  return new;
end $$;
drop trigger if exists tables_guard_seats on public.tables_seating;
create trigger tables_guard_seats before update on public.tables_seating
  for each row execute function public.guard_table_seats();

create index if not exists guests_table_idx on public.guests_rsvp(table_id);
