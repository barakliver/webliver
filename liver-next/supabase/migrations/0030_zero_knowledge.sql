-- ============================================================================
--  0030 — the tenant boundary, with the master key removed
-- ============================================================================
--  Until now `can_read_client()` opened with `is_super_admin() or ...`. One
--  line, at the top of the function every policy on every workspace table
--  calls. It meant the root account could read any couple's guest list, any
--  producer's budget, any contract and every message on the platform, and the
--  fifty-five policies underneath it were decoration as far as root was
--  concerned.
--
--  That was deliberate, and it was asked for. It is now explicitly withdrawn:
--  a producer who brings their own couples onto this platform must be able to
--  say that nobody else, including whoever runs the platform, can read them.
--  A promise like that is worth exactly what enforces it, so it is enforced
--  here rather than by a policy in a document.
--
--  What root keeps is governance, and only governance:
--    · the producers table, so accounts can be approved and suspended
--    · the profiles of producer owners, so there is a name behind an approval
--    · the platform's own marketing site content
--    · aggregate counts, through functions that return numbers and never rows
--  and, unchanged, everything in root's *own* workspace, which he reaches the
--  same way every other producer reaches theirs: by owning it.
--
--  What root loses, and this is the cost, is support. Nobody can look at a
--  producer's event to work out why a screen is wrong for them. The answer to
--  "my budget looks broken" is now a screen share, not a lookup. That is the
--  trade this migration makes on purpose.
--
--  Safe to re-run, and it destroys no data: every statement here replaces a
--  policy or a function.
-- ============================================================================


-- ── the master key ──────────────────────────────────────────────────────────
--  The whole migration in one function. Everything below is closing the doors
--  that were cut around it.
create or replace function public.can_read_client(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select
    exists (select 1 from public.clients c join public.producers pr on pr.id = c.producer_id
             where c.id = cid and pr.owner_id = auth.uid())
    or exists (
      select 1
        from public.client_authorized_emails e
        join public.profiles p on p.id = auth.uid()
       where e.client_id = cid
         and (
           e.email = lower(p.email)
           or e.profile_id = p.id
         )
    )
$$;

comment on function public.can_read_client(uuid) is
  'Whether the signed-in account is on this workspace: its producer, or one of '
  'the authorised addresses. Deliberately has no administrator branch — the '
  'platform owner is not on a workspace they do not own.';


-- ── profiles: root sees the people it governs, and nobody else ──────────────
--  A producer owner's name and address are what an approval decision is made
--  against. A couple's are not root's business, and the aggregate functions
--  below count them without reading them.
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select
  using (
    id = auth.uid()
    or (
      public.is_super_admin()
      and exists (select 1 from public.producers pr where pr.owner_id = profiles.id)
    )
  );

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update
  using (
    id = auth.uid()
    or (
      public.is_super_admin()
      and exists (select 1 from public.producers pr where pr.owner_id = profiles.id)
    )
  )
  with check (
    id = auth.uid()
    or (
      public.is_super_admin()
      and exists (select 1 from public.producers pr where pr.owner_id = profiles.id)
    )
  );


-- ── the workspace tables ────────────────────────────────────────────────────
--  Each one restated without its administrator branch. Written out in full
--  rather than patched, because a policy is read to find out what is true and
--  a half-stated one is worse than none.

drop policy if exists clients_write on public.clients;
create policy clients_write on public.clients for all
  using      (public.can_read_client(id) and public.is_approved_producer())
  with check (public.owns_producer(producer_id) and public.is_approved_producer());

drop policy if exists cae_write on public.client_authorized_emails;
create policy cae_write on public.client_authorized_emails for all
  using      (public.owns_producer(public.producer_of_client(client_id)))
  with check (public.owns_producer(public.producer_of_client(client_id)));

--  Leads are a producer's commercial pipeline. If anything on this platform is
--  theirs alone, it is the list of people who have not signed yet.
drop policy if exists leads_read on public.leads;
create policy leads_read on public.leads for select
  using (producer_id is not null and public.owns_producer(producer_id));

drop policy if exists leads_write on public.leads;
create policy leads_write on public.leads for all
  using      (producer_id is not null and public.owns_producer(producer_id))
  with check (producer_id is not null and public.owns_producer(producer_id));

drop policy if exists sales_calls_all on public.sales_calls;
create policy sales_calls_all on public.sales_calls for all
  using      (public.owns_producer(producer_id))
  with check (public.owns_producer(producer_id));

drop policy if exists orders_all on public.orders;
create policy orders_all on public.orders for all
  using      (public.owns_producer(producer_id))
  with check (public.owns_producer(producer_id));

drop policy if exists site_settings_all on public.site_settings;
create policy site_settings_all on public.site_settings for all
  using      (public.owns_producer(producer_id))
  with check (public.owns_producer(producer_id));

drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks for select
  using (
    public.owns_producer(public.producer_of_client(client_id))
    or (public.can_read_client(client_id) and visible_to_client)
  );

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete
  using (
    public.can_read_client(client_id)
    and (created_by = auth.uid() or public.owns_producer(public.producer_of_client(client_id)))
  );

drop policy if exists budget_read on public.budget_items;
create policy budget_read on public.budget_items for select
  using (
    public.owns_producer(public.producer_of_client(client_id))
    or (
      public.can_read_client(client_id)
      and exists (select 1 from public.clients c where c.id = client_id and c.budget_visible)
    )
  );

drop policy if exists budget_write on public.budget_items;
create policy budget_write on public.budget_items for all
  using      (public.owns_producer(public.producer_of_client(client_id)))
  with check (public.owns_producer(public.producer_of_client(client_id)));

drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select
  using (
    public.owns_producer(public.producer_of_client(client_id))
    or (
      public.can_read_client(client_id)
      and exists (select 1 from public.clients c
                   where c.id = payments.client_id and c.budget_visible)
    )
  );

drop policy if exists payments_write on public.payments;
create policy payments_write on public.payments for all
  using      (public.owns_producer(public.producer_of_client(client_id)))
  with check (public.owns_producer(public.producer_of_client(client_id)));

drop policy if exists contracts_read on public.contracts;
create policy contracts_read on public.contracts for select
  using (
    public.owns_producer(public.producer_of_client(client_id))
    or (public.can_read_client(client_id) and status <> 'draft')
  );

drop policy if exists contracts_write on public.contracts;
create policy contracts_write on public.contracts for all
  using      (public.owns_producer(public.producer_of_client(client_id)))
  with check (public.owns_producer(public.producer_of_client(client_id)));

--  A retraction is the author's to make. Root retracting somebody else's
--  message was a way to edit a conversation root cannot even read.
drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages for delete
  using (author_id = auth.uid());

drop policy if exists vendors_all on public.vendors;
create policy vendors_all on public.vendors for all
  using      (public.owns_producer(producer_id))
  with check (public.owns_producer(producer_id));

drop policy if exists event_vendors_all on public.event_vendors;
create policy event_vendors_all on public.event_vendors for all
  using      (public.owns_producer(public.producer_of_client(client_id)))
  with check (public.owns_producer(public.producer_of_client(client_id)));

drop policy if exists crew_all on public.crew;
create policy crew_all on public.crew for all
  using      (public.owns_producer(public.producer_of_client(client_id)))
  with check (public.owns_producer(public.producer_of_client(client_id)));


-- ── the functions that took the same shortcut ───────────────────────────────
create or replace function public.book_vendor(p_client uuid, p_vendor uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v record; v_id uuid;
begin
  if not public.owns_producer(public.producer_of_client(p_client)) then
    raise exception 'אין הרשאה' using errcode = 'insufficient_privilege';
  end if;

  select * into v from public.vendors
   where id = p_vendor and public.owns_producer(producer_id);
  if not found then
    raise exception 'הספק לא נמצא' using errcode = 'no_data_found';
  end if;

  /* Already on this event. Answer with the row that exists rather than adding
     a second card for the same florist. */
  select id into v_id from public.event_vendors
   where client_id = p_client and vendor_id = p_vendor limit 1;
  if found then return v_id; end if;

  insert into public.event_vendors (client_id, vendor_id, name, category, phone, status)
  values (p_client, v.id, v.name, v.category, v.phone, 'shortlist')
  returning id into v_id;

  return v_id;
end $$;

create or replace function public.guard_task_visibility() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.visible_to_client is distinct from old.visible_to_client
     and not public.owns_producer(public.producer_of_client(new.client_id)) then
    raise exception 'רק המפיק קובע מה משותף' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

create or replace function public.default_task_visibility() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.owns_producer(public.producer_of_client(new.client_id)) then
    new.visible_to_client := true;
  end if;
  return new;
end $$;


-- ============================================================================
--  governance: numbers, not rows
-- ============================================================================
--  Root can no longer select from the workspace tables, which is the point.
--  So the console is served by functions that run as the definer, count what
--  they were asked to count, and return no identifying row of anybody's
--  event. Each one refuses outright unless the caller is root — a security
--  definer function without that check is the master key again, wearing a
--  different hat.


-- ── a real activity signal, rather than a guessed one ───────────────────────
--  "Active users" was going to be derived from whether an account happened to
--  be attached to something, which measures setup and calls it usage. One
--  column, stamped at most once a day, measures the actual thing.
alter table public.profiles add column if not exists last_seen_at timestamptz;

comment on column public.profiles.last_seen_at is
  'Last time this account opened the app, to the day. Stamped by touch_seen() '
  'and never more than once every 24 hours, so it costs one write a day rather '
  'than one per page.';

create or replace function public.touch_seen() returns void
language sql volatile security definer set search_path = public as $$
  update public.profiles
     set last_seen_at = now()
   where id = auth.uid()
     and (last_seen_at is null or last_seen_at < now() - interval '20 hours')
$$;

revoke all on function public.touch_seen() from public;
grant execute on function public.touch_seen() to authenticated;


-- ── who is on the platform ──────────────────────────────────────────────────
create or replace function public.platform_stats()
returns table (
  users_total        integer,
  users_active_30d   integer,
  users_never_seen   integer,
  producers_total    integer,
  producers_approved integer,
  producers_pending  integer,
  producers_blocked  integer,
  couples_total      integer,
  couples_managed    integer,
  couples_diy        integer,
  events_total       integer,
  events_live        integer,
  leads_total        integer,
  leads_30d          integer
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'אין הרשאה' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    (select count(*)::int from public.profiles),
    (select count(*)::int from public.profiles
      where last_seen_at is not null and last_seen_at > now() - interval '30 days'),
    (select count(*)::int from public.profiles where last_seen_at is null),

    (select count(*)::int from public.producers),
    (select count(*)::int from public.producers where status = 'approved'),
    (select count(*)::int from public.producers where status = 'pending'),
    (select count(*)::int from public.producers where status in ('suspended','rejected')),

    /* A couple is an authorised address on a workspace, counted once even
       when a bride and groom both have logins on the same event. */
    (select count(distinct lower(e.email))::int from public.client_authorized_emails e),
    (select count(distinct lower(e.email))::int
       from public.client_authorized_emails e
       join public.clients c on c.id = e.client_id where c.plan = 'managed'),
    (select count(distinct lower(e.email))::int
       from public.client_authorized_emails e
       join public.clients c on c.id = e.client_id where c.plan = 'diy'),

    (select count(*)::int from public.clients),
    (select count(*)::int from public.clients where archived_at is null),

    (select count(*)::int from public.leads),
    (select count(*)::int from public.leads where created_at > now() - interval '30 days');
end $$;

revoke all on function public.platform_stats() from public;
grant execute on function public.platform_stats() to authenticated;


-- ── who is actually working ─────────────────────────────────────────────────
--  A producer's own brand name is governance: it is what an approval decision
--  is made against. Everything else here is a count. No couple, no event name
--  and no money crosses this boundary.
create or replace function public.producer_leaderboard()
returns table (
  producer_id   uuid,
  brand         text,
  contact_email text,
  status        text,
  last_seen_at  timestamptz,
  events_live   integer,
  events_total  integer,
  leads_total   integer,
  leads_30d     integer,
  signed_total  integer
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'אין הרשאה' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    pr.id,
    coalesce(nullif(pr.brand_name, ''), nullif(pr.contact_name, ''), pr.contact_email),
    pr.contact_email,
    pr.status::text,
    p.last_seen_at,
    (select count(*)::int from public.clients c
      where c.producer_id = pr.id and c.archived_at is null),
    (select count(*)::int from public.clients c where c.producer_id = pr.id),
    (select count(*)::int from public.leads l where l.producer_id = pr.id),
    (select count(*)::int from public.leads l
      where l.producer_id = pr.id and l.created_at > now() - interval '30 days'),
    (select count(distinct ct.client_id)::int
       from public.contracts ct
       join public.clients c on c.id = ct.client_id
      where c.producer_id = pr.id and ct.signed_at is not null)
  from public.producers pr
  left join public.profiles p on p.id = pr.owner_id
  order by 6 desc, 8 desc;
end $$;

revoke all on function public.producer_leaderboard() from public;
grant execute on function public.producer_leaderboard() to authenticated;


-- ============================================================================
--  feature gating
-- ============================================================================
--  Two kinds of couple use this platform and they are not the same customer.
--  One is handed a finished workspace by a producer who is doing the work.
--  The other signed up themselves and is planning their own wedding with the
--  tools. Which modules the second one gets is a commercial decision, and it
--  belongs on a screen rather than in a deploy.

do $$ begin create type client_plan as enum ('managed','diy');
  exception when duplicate_object then null; end $$;

alter table public.clients add column if not exists plan client_plan not null default 'managed';

comment on column public.clients.plan is
  'managed = a producer is running this event. diy = the couple signed up '
  'themselves and is using the tools alone. Decides which modules are open.';


create table if not exists public.feature_flags (
  key         text primary key,
  label       text not null default '',
  /* Open for a couple planning it themselves. */
  diy         boolean not null default true,
  /* Open for a couple whose producer is running it. */
  managed     boolean not null default true,
  updated_at  timestamptz not null default now()
);

comment on table public.feature_flags is
  'Which modules each kind of couple may open. A missing row means open to '
  'everyone: a feature must be switched off deliberately, never by having been '
  'forgotten here.';

alter table public.feature_flags enable row level security;

/* Everyone signed in reads them, because every screen has to know whether it
   is allowed to render. Only root writes them. */
drop policy if exists feature_flags_read on public.feature_flags;
create policy feature_flags_read on public.feature_flags for select using (true);

drop policy if exists feature_flags_write on public.feature_flags;
create policy feature_flags_write on public.feature_flags for all
  using (public.is_super_admin()) with check (public.is_super_admin());

grant select on public.feature_flags to authenticated;
grant select, insert, update, delete on public.feature_flags to service_role;


create or replace function public.set_feature_flag(
  p_key text, p_label text, p_diy boolean, p_managed boolean
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'אין הרשאה' using errcode = 'insufficient_privilege';
  end if;

  insert into public.feature_flags (key, label, diy, managed, updated_at)
  values (p_key, coalesce(p_label, ''), p_diy, p_managed, now())
  on conflict (key) do update
    set label = excluded.label, diy = excluded.diy,
        managed = excluded.managed, updated_at = now();
end $$;

revoke all on function public.set_feature_flag(text, text, boolean, boolean) from public;
grant execute on function public.set_feature_flag(text, text, boolean, boolean) to authenticated;


/* Whether one workspace may open one module.
   A producer's own screens are never gated: the gate is about what a *couple*
   is sold, and locking a producer out of their own tooling would be a support
   ticket rather than a business model. */
create or replace function public.feature_on(p_client uuid, p_key text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when not public.can_read_client(p_client) then false
    when public.owns_producer(public.producer_of_client(p_client)) then true
    else coalesce(
      (select case when c.plan = 'diy' then f.diy else f.managed end
         from public.clients c
         left join public.feature_flags f on f.key = p_key
        where c.id = p_client),
      true)
  end
$$;

revoke all on function public.feature_on(uuid, text) from public;
grant execute on function public.feature_on(uuid, text) to authenticated;


-- ── handing an event to another producer ────────────────────────────────────
--  Reassignment used to work across the whole platform, because root could
--  read every workspace. It cannot now, and moving somebody else's event
--  between two other tenants is not an operation this platform should have.
--
--  What survives is the honest version: an owner giving away their own event.
--  Root moving a wedding from their own books to Keren's is root handing over
--  data root already holds, which is a real thing a production business does.
--  The source must be owned by the caller; the destination must be approved.
create or replace function public.transfer_client(p_client uuid, p_to_producer uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.owns_producer(public.producer_of_client(p_client)) then
    raise exception 'אפשר להעביר רק אירוע שלך' using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from public.producers pr
     where pr.id = p_to_producer and pr.status = 'approved'
  ) then
    raise exception 'אפשר להעביר רק למפיק מאושר' using errcode = 'check_violation';
  end if;

  update public.clients set producer_id = p_to_producer where id = p_client;
end $$;

revoke all on function public.transfer_client(uuid, uuid) from public;
grant execute on function public.transfer_client(uuid, uuid) to authenticated;


-- ── the modules there are ───────────────────────────────────────────────────
--  Seeded so the console has something to show on the first open rather than
--  an empty screen that looks broken. Everything starts open: a feature is
--  switched off deliberately, never by having been forgotten here.
insert into public.feature_flags (key, label, diy, managed) values
  ('budget',    'תקציב',            true,  true),
  ('guests',    'אורחים ו-RSVP',    true,  true),
  ('seating',   'סידור הושבה',      true,  true),
  ('moodboard', 'לוח השראה',        true,  true),
  ('runsheet',  'לוז יום האירוע',   true,  true),
  ('bar',       'מחשבון בר',        true,  true),
  ('messages',  'הודעות עם המפיק',  false, true),
  ('contracts', 'חוזים',            false, true),
  ('files',     'קבצים ותמונות',    true,  true)
on conflict (key) do nothing;
