-- ============================================================================
--  0082 — the couple can fill in their own blanks
-- ============================================================================
--  Round three of the planning brief asks for a short flow that collects the
--  wedding date, a guest estimate, a region, a provisional budget and what
--  the couple would rather overspend on — and says to save it through the
--  existing persistence layer.
--
--  There is no existing path for it. A couple cannot write to public.clients
--  at all: clients_write has been producer-only since 0001 and was restated
--  in 0036 as `owns_producer(producer_id) and is_approved_producer()`, which
--  is correct and is not being widened here. A couple who could edit that row
--  could move the wedding date their producer agreed with a hall.
--
--  So: a function, and one rule that makes it safe to have.
--
--    It only ever turns a blank into a value.
--
--  Not "the couple may edit these five fields" — "the couple may answer a
--  question nobody has answered yet". A date that exists is left alone. A
--  guest estimate that exists is left alone. There is no argument to have
--  about precedence, no last-writer-wins between a couple on a phone and a
--  producer on a laptop, and nothing a couple can do here that undoes a
--  decision somebody made. The screen asks only about the blanks for the same
--  reason, so the two halves cannot disagree about what is still open.
--
--  It returns what it actually wrote, so the screen can say what changed
--  rather than claiming everything was saved.
--
--  Nothing here touches a row: one column is added empty, and the function
--  writes only where there is nothing.
-- ============================================================================

-- ── where the wedding is, roughly ───────────────────────────────────────────
--  Not the venue, which is a name and is often decided months later. The
--  region is what makes a guest estimate mean something — two hundred guests
--  in the north and two hundred in the centre are different budgets — and it
--  is one of the few things a couple knows on day one.
alter table public.clients
  add column if not exists region text not null default '';

comment on column public.clients.region is
  'Roughly where the wedding will be, in the couple''s own words. Distinct '
  'from venue, which is one hall by name. Empty until somebody says.';


-- ── the answers, written only where there were none ─────────────────────────
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
  /* The same gate every other thing a couple may touch is behind: the
     producer who owns the event, or an address invited onto it. */
  if not public.can_read_client(p_client) then
    raise exception 'אין הרשאה' using errcode = 'insufficient_privilege';
  end if;

  select event_date, guest_estimate, region, budget_target, budget_plan
    into cur
    from public.clients where id = p_client;

  if not found then
    raise exception 'no such event';
  end if;

  /* Each one guarded by its own blank. A null argument means the flow did
     not ask, which is not the same as an answer of nothing. */
  if p_date is not null and cur.event_date is null then
    update public.clients set event_date = p_date where id = p_client;
    wrote := wrote || 'date';
  end if;

  if p_guests is not null and p_guests > 0 and cur.guest_estimate is null then
    update public.clients set guest_estimate = least(p_guests, 5000) where id = p_client;
    wrote := wrote || 'guests';
  end if;

  if p_region is not null and btrim(p_region) <> '' and coalesce(btrim(cur.region), '') = '' then
    update public.clients set region = btrim(left(p_region, 80)) where id = p_client;
    wrote := wrote || 'region';
  end if;

  if p_budget is not null and p_budget > 0 and cur.budget_target is null then
    update public.clients set budget_target = p_budget where id = p_client;
    wrote := wrote || 'budget';
  end if;

  if p_plan is not null and cur.budget_plan is null then
    update public.clients set budget_plan = p_plan where id = p_client;
    wrote := wrote || 'plan';
  end if;

  return jsonb_build_object('wrote', to_jsonb(wrote));
end $$;

comment on function public.couple_sets_basics(uuid, date, integer, text, numeric, jsonb) is
  'The short opening flow, saved. Writes only fields that are currently '
  'empty, so a couple answering a question can never overwrite a decision '
  'their producer already made. Returns the names of the fields it wrote.';

revoke all on function public.couple_sets_basics(uuid, date, integer, text, numeric, jsonb) from public, anon;
grant execute on function public.couple_sets_basics(uuid, date, integer, text, numeric, jsonb) to authenticated;
