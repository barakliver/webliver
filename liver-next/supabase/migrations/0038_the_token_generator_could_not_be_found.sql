-- ============================================================================
--  0038 — the link button failed on the first click
-- ============================================================================
--  `issue_sign_link` was created with `set search_path = public`, and it calls
--  gen_random_bytes. pgcrypto lives in `extensions` on Supabase and in `public`
--  on a plain PostgreSQL install, so pinned to `public` alone the name does not
--  resolve there.
--
--  It did not fail on the way in. A `language plpgsql` body is parsed when the
--  function runs rather than when it is created, so 0037 applied cleanly and
--  the button then reported "we could not make a link" every time it was
--  pressed. 0019 wrote this warning down in a comment for exactly this reason,
--  and the warning was not enough.
--
--  Nothing else changes. Same function, same rules, one clause longer.
-- ============================================================================

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
