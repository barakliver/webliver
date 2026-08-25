-- ============================================================================
--  0019 — contracts, and a signature that means something
-- ============================================================================
--  The whole value of signing something in an app rather than on paper is that
--  both sides can later agree on what was signed. That is one property, and
--  everything here exists to hold it: after a signature, the terms cannot
--  change.
--
--  Without that, an "e-signature" is worse than a scanned page — it looks
--  authoritative while the producer can quietly edit the amount afterwards and
--  nobody can tell. So the terms are frozen by a trigger, not by a screen that
--  hides the edit button, and the exact text signed is fingerprinted at the
--  moment of signing so any later tampering is detectable rather than a matter
--  of opinion.
-- ============================================================================

alter type notice_kind add value if not exists 'contract';

do $$ begin
  create type contract_state as enum ('draft','sent','signed','void');
exception when duplicate_object then null; end $$;

create table if not exists public.contracts (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  title       text not null default '',
  /* The terms, as text. A producer who already has a PDF attaches it instead
     and leaves this short — but something readable has to exist on screen, or
     the couple is signing a filename. */
  body        text not null default '',
  file_path   text,
  amount      numeric(12,2),
  status      contract_state not null default 'draft',

  sent_at     timestamptz,
  signed_at   timestamptz,
  signed_by   uuid references public.profiles(id) on delete set null,
  /* The name typed at the moment of signing, kept verbatim. A profile can be
     renamed later; what somebody signed as cannot be. */
  signed_name text,
  /* Fingerprint of exactly what was on screen when they signed. */
  signed_hash text,

  created_at  timestamptz not null default now(),
  constraint contracts_title_len check (char_length(title) <= 200),
  constraint contracts_body_len  check (char_length(body) <= 60000),
  constraint contracts_amount_sane check (amount is null or (amount >= 0 and amount < 100000000)),
  /* A signed contract carries its whole signature or none of it. Half a
     signature is a bug that would otherwise be storable. */
  constraint contracts_signature_complete check (
    (status <> 'signed')
    or (signed_at is not null and signed_by is not null
        and coalesce(btrim(signed_name), '') <> '' and signed_hash is not null)
  )
);
create index if not exists contracts_client_idx on public.contracts (client_id, created_at desc);

alter table public.contracts enable row level security;


-- ── what a signature covers ─────────────────────────────────────────────────
--  Title, terms, attached file and amount: everything a person would read
--  before agreeing. Status and timestamps are deliberately outside it, since
--  they change as a consequence of signing rather than being part of the deal.
create or replace function public.contract_digest(
  p_title text, p_body text, p_file text, p_amount numeric
) returns text
language sql immutable set search_path = public as $$
  select encode(
    digest(
      coalesce(p_title,'') || E'\n\x1e' ||
      coalesce(p_body,'')  || E'\n\x1e' ||
      coalesce(p_file,'')  || E'\n\x1e' ||
      coalesce(p_amount::text,''),
      'sha256'
    ), 'hex')
$$;


-- ── the terms stop moving once somebody has agreed to them ──────────────────
create or replace function public.freeze_signed_contract() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status <> 'signed' then
    return new;
  end if;

  if public.contract_digest(new.title, new.body, new.file_path, new.amount)
     is distinct from
     public.contract_digest(old.title, old.body, old.file_path, old.amount) then
    raise exception 'a signed contract cannot be edited';
  end if;

  /* Nor can the signature itself be rewritten or moved onto somebody else. */
  if new.signed_at   is distinct from old.signed_at
     or new.signed_by   is distinct from old.signed_by
     or new.signed_name is distinct from old.signed_name
     or new.signed_hash is distinct from old.signed_hash then
    raise exception 'a signature cannot be altered';
  end if;

  /* Voiding stays available — a deal really can be cancelled — but it is the
     only status a signed contract may move to, and it does not erase what was
     signed. */
  if new.status <> old.status and new.status <> 'void' then
    raise exception 'a signed contract can only be voided';
  end if;

  return new;
end $$;

drop trigger if exists contracts_freeze on public.contracts;
create trigger contracts_freeze before update on public.contracts
  for each row execute function public.freeze_signed_contract();

/* Deleting a signed contract would be the same hole by another route. */
create or replace function public.block_signed_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'signed' then
    raise exception 'a signed contract cannot be deleted, only voided';
  end if;
  return old;
end $$;

drop trigger if exists contracts_no_delete on public.contracts;
create trigger contracts_no_delete before delete on public.contracts
  for each row execute function public.block_signed_delete();


-- ── who sees and who writes ─────────────────────────────────────────────────
--  A draft is the producer's working copy: the couple has no business seeing
--  terms that are still being written, and being shown a draft that then
--  changes is how people stop trusting a document.
drop policy if exists contracts_read on public.contracts;
create policy contracts_read on public.contracts for select using (
  public.owns_producer(public.producer_of_client(client_id))
  or public.is_super_admin()
  or (public.can_read_client(client_id) and status <> 'draft')
);

drop policy if exists contracts_write on public.contracts;
create policy contracts_write on public.contracts for all using (
  public.owns_producer(public.producer_of_client(client_id)) or public.is_super_admin()
) with check (
  public.owns_producer(public.producer_of_client(client_id)) or public.is_super_admin()
);


-- ── signing ─────────────────────────────────────────────────────────────────
--  A function rather than an update policy, because signing is not an edit.
--  It is one transition, available to one kind of person, that records who and
--  when and exactly what — and a policy broad enough to allow it would also
--  allow the couple to change the amount on their way past.
create or replace function public.sign_contract(p_contract uuid, p_name text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  c    public.contracts%rowtype;
  name text := btrim(coalesce(p_name, ''));
begin
  select * into c from public.contracts where id = p_contract;
  if not found then
    raise exception 'that contract does not exist';
  end if;
  if not public.can_read_client(c.client_id) then
    raise exception 'that contract does not exist';
  end if;

  /* The producer drafts it; the couple agrees to it. A producer signing their
     own contract on the couple's behalf is the one thing this must not allow,
     however convenient it would be on a phone call. */
  if public.owns_producer(public.producer_of_client(c.client_id)) then
    raise exception 'the couple signs this, not the producer';
  end if;

  if c.status = 'signed' then raise exception 'this is already signed'; end if;
  if c.status <> 'sent'   then raise exception 'this is not open for signature'; end if;
  if char_length(name) < 2 then raise exception 'נא לחתום בשם מלא'; end if;

  update public.contracts
     set status      = 'signed',
         signed_at   = now(),
         signed_by   = auth.uid(),
         signed_name = left(name, 120),
         signed_hash = public.contract_digest(c.title, c.body, c.file_path, c.amount)
   where id = p_contract;
end $$;

revoke all on function public.sign_contract(uuid, text) from public;
grant execute on function public.sign_contract(uuid, text) to authenticated, service_role;

/** Does the document still match what was signed? Anybody on the workspace can
    ask, which is the point — an integrity claim nobody can check is a slogan. */
create or replace function public.contract_intact(p_contract uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when c.status <> 'signed' then true
    else c.signed_hash = public.contract_digest(c.title, c.body, c.file_path, c.amount)
  end
  from public.contracts c
  where c.id = p_contract and public.can_read_client(c.client_id)
$$;
grant execute on function public.contract_intact(uuid) to authenticated, service_role;


-- ── telling people ──────────────────────────────────────────────────────────
create or replace function public.notify_contract() returns trigger
language plpgsql security definer set search_path = public as $$
declare who uuid; producer uuid;
begin
  if tg_op = 'UPDATE' and old.status = 'draft' and new.status = 'sent' then
    for who in select public.client_couple_profiles(new.client_id) loop
      perform public.notify(who, 'contract', 'הסכם ממתין לחתימה',
        coalesce(nullif(new.title,''), 'הסכם הפקה'), '/app/portal');
    end loop;
  elsif tg_op = 'UPDATE' and old.status <> 'signed' and new.status = 'signed' then
    producer := public.client_producer_profile(new.client_id);
    perform public.notify(producer, 'contract', 'ההסכם נחתם',
      coalesce(new.signed_name,'') || ' · ' || coalesce(nullif(new.title,''), 'הסכם הפקה'),
      '/app/clients/' || new.client_id);
  end if;
  return new;
end $$;

drop trigger if exists contracts_notify on public.contracts;
create trigger contracts_notify after update on public.contracts
  for each row execute function public.notify_contract();


-- ── the attached document ───────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('contracts', 'contracts', false)
on conflict (id) do nothing;

drop policy if exists contract_objects_read on storage.objects;
create policy contract_objects_read on storage.objects for select
  using (bucket_id = 'contracts' and public.can_read_client(public.storage_client_id(name)));

/* Only the producer puts a document there; the couple reads it. */
drop policy if exists contract_objects_write on storage.objects;
create policy contract_objects_write on storage.objects for insert
  with check (bucket_id = 'contracts'
              and public.owns_producer(public.producer_of_client(public.storage_client_id(name))));

drop policy if exists contract_objects_delete on storage.objects;
create policy contract_objects_delete on storage.objects for delete
  using (bucket_id = 'contracts'
         and public.owns_producer(public.producer_of_client(public.storage_client_id(name))));


-- ── live, like everything else ──────────────────────────────────────────────
alter table public.contracts replica identity full;
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'contracts'
  ) then
    alter publication supabase_realtime add table public.contracts;
  end if;
end $$;

grant all on public.contracts to authenticated, service_role;
