-- ============================================================================
--  0090 — the producer has a crew of his own
-- ============================================================================
--  0025 built `crew`: the people working one specific evening, with a call
--  time and a fee. That was right about the evening and wrong about the
--  person. Tal works nine weddings a year. Under 0025 she is nine rows, typed
--  out nine times, and her phone number is whatever it was the last time
--  somebody typed it.
--
--  Suppliers already had the answer to this, in the same file: `vendors` is
--  the directory and `event_vendors` is one booking of one of them. Crew gets
--  the same shape, for the same reason, and the same way round — the booking
--  keeps its own copy of the name, so renaming somebody in the directory
--  cannot rewrite what last August's event says happened.
--
--  What is new here and has no parallel on the supplier side is the roles.
--  A supplier is a florist. A person is "can run an evening, can assist, does
--  not do social" — several answers at once, and which of them applies is
--  decided per event. So `roles` is a set, not a column, and the three values
--  in it are the three the business actually staffs to:
--
--    manager    מנהל אירוע      — runs the evening
--    assistant  עוזר מנהל אירוע — works to the manager
--    social     סושיאל          — stories and video through the night
--
--  A closed list, deliberately, where `crew.role` next door is free text. The
--  free-text one is for the twelfth job nobody listed. These three are the
--  ones a rule is written about — up to 350 guests a manager and an assistant,
--  above it a manager and two — and a rule cannot be written about a column
--  somebody typed "עוזרת" into once and "עוזר" the next time.
--
--  Producer-only, like everything in 0025 and for the reason written there:
--  crew rows carry fees. A crew member reading their own evening is a
--  different question, and it is not answered in this file.
--
--  Nothing here touches an existing row. `crew` gains one nullable column.
-- ============================================================================

-- ── the people, rather than the evenings ────────────────────────────────────
create table if not exists public.crew_members (
  id          uuid primary key default gen_random_uuid(),
  producer_id uuid not null references public.producers(id) on delete cascade,
  name        text not null,
  phone       text not null default '',
  /* Empty until somebody is invited. Kept here rather than in an invitations
     table because the address is a property of the person: it is how you
     reach Tal whether or not she has ever logged in. */
  email       text not null default '',
  /* What this person can be put on. Several at once, which is the whole
     point: the same person is a manager on a small evening and an assistant
     on a big one. */
  roles       text[] not null default '{}',
  notes       text not null default '',
  /* Retired rather than deleted, exactly as vendors are: somebody who no
     longer works with you still worked last August's wedding, and deleting
     the row would blank a finished file rather than tidy anything. */
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  constraint crew_members_named check (btrim(name) <> '')
);

/* The closed list, in the database rather than only in the form. A form is a
   suggestion; this is the thing that makes the staffing rule able to count.
   NOT VALID by the rule that cost three releases: the table is new and cannot
   hold a bad row, and the rule is still "always". */
alter table public.crew_members drop constraint if exists crew_members_roles;
alter table public.crew_members add constraint crew_members_roles
  check (roles <@ array['manager','assistant','social']::text[]) not valid;

do $$
begin
  alter table public.crew_members validate constraint crew_members_roles;
exception when check_violation then
  raise notice 'crew_members.roles applies to new rows; some existing rows are outside the list.';
end $$;

create index if not exists crew_members_producer_idx
  on public.crew_members (producer_id, archived_at, name);

/* One person, once. Two rows for Tal means two phone numbers, and the wrong
   one is the one that gets called at eleven at night. Case folded, because
   nobody types a name the same way twice. */
create unique index if not exists crew_members_producer_name_key
  on public.crew_members (producer_id, lower(btrim(name)));

/* And one address, once — but only where there is an address. A crew of
   fifteen with no email between them is fifteen empty strings, and a plain
   unique index would refuse the second one. */
create unique index if not exists crew_members_producer_email_key
  on public.crew_members (producer_id, lower(btrim(email)))
  where btrim(email) <> '';

comment on table public.crew_members is
  'The producer''s own crew: people, not evenings. crew is one of them working one event, '
  'the same way event_vendors is one booking of a vendors row. Producer-only.';


-- ── which of them is on this evening ────────────────────────────────────────
/* Nullable, like event_vendors.vendor_id and for the same reason: half the
   people on an evening are somebody's cousin with a van, booked once, and
   making the directory a compulsory first step is what sends a name onto
   paper instead. */
alter table public.crew
  add column if not exists crew_member_id uuid references public.crew_members(id) on delete set null;

/* The role this person is filling on THIS evening, out of the three the rule
   counts. Separate from crew.role, which stays free text for everything else:
   a person can be a manager in the directory and an assistant tonight, and
   the staffing rule needs to know which one tonight is. */
alter table public.crew
  add column if not exists slot text;

alter table public.crew drop constraint if exists crew_slot;
alter table public.crew add constraint crew_slot
  check (slot is null or slot in ('manager','assistant','social')) not valid;

do $$
begin
  alter table public.crew validate constraint crew_slot;
exception when check_violation then
  raise notice 'crew.slot applies to new rows; some existing rows are outside the list.';
end $$;

create index if not exists crew_member_idx
  on public.crew (crew_member_id) where crew_member_id is not null;

/* One person is on one event once. Being booked twice for the same evening is
   never a thing somebody meant, and without this the assign button adds a
   second card every time it is pressed. */
create unique index if not exists crew_client_member_key
  on public.crew (client_id, crew_member_id) where crew_member_id is not null;


-- ── who may see any of it ───────────────────────────────────────────────────
alter table public.crew_members enable row level security;

drop policy if exists crew_members_all on public.crew_members;
create policy crew_members_all on public.crew_members for all
  using      (public.owns_producer(producer_id) or public.is_super_admin())
  with check (public.owns_producer(producer_id) or public.is_super_admin());

grant select, insert, update, delete on public.crew_members to authenticated;
grant select, insert, update, delete on public.crew_members to service_role;


-- ── putting one of them on an evening ───────────────────────────────────────
--  A copy rather than a reference, for the reason on the table above, and in
--  the database rather than in the app so that the copy is taken the same way
--  from every screen that ever assigns somebody.
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

  /* Already on this evening. Move them to the role being asked for rather
     than refusing or adding a second card: pressing assign on somebody who is
     already there is somebody changing their mind about the role, every
     time. */
  select id into v_id from public.crew
   where client_id = p_client and crew_member_id = p_member limit 1;
  if found then
    update public.crew set slot = p_slot where id = v_id;
    return v_id;
  end if;

  insert into public.crew (client_id, crew_member_id, name, role, phone, slot)
  values (p_client, m.id, m.name, coalesce(p_slot, ''), m.phone, p_slot)
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.assign_crew(uuid, uuid, text) from public;
grant execute on function public.assign_crew(uuid, uuid, text) to authenticated, service_role;


-- ── live, like everything else two people edit at once ──────────────────────
do $$
begin
  execute 'alter table public.crew_members replica identity full';
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crew_members'
  ) then
    execute 'alter publication supabase_realtime add table public.crew_members';
  end if;
exception when undefined_object then
  /* No realtime publication on this database. Nothing to add it to, and the
     rest of the migration has nothing to do with it. */
  null;
end $$;
