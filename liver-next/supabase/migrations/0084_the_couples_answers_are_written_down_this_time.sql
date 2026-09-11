-- ============================================================================
--  0084 — the couple's answers are written down, this time
-- ============================================================================
--  0082's function refused every answer but the date, and said so in the
--  one way nobody reads: `wrote := wrote || 'guests'` asks PostgreSQL to
--  append a text to a text[], and with a bare string on the right it tries
--  to read that string as an array literal first. "guests" is not one, so the
--  whole call raised, the flow reported that it could not save, and the
--  date-only path — the only branch that ran before the first bad append —
--  hid it from the probe that would have caught it.
--
--  Found by running the function as an invited couple against a real
--  PostgreSQL rather than by reading it, which is the only way it could have
--  been found, and the reason the schema suite now does exactly that.
--
--  The fix is array_append, four times. Nothing else in the function moves,
--  and nothing here touches a row.
-- ============================================================================

create or replace function public.couple_sets_basics(
  p_client  uuid,
  p_date    date,
  p_guests  integer,
  p_region  text,
  p_budget  numeric,
  p_plan    jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  wrote text[] := '{}';
  cur   record;
begin
  if not public.can_read_client(p_client) then
    raise exception 'אין הרשאה' using errcode = 'insufficient_privilege';
  end if;

  select event_date, guest_estimate, region, budget_target, budget_plan
    into cur
    from public.clients where id = p_client;

  if not found then
    raise exception 'no such event';
  end if;

  if p_date is not null and cur.event_date is null then
    update public.clients set event_date = p_date where id = p_client;
    wrote := array_append(wrote, 'date');
  end if;

  if p_guests is not null and p_guests > 0 and cur.guest_estimate is null then
    update public.clients set guest_estimate = least(p_guests, 5000) where id = p_client;
    wrote := array_append(wrote, 'guests');
  end if;

  if p_region is not null and btrim(p_region) <> '' and coalesce(btrim(cur.region), '') = '' then
    update public.clients set region = btrim(left(p_region, 80)) where id = p_client;
    wrote := array_append(wrote, 'region');
  end if;

  if p_budget is not null and p_budget > 0 and cur.budget_target is null then
    update public.clients set budget_target = p_budget where id = p_client;
    wrote := array_append(wrote, 'budget');
  end if;

  if p_plan is not null and cur.budget_plan is null then
    update public.clients set budget_plan = p_plan where id = p_client;
    wrote := array_append(wrote, 'plan');
  end if;

  return jsonb_build_object('wrote', to_jsonb(wrote));
end $$;

revoke all on function public.couple_sets_basics(uuid, date, integer, text, numeric, jsonb) from public, anon;
grant execute on function public.couple_sets_basics(uuid, date, integer, text, numeric, jsonb) to authenticated;
