-- ============================================================================
--  0022 — signing in by phone, without becoming a second person
-- ============================================================================
--  Supabase treats an email sign-in and a phone sign-in as two different
--  accounts. Left alone, that is not a feature with a rough edge, it is a
--  trap: the root admin signs in by phone one morning and arrives as a brand
--  new producer awaiting approval, with no events and no permissions; a bride
--  who was invited by email and signs in by phone lands in an empty portal and
--  concludes the app lost her wedding.
--
--  So the work here is not sending an SMS. It is making one person resolve to
--  one account whichever way they arrive, which means the workspace has to
--  recognise a phone number the same way it already recognises an address.
--
--  An invitation is now a contact rather than an email: it carries an address,
--  a number, or both, and the cap of three counts people rather than channels.
-- ============================================================================

-- ── one shape for a number ──────────────────────────────────────────────────
--  A phone is typed six different ways by the same person in the same week.
--  Everything is compared in E.164, and the raw form is never what is matched
--  on — that is how "050-123-4567" and "+972 50 123 4567" become two guests,
--  two invitations, or two accounts.
create or replace function public.normalize_phone(raw text) returns text
language plpgsql immutable set search_path = public as $$
declare d text;
begin
  if raw is null then return null; end if;
  d := regexp_replace(raw, '\D', '', 'g');
  if d = '' then return null; end if;

  /* Israeli numbers, in the forms people actually type. Anything already
     carrying a country code is left as it is, so this does not quietly mangle
     a number from somewhere else. */
  if d ~ '^0[5][0-9]{8}$'      then return '+972' || substring(d from 2); end if;
  if d ~ '^0[2-9][0-9]{7,8}$'  then return '+972' || substring(d from 2); end if;
  if d ~ '^972[0-9]{8,9}$'     then return '+' || d; end if;
  if length(d) between 8 and 15 then return '+' || d; end if;
  return null;
end $$;

grant execute on function public.normalize_phone(text) to anon, authenticated, service_role;


-- ── a person may have a number, an address, or both ─────────────────────────
alter table public.profiles add column if not exists phone text;

/* email stops being mandatory, because somebody who arrives by phone has none.
   It also stops being stored as an empty string: profiles_email_key is a
   unique index on lower(email), and '' is a value like any other — so the
   first phone-only signup took the empty slot and the second was refused with
   a duplicate key error. Found by signing two people up by phone in a test,
   which is the only way this shows. */
alter table public.profiles alter column email drop not null;
update public.profiles set email = null where btrim(coalesce(email, '')) = '';

drop index if exists profiles_email_key;
create unique index if not exists profiles_email_key
  on public.profiles (lower(email)) where email is not null;

do $$ begin
  alter table public.profiles
    add constraint profiles_has_a_contact
    check (coalesce(btrim(email), '') <> '' or coalesce(btrim(phone), '') <> '');
exception when duplicate_object then null; end $$;

comment on column public.profiles.phone is
  'E.164. The second way the same person can arrive; never a second person.';

/* A number belongs to one account, the same as an address does. Partial,
   because most accounts have no number and null is not a duplicate. */
create unique index if not exists profiles_phone_key
  on public.profiles (phone) where phone is not null;


-- ── an invitation is a contact, not an address ──────────────────────────────
alter table public.client_authorized_emails add column if not exists phone text;
alter table public.client_authorized_emails alter column email drop not null;

do $$ begin
  alter table public.client_authorized_emails
    add constraint cae_has_a_contact
    check (coalesce(btrim(email), '') <> '' or coalesce(btrim(phone), '') <> '');
exception when duplicate_object then null; end $$;

/* The old index assumed every row had an address. Two phone-only invitations
   would both carry an empty email and collide on it. */
drop index if exists cae_client_email_key;
create unique index if not exists cae_client_email_key
  on public.client_authorized_emails (client_id, lower(email)) where email is not null;
create unique index if not exists cae_client_phone_key
  on public.client_authorized_emails (client_id, phone) where phone is not null;

/* Numbers are stored normalised, so a match is a match. */
create or replace function public.cae_normalize() returns trigger
language plpgsql set search_path = public as $$
begin
  new.phone := public.normalize_phone(new.phone);
  new.email := nullif(lower(btrim(coalesce(new.email, ''))), '');
  return new;
end $$;

drop trigger if exists cae_normalize on public.client_authorized_emails;
create trigger cae_normalize before insert or update on public.client_authorized_emails
  for each row execute function public.cae_normalize();


-- ── the workspace recognises either ─────────────────────────────────────────
create or replace function public.can_read_client(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select
    public.is_super_admin()
    or exists (select 1 from public.clients c join public.producers pr on pr.id = c.producer_id
               where c.id = cid and pr.owner_id = auth.uid())
    or exists (
      select 1
        from public.client_authorized_emails e
        join public.profiles p on p.id = auth.uid()
       where e.client_id = cid
         and (
           (e.email is not null and p.email is not null and lower(e.email) = lower(p.email))
           or (e.phone is not null and p.phone is not null and e.phone = p.phone)
         )
    )
$$;


-- ── arriving for the first time, by either door ─────────────────────────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  addr       text := nullif(lower(btrim(coalesce(new.email, ''))), '');
  tel        text := public.normalize_phone(new.phone);
  is_root    boolean;
  is_invited boolean;
  existing   uuid;
  new_role   app_role;
begin
  /* If this number or address already belongs to somebody, the person is not
     new — they have walked in through the other door. Adopt the identity that
     exists rather than minting a rival one, and fill in whichever contact was
     missing so the next arrival by either route lands in the same place. */
  select id into existing from public.profiles
   where (tel is not null and phone = tel)
      or (addr is not null and lower(email) = addr)
   limit 1;

  if existing is not null then
    update public.profiles
       set phone = coalesce(phone, tel),
           email = coalesce(email, addr)
     where id = existing;
    return new;
  end if;

  /* Root is pinned to the address and only the address. A number can be
     changed at a phone shop; the address is the thing this platform's
     ownership is defined by, and it stays the only way in to that role. */
  is_root := addr is not null and addr = public.root_admin_email();

  is_invited := exists (
    select 1 from public.client_authorized_emails e
     where (addr is not null and e.email is not null and lower(e.email) = addr)
        or (tel is not null and e.phone is not null and e.phone = tel)
  );

  new_role := case
    when is_root    then 'super_admin'::app_role
    when is_invited then 'client'::app_role
    else 'producer'::app_role
  end;

  insert into public.profiles (id, email, full_name, role, phone)
  values (new.id, addr, coalesce(new.raw_user_meta_data->>'full_name',''), new_role, tel)
  on conflict (id) do nothing;

  if is_invited then
    update public.client_authorized_emails
       set profile_id = new.id
     where profile_id is null
       and ((addr is not null and email is not null and lower(email) = addr)
         or (tel is not null and phone is not null and phone = tel));
  end if;

  if new_role in ('producer','super_admin') then
    insert into public.producers (owner_id, brand_name, contact_name, contact_email, status)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'brand_name',''),
      coalesce(new.raw_user_meta_data->>'full_name',''),
      coalesce(addr, ''),
      case when is_root then 'approved'::producer_state else 'pending'::producer_state end
    );
  end if;

  return new;
end $$;


-- ── invited after they already signed up ────────────────────────────────────
create or replace function public.bind_authorized_email() returns trigger
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select id, role into p from public.profiles
   where (new.email is not null and lower(email) = lower(new.email))
      or (new.phone is not null and phone = new.phone)
   limit 1;

  if found then
    new.profile_id := p.id;

    if p.role = 'producer'
       and not exists (select 1 from public.producers pr
                       where pr.owner_id = p.id and pr.status = 'approved') then
      update public.profiles set role = 'client' where id = p.id;

      delete from public.producers pr
       where pr.owner_id = p.id
         and pr.status <> 'approved'
         and not exists (select 1 from public.clients c where c.producer_id = pr.id);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists cae_bind on public.client_authorized_emails;
create trigger cae_bind before insert on public.client_authorized_emails
  for each row execute function public.bind_authorized_email();


-- ── existing numbers get the same shape ─────────────────────────────────────
update public.client_authorized_emails
   set phone = public.normalize_phone(phone)
 where phone is not null and phone <> public.normalize_phone(phone);


-- ── a name for somebody who has no address ──────────────────────────────────
--  thread_people fell back to the local part of the email. Somebody who signed
--  in by phone has none, and a message signed by nobody is the bug this
--  function was written to fix in the first place.
create or replace function public.thread_people(p_client uuid)
returns table (id uuid, display_name text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select p.id,
         coalesce(
           nullif(btrim(p.full_name), ''),
           nullif(split_part(coalesce(p.email, ''), '@', 1), ''),
           /* last four digits, which is how people refer to a number they
              have not saved, and never the whole thing on somebody's screen */
           case when p.phone is not null then '…' || right(p.phone, 4) end,
           'משתתף'
         ),
         p.avatar_url
    from public.profiles p
   where public.can_read_client(p_client)
     and (
       p.id = public.client_producer_profile(p_client)
       or p.id in (select public.client_couple_profiles(p_client))
     )
$$;
grant execute on function public.thread_people(uuid) to authenticated, service_role;
