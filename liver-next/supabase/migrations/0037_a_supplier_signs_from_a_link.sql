-- ============================================================================
--  0037 — a supplier signs from a link, with no account
-- ============================================================================
--  0019 built a signature that means something: the terms freeze on signature
--  by a trigger rather than by a screen that hides a button, and the exact text
--  is fingerprinted so later tampering is detectable rather than a matter of
--  opinion. All of that stands and none of it is loosened here.
--
--  What it could not do was reach anybody outside the workspace. A DJ, a
--  caterer or a rabbi is not going to open an account to agree a price, and a
--  contract that requires one is a contract that goes back to WhatsApp.
--
--  So: the same door 0006 opened for a guest confirming attendance. A long
--  random token, security definer functions that take it, and no other way in.
--  The token is the credential; there is no account, no password and nothing
--  to guess.
--
--  Three properties this keeps, and each one is a way an e-signature is
--  normally worse than paper:
--
--    · A link can be withdrawn. Revoking it does not un-sign anything already
--      signed, because that is a record, but it closes the door.
--    · Signing through a link records that it was a link. A signature whose
--      provenance is unknown is a signature somebody can argue with later.
--    · The producer still cannot sign for the other side. That was true for
--      the couple in 0019 and it is true here.
-- ============================================================================

-- ── who the other side is, and how they get in ──────────────────────────────
alter table public.contracts
  add column if not exists party_name  text not null default '',
  add column if not exists party_role  text not null default '',
  add column if not exists party_phone text not null default '',
  add column if not exists party_email text not null default '',
  /* Null until a link is made, and set back to null to withdraw one. */
  add column if not exists sign_token  text,
  /* How it was signed. 'account' is the couple in the portal, 'link' is
     somebody who opened a URL. Recorded because provenance is part of what a
     signature is worth. */
  add column if not exists signed_via  text;

do $$ begin
  alter table public.contracts add constraint contracts_party_len
    check (char_length(party_name) <= 120 and char_length(party_role) <= 80
           and char_length(party_phone) <= 40 and char_length(party_email) <= 200);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.contracts add constraint contracts_signed_via
    check (signed_via is null or signed_via in ('account', 'link'));
exception when duplicate_object then null; end $$;

/* A token is long enough that guessing is not a strategy, and unique so a
   collision cannot hand one supplier another's contract. Partial, so the many
   contracts with no link do not all collide on null. */
create unique index if not exists contracts_sign_token_key
  on public.contracts (sign_token) where sign_token is not null;

--  The completeness rule from 0019 said a signed contract must name an account.
--  A supplier has no account, so the rule becomes: a signed contract must name
--  *somebody*, by profile or by having come through a link. Half a signature is
--  still not storable.
alter table public.contracts drop constraint if exists contracts_signature_complete;
alter table public.contracts add constraint contracts_signature_complete check (
  (status <> 'signed')
  or (signed_at is not null
      and coalesce(btrim(signed_name), '') <> ''
      and signed_hash is not null
      and (signed_by is not null or signed_via = 'link'))
);


-- ── the freeze, extended to the new columns ─────────────────────────────────
--  Not decoration: without this a producer could change the supplier's name on
--  a signed agreement, which is the same class of edit the freeze exists to
--  prevent. The token is deliberately left editable so a link can be withdrawn
--  after signature without touching the record.
create or replace function public.freeze_signed_contract() returns trigger
language plpgsql as $$
begin
  if old.status = 'signed' then
    if new.title      is distinct from old.title
    or new.body       is distinct from old.body
    or new.file_path  is distinct from old.file_path
    or new.amount     is distinct from old.amount
    or new.party_name is distinct from old.party_name
    or new.party_role is distinct from old.party_role
    or new.signed_at   is distinct from old.signed_at
    or new.signed_by   is distinct from old.signed_by
    or new.signed_name is distinct from old.signed_name
    or new.signed_hash is distinct from old.signed_hash
    or new.signed_via  is distinct from old.signed_via
    then
      raise exception 'a signed agreement cannot be changed';
    end if;
  end if;
  return new;
end $$;


-- ── reading one, with nothing but the token ─────────────────────────────────
--  Returns the document and who it is for, and nothing about the workspace it
--  belongs to. A supplier is being shown their own agreement, not given a
--  window into a wedding.
--
--  A draft is never returned. Somebody reading terms that are still being
--  written, which then change, is how people stop trusting a document.
create or replace function public.contract_by_token(p_token text)
returns table (
  id uuid, title text, body text, file_path text, amount numeric,
  party_name text, party_role text, status contract_state,
  signed_at timestamptz, signed_name text, brand text
)
language sql stable security definer set search_path = public as $$
  select c.id, c.title, c.body, c.file_path, c.amount,
         c.party_name, c.party_role, c.status,
         c.signed_at, c.signed_name,
         coalesce(pr.brand_name, '')
    from public.contracts c
    join public.clients   cl on cl.id = c.client_id
    join public.producers pr on pr.id = cl.producer_id
   where c.sign_token = p_token
     and char_length(coalesce(p_token, '')) >= 32
     and c.status in ('sent', 'signed')
$$;
grant execute on function public.contract_by_token(text) to anon, authenticated, service_role;


-- ── signing with it ─────────────────────────────────────────────────────────
--  One transition, and every refusal says the same thing to somebody holding a
--  wrong token: this does not exist. A message that distinguishes "no such
--  contract" from "already signed" is a message that confirms a guess.
create or replace function public.sign_contract_by_token(p_token text, p_name text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  c    public.contracts%rowtype;
  name text := btrim(coalesce(p_name, ''));
begin
  if char_length(coalesce(p_token, '')) < 32 then
    raise exception 'that agreement does not exist';
  end if;

  select * into c from public.contracts where sign_token = p_token;
  if not found then
    raise exception 'that agreement does not exist';
  end if;
  if c.status = 'signed' then
    raise exception 'this is already signed';
  end if;
  if c.status <> 'sent' then
    raise exception 'that agreement does not exist';
  end if;
  if char_length(name) < 2 then
    raise exception 'נא לחתום בשם מלא';
  end if;

  update public.contracts
     set status      = 'signed',
         signed_at   = now(),
         /* No account behind this signature, deliberately. What is recorded is
            the name typed, the moment, the fingerprint of what was on screen,
            and that it came through a link. */
         signed_by   = null,
         signed_via  = 'link',
         signed_name = left(name, 120),
         signed_hash = public.contract_digest(c.title, c.body, c.file_path, c.amount)
   where id = c.id;
end $$;
grant execute on function public.sign_contract_by_token(text, text) to anon, authenticated, service_role;


-- ── making and withdrawing a link ───────────────────────────────────────────
--  The producer's side. Making a link also moves a draft to sent, because a
--  link to a draft is a link to terms that can still change underneath it.
/* `extensions` is named alongside `public`, and it is not decoration: this
   function calls gen_random_bytes, pgcrypto lives in `extensions` on Supabase
   and in `public` on a plain PostgreSQL install, and a plpgsql body is resolved
   when it runs rather than when it is created. Pinned to `public` alone it
   creates without complaint and then fails on the first click, which is exactly
   what it did. 0019 wrote that warning down; this is it happening again. */
create or replace function public.issue_sign_link(p_contract uuid)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  c   public.contracts%rowtype;
  tok text;
begin
  select * into c from public.contracts where id = p_contract;
  if not found or not public.owns_producer(public.producer_of_client(c.client_id)) then
    raise exception 'that agreement does not exist';
  end if;
  if c.status = 'void' then raise exception 'this agreement was withdrawn'; end if;

  /* An existing link is returned rather than replaced. Issuing twice from two
     screens must not quietly kill the link already sitting in somebody's
     WhatsApp. */
  if c.sign_token is not null then return c.sign_token; end if;

  tok := encode(gen_random_bytes(24), 'hex');
  update public.contracts
     set sign_token = tok,
         status     = case when status = 'draft' then 'sent'::contract_state else status end,
         sent_at    = coalesce(sent_at, now())
   where id = p_contract;
  return tok;
end $$;
grant execute on function public.issue_sign_link(uuid) to authenticated, service_role;

create or replace function public.revoke_sign_link(p_contract uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare c public.contracts%rowtype;
begin
  select * into c from public.contracts where id = p_contract;
  if not found or not public.owns_producer(public.producer_of_client(c.client_id)) then
    raise exception 'that agreement does not exist';
  end if;
  /* Withdrawing a link never un-signs anything. What was signed is a record. */
  update public.contracts set sign_token = null where id = p_contract;
end $$;
grant execute on function public.revoke_sign_link(uuid) to authenticated, service_role;
