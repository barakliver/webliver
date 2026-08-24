-- ============================================================================
--  0032 — who has actually turned up, and what is about to happen
-- ============================================================================
--  The evening screen could say what was scheduled and what had been ticked
--  off. It could not answer the question a producer asks most between four and
--  six: has the sound engineer arrived.
--
--  That was tracked by looking around the room, which works until there are
--  two rooms. Two columns, one on each side of the call sheet, and a timestamp
--  rather than a flag for the same reason the run sheet uses one: "the caterer
--  came forty minutes late" is a fact about a supplier that is worth having
--  next year, and a boolean throws it away.
--
--  And one flag on the schedule. Not every line deserves a countdown — a run
--  sheet has forty of them and an alert before each is an alert before none.
--  The producer marks the handful that matter: the chuppah, the first dance,
--  the moment the food goes out.
-- ============================================================================

alter table public.event_vendors add column if not exists arrived_at timestamptz;
alter table public.crew          add column if not exists arrived_at timestamptz;

comment on column public.event_vendors.arrived_at is
  'When this supplier actually turned up. Null means not yet. A timestamp so '
  'the gap between the call time and the arrival survives the night.';
comment on column public.crew.arrived_at is
  'When this person actually turned up. Null means not yet.';

alter table public.day_schedule add column if not exists key_moment boolean not null default false;

comment on column public.day_schedule.key_moment is
  'Worth a countdown. A run sheet has forty lines and an alert before every '
  'one of them is an alert before none, so this marks the handful that move '
  'the evening: the chuppah, the first dance, the food going out.';

/* The evening asks "who is still out" over and over for two hours. */
create index if not exists event_vendors_waiting_idx
  on public.event_vendors (client_id) where arrived_at is null;
create index if not exists crew_waiting_idx
  on public.crew (client_id) where arrived_at is null;


-- ── marking somebody in ─────────────────────────────────────────────────────
--  One function for both tables, because on the screen they are one list and
--  the producer tapping a name does not know or care which table it came from.
--  The time is the server's: a phone with a wrong clock would otherwise record
--  a florist arriving at four in the afternoon, and that timestamp is the
--  whole reason the column is not a boolean.
create or replace function public.mark_arrival(
  p_kind text, p_id uuid, p_undo boolean default false
) returns void
language plpgsql security definer set search_path = public as $$
declare v_client uuid;
begin
  if p_kind = 'crew' then
    select client_id into v_client from public.crew where id = p_id;
  elsif p_kind = 'vendor' then
    select client_id into v_client from public.event_vendors where id = p_id;
  else
    raise exception 'לא ידוע מי זה' using errcode = 'invalid_parameter_value';
  end if;

  if v_client is null then
    raise exception 'לא נמצא' using errcode = 'no_data_found';
  end if;

  /* Crew and suppliers are the producer's side of the wall everywhere else in
     this schema, and a security definer function is exactly where that wall
     would quietly stop existing. */
  if not public.owns_producer(public.producer_of_client(v_client)) then
    raise exception 'אין הרשאה' using errcode = 'insufficient_privilege';
  end if;

  if p_kind = 'crew' then
    update public.crew
       set arrived_at = case when p_undo then null else now() end
     where id = p_id;
  else
    update public.event_vendors
       set arrived_at = case when p_undo then null else now() end
     where id = p_id;
  end if;
end $$;

revoke all on function public.mark_arrival(text, uuid, boolean) from public;
grant execute on function public.mark_arrival(text, uuid, boolean) to authenticated;
