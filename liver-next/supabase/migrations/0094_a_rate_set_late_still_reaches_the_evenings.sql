-- ============================================================================
--  0094 — a rate set late still reaches the evenings
-- ============================================================================
--  0092 gave a crew member a rate and had `assign_crew` copy it onto the
--  assignment. Copy rather than reference, so raising somebody's rate next
--  March cannot rewrite what last August cost. That rule is right and it
--  stays.
--
--  What it did not account for is the order things actually happen in. The
--  crew was built and assigned to nine events first, and the rates were typed
--  afterwards — which is the normal order, because you staff a season before
--  you sit down with the money. Every one of those assignments carries a null
--  fee, the copy already happened, and the season board adds them up to zero
--  and calls the evening free.
--
--  The only way out was to take each person off and put them back on, nine
--  times. So: one function that fills in the blanks and nothing else.
--
--    * Only rows whose fee is null. A fee that is written down was agreed for
--      that evening and is not ours to replace with a list price — that is
--      the whole reason the copy exists, and a backfill that overwrote it
--      would quietly undo the negotiation it was protecting.
--    * Only this producer's rows.
--    * Only where the person has a rate to copy.
--
--  The hourly rate rides along on the same terms, for the same reason.
--
--  It returns how many rows it touched, because a button that says "done"
--  and a button that says "filled in eleven" are different buttons, and only
--  one of them can be checked.
-- ============================================================================

create or replace function public.fill_crew_fees()
returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with mine as (
    select w.id, m.rate, m.hour_rate
      from public.crew w
      join public.crew_members m on m.id = w.crew_member_id
      join public.clients c on c.id = w.client_id
     where (public.owns_producer(c.producer_id) or public.is_super_admin())
       and (
         (w.fee is null and m.rate is not null)
         or (w.hour_rate is null and m.hour_rate is not null)
       )
  )
  update public.crew w
     set fee       = coalesce(w.fee, mine.rate),
         hour_rate = coalesce(w.hour_rate, mine.hour_rate)
    from mine
   where w.id = mine.id;

  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.fill_crew_fees() from public;
grant execute on function public.fill_crew_fees() to authenticated;

comment on function public.fill_crew_fees is
  'Fills crew.fee and crew.hour_rate from the directory, for this producer''s assignments that '
  'have none. Never replaces a figure that is already written down: that one was agreed for '
  'that evening. Returns how many rows were filled.';
