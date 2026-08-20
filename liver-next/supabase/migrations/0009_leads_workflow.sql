-- ============================================================================
--  0009 — leads that actually reach somebody, and the follow up after
-- ============================================================================
--  The public form writes through the service role and never set producer_id,
--  while leads_read requires "producer_id is not null and you own it". The
--  root admin saw every lead only because super_admin bypasses that clause —
--  luck, not design. Any other approved producer saw zero leads and always
--  would have, with the enquiries sitting in the table unread.
--
--  Attribution is fixed in the database rather than in the one code path that
--  happens to insert today, so no future form, import or script can drop a
--  lead into the void.
-- ============================================================================

-- whose enquiries the public site collects
create or replace function public.public_site_producer() returns uuid
language sql stable security definer set search_path = public as $$
  select pr.id
    from public.producers pr
    join public.profiles p on p.id = pr.owner_id
   where lower(p.email) = public.root_admin_email()
   order by pr.created_at
   limit 1
$$;

create or replace function public.attribute_lead() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.producer_id is null then
    new.producer_id := public.public_site_producer();
  end if;
  return new;
end $$;
drop trigger if exists leads_attribute on public.leads;
create trigger leads_attribute before insert on public.leads
  for each row execute function public.attribute_lead();

-- leads already sitting unattributed belong to the site that collected them
update public.leads
   set producer_id = public.public_site_producer()
 where producer_id is null;

-- ── the follow up ───────────────────────────────────────────────────────────
--  A producer books the call from the lead, so the workspace is implied
--  rather than typed, and cannot end up pointing at somebody else's.
create or replace function public.attribute_sales_call() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner_of_lead uuid;
begin
  if new.producer_id is null then
    new.producer_id := public.my_producer_id();
  end if;

  -- A call may only hang off a lead in the same workspace. Without this a
  -- producer could file a call against somebody else's lead: nothing escapes,
  -- because the lead itself stays unreadable, but it leaves a reference
  -- pointing across tenants for a future join to trip over.
  if new.lead_id is not null then
    select producer_id into owner_of_lead from public.leads where id = new.lead_id;
    if owner_of_lead is distinct from new.producer_id then
      raise exception 'that lead belongs to another workspace';
    end if;
  end if;

  return new;
end $$;
drop trigger if exists sales_calls_attribute on public.sales_calls;
create trigger sales_calls_attribute before insert on public.sales_calls
  for each row execute function public.attribute_sales_call();

create index if not exists sales_calls_lead_idx on public.sales_calls(lead_id);
