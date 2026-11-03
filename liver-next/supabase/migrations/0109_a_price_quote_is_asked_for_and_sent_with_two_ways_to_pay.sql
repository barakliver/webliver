-- ============================================================================
--  0109 — a price quote is asked for, and goes out with two ways to pay
-- ============================================================================
--  A producer answers an enquiry with a number, and until now the number lived
--  in a WhatsApp message: nothing on the card said what was quoted, when, or
--  whether it was ever opened. The lead's timeline already had a
--  `proposal_sent` entry and the pipeline already had a stage of that name;
--  nothing ever wrote either.
--
--  So: the system asks the producer for the amount, writes it down, and sends
--  the couple a link. The page behind the link shows the amount and the two
--  ways to pay it, a payment page of the producer's own choosing and a bank
--  transfer, and lets the couple say which they will use.
--
--  What this deliberately is not: a payment processor. The payment link is a
--  URL the producer pasted from whichever clearing service they already have,
--  and the system never sees a card number or learns by itself that money
--  moved. "The couple said they transferred" is a claim and is recorded as
--  one; `paid_at` is only ever written by the producer, who is the one holding
--  the bank statement.
--
--  Four properties, each a way a quote normally goes wrong:
--
--    · The two ways to pay are COPIED onto the quote when it is sent. Changing
--      the bank account in settings next March must not change what a couple
--      was shown in October, and above all must not change where a transfer
--      they have not yet made will go.
--    · The link is a credential and is read through security definer
--      functions that return only the columns a couple may see, never the
--      producer's other quotes, never the lead's score or notes.
--    · A wrong token, a withdrawn quote and a quote that never existed all
--      answer the same way: nothing. A page that distinguished them would
--      confirm a guess.
--    · Nothing here is destroyed by a later change: every constraint is
--      `not valid`, every function that returns a table is dropped before it
--      is created, and the table is new.
-- ============================================================================

-- ── where the producer is paid, written once ────────────────────────────────
alter table public.producers
  add column if not exists payment_link text not null default '',
  add column if not exists bank_details text not null default '';

do $$ begin
  alter table public.producers add constraint producers_pay_len
    check (char_length(payment_link) <= 500 and char_length(bank_details) <= 1200) not valid;
exception when duplicate_object then null; end $$;


-- ── the quote ───────────────────────────────────────────────────────────────
create table if not exists public.price_quotes (
  id          uuid primary key default gen_random_uuid(),
  producer_id uuid not null references public.producers(id) on delete cascade,
  /* The card it was sent from. Set null on delete: a quote is a record of
     something said to somebody, and outlives the card it came from. */
  lead_id     uuid references public.leads(id) on delete set null,
  to_name     text not null default '',
  to_email    text not null default '',
  title       text not null default '',
  note        text not null default '',
  amount      numeric(12, 2) not null,
  valid_until date,
  /* Long enough that guessing is not a strategy. */
  token       text not null,
  /* The two ways to pay, as they were on the day it was sent. */
  pay_link    text not null default '',
  bank_text   text not null default '',
  status      text not null default 'sent',
  /* What the couple said they will do, and when. 'link' or 'bank'. */
  choice      text,
  choice_at   timestamptz,
  viewed_at   timestamptz,
  /* Written by the producer and by nobody else. */
  paid_at     timestamptz,
  emailed_at  timestamptz,
  created_at  timestamptz not null default now()
);

create unique index if not exists price_quotes_token_key on public.price_quotes (token);
create index if not exists price_quotes_lead_idx on public.price_quotes (lead_id, created_at desc);
create index if not exists price_quotes_producer_idx on public.price_quotes (producer_id, created_at desc);

do $$ begin
  alter table public.price_quotes add constraint price_quotes_amount_sane
    check (amount > 0 and amount < 100000000) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.price_quotes add constraint price_quotes_status_set
    check (status in ('sent', 'paid', 'withdrawn')) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.price_quotes add constraint price_quotes_choice_set
    check (choice is null or choice in ('link', 'bank')) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.price_quotes add constraint price_quotes_text_len
    check (char_length(to_name) <= 160 and char_length(to_email) <= 200
           and char_length(title) <= 160 and char_length(note) <= 2000
           and char_length(pay_link) <= 500 and char_length(bank_text) <= 1200) not valid;
exception when duplicate_object then null; end $$;

alter table public.price_quotes enable row level security;

--  The producer reads and corrects their own. There is no insert policy on
--  purpose: a quote is born through create_price_quote(), which copies the two
--  ways to pay and mints the token, and an insert that skipped it would be a
--  quote with no token or somebody else's bank account in it.
drop policy if exists price_quotes_read on public.price_quotes;
create policy price_quotes_read on public.price_quotes for select
  using (public.owns_producer(producer_id));

drop policy if exists price_quotes_update on public.price_quotes;
create policy price_quotes_update on public.price_quotes for update
  using (public.owns_producer(producer_id))
  with check (public.owns_producer(producer_id));


-- ── making one ──────────────────────────────────────────────────────────────
--  Asks for nothing the producer did not type. The email is the lead's unless
--  the producer gave another, and a quote with no way to pay is refused here
--  as well as on the screen: a form is a suggestion and a function is a door.
/* `extensions` beside `public` for the reason 0037 wrote down: gen_random_bytes
   lives in `extensions` on Supabase and the body is resolved when it runs. */
drop function if exists public.create_price_quote(uuid, numeric, text, text, date, text);
create or replace function public.create_price_quote(
  p_lead uuid, p_amount numeric, p_title text, p_note text, p_valid_until date, p_email text
) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  l   public.leads%rowtype;
  pr  public.producers%rowtype;
  tok text;
  who text;
  mail text;
begin
  select * into l from public.leads where id = p_lead;
  if not found or l.producer_id is null or not public.owns_producer(l.producer_id) then
    raise exception 'that enquiry does not exist';
  end if;
  select * into pr from public.producers where id = l.producer_id;

  if p_amount is null or p_amount <= 0 then raise exception 'נא להזין סכום'; end if;
  if btrim(pr.payment_link) = '' and btrim(pr.bank_details) = '' then
    raise exception 'נא להגדיר קודם לאן משלמים';
  end if;

  mail := btrim(coalesce(nullif(btrim(p_email), ''), l.email));
  if mail = '' then raise exception 'אין כתובת מייל'; end if;

  who := btrim(l.full_name || case when coalesce(l.partner_name, '') <> '' then ' ו' || l.partner_name else '' end);
  tok := encode(gen_random_bytes(24), 'hex');

  insert into public.price_quotes
    (producer_id, lead_id, to_name, to_email, title, note, amount, valid_until, token, pay_link, bank_text)
  values
    (pr.id, l.id, left(who, 160), left(mail, 200), left(btrim(coalesce(p_title, '')), 160),
     left(btrim(coalesce(p_note, '')), 2000), round(p_amount, 2), p_valid_until, tok,
     btrim(pr.payment_link), btrim(pr.bank_details));
  return tok;
end $$;
grant execute on function public.create_price_quote(uuid, numeric, text, text, date, text)
  to authenticated, service_role;


-- ── reading one, with nothing but the token ─────────────────────────────────
--  A withdrawn quote returns nothing, like a quote that never was. Nothing
--  about the lead comes back, only what the couple was told.
drop function if exists public.price_quote_by_token(text);
create or replace function public.price_quote_by_token(p_token text)
returns table (
  title text, note text, amount numeric, valid_until date, status text,
  choice text, pay_link text, bank_text text, to_name text, brand text, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select q.title, q.note, q.amount, q.valid_until, q.status,
         q.choice, q.pay_link, q.bank_text, q.to_name,
         coalesce(pr.brand_name, ''), q.created_at
    from public.price_quotes q
    join public.producers pr on pr.id = q.producer_id
   where q.token = p_token
     and char_length(coalesce(p_token, '')) >= 32
     and q.status <> 'withdrawn'
$$;
grant execute on function public.price_quote_by_token(text) to anon, authenticated, service_role;

--  Opening it is written down once, the first time. Mail scanners open links
--  too, so this is "opened" and not "read", and the screen says opened.
create or replace function public.price_quote_opened(p_token text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if char_length(coalesce(p_token, '')) < 32 then return; end if;
  update public.price_quotes set viewed_at = now()
   where token = p_token and viewed_at is null and status <> 'withdrawn';
end $$;
grant execute on function public.price_quote_opened(text) to anon, authenticated, service_role;


-- ── saying which way ────────────────────────────────────────────────────────
--  A claim, not a fact: it records what the couple said they will do and rings
--  the producer. Changing their mind is allowed until it is paid; the last
--  answer stands. Every refusal reads the same to a wrong token.
create or replace function public.price_quote_choose(p_token text, p_choice text) returns void
language plpgsql security definer set search_path = public as $$
declare
  q     public.price_quotes%rowtype;
  owner uuid;
  how   text;
begin
  if char_length(coalesce(p_token, '')) < 32 or p_choice not in ('link', 'bank') then
    raise exception 'that quote does not exist';
  end if;
  select * into q from public.price_quotes where token = p_token and status = 'sent';
  if not found then raise exception 'that quote does not exist'; end if;

  update public.price_quotes set choice = p_choice, choice_at = now() where id = q.id;

  select owner_id into owner from public.producers where id = q.producer_id;
  if owner is not null then
    how := case when p_choice = 'bank' then 'העברה בנקאית' else 'קישור תשלום' end;
    perform public.notify(owner, 'payment',
      coalesce(nullif(q.to_name, ''), 'הצעת מחיר') || ' בחרו ב' || how,
      'הצעה על ' || trim(to_char(q.amount, 'FM999G999G999')) || ' ₪',
      case when q.lead_id is not null then '/app/leads/' || q.lead_id else '/app/leads' end);
  end if;
end $$;
grant execute on function public.price_quote_choose(text, text) to anon, authenticated, service_role;

comment on table public.price_quotes is
  'A price a producer put to an enquiry, sent as a link with two ways to pay. The ways to pay are copied at send time; paid_at is written only by the producer.';

-- ── live, so "they said they will transfer" appears while the card is open ──
do $$
begin
  execute 'alter table public.price_quotes replica identity full';
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'price_quotes'
  ) then
    execute 'alter publication supabase_realtime add table public.price_quotes';
  end if;
exception when undefined_object then
  null;
end $$;
