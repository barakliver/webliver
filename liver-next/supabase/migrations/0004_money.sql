-- ============================================================================
--  0004 — budget lines and payments
-- ============================================================================
--  Two different questions that kept being confused for one:
--    "what do we expect this wedding to cost"      -> budget_items
--    "what has the couple paid us, and what is due" -> payments
--
--  Who may write is not symmetric. A couple reading what they owe is the
--  point of the screen; a couple marking themselves as paid is not. So money
--  is written by the producer who owns the workspace, and read by both.
--
--  The old app hid the budget from the couple by default and let the producer
--  reveal it, so clients carry that switch rather than assuming either way.
-- ============================================================================

alter table public.clients
  add column if not exists budget_visible boolean not null default false;

create table if not exists public.budget_items (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  category   text not null default '',
  label      text not null,
  estimate   numeric(12,2) not null default 0 check (estimate >= 0),
  agreed     numeric(12,2) check (agreed is null or agreed >= 0),
  vendor     text not null default '',
  notes      text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists budget_items_client_idx on public.budget_items(client_id);

create table if not exists public.payments (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  title      text not null,
  amount     numeric(12,2) not null check (amount > 0),
  due_on     date,
  paid       boolean not null default false,
  paid_on    date,
  note       text not null default '',
  created_at timestamptz not null default now(),
  -- a payment marked paid must say when, and one that is not must not
  constraint payments_paid_date check ((paid and paid_on is not null) or (not paid and paid_on is null))
);
create index if not exists payments_client_idx on public.payments(client_id, paid, due_on);

alter table public.budget_items enable row level security;
alter table public.payments     enable row level security;

-- ── budget: the producer writes; the couple reads only once let in ──────────
drop policy if exists budget_read on public.budget_items;
create policy budget_read on public.budget_items for select
  using (
    public.owns_producer(public.producer_of_client(client_id))
    or public.is_super_admin()
    or (
      public.can_read_client(client_id)
      and exists (select 1 from public.clients c where c.id = client_id and c.budget_visible)
    )
  );

drop policy if exists budget_write on public.budget_items;
create policy budget_write on public.budget_items for all
  using (public.owns_producer(public.producer_of_client(client_id)) or public.is_super_admin())
  with check (public.owns_producer(public.producer_of_client(client_id)) or public.is_super_admin());

-- ── payments: both sides read, only the producer writes ─────────────────────
drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select
  using (public.can_read_client(client_id));

drop policy if exists payments_write on public.payments;
create policy payments_write on public.payments for all
  using (public.owns_producer(public.producer_of_client(client_id)) or public.is_super_admin())
  with check (public.owns_producer(public.producer_of_client(client_id)) or public.is_super_admin());

-- ── keep paid and paid_on honest without making the caller remember ─────────
create or replace function public.stamp_payment_date() returns trigger
language plpgsql as $$
begin
  if new.paid and new.paid_on is null then
    new.paid_on := current_date;
  elsif not new.paid then
    new.paid_on := null;
  end if;
  return new;
end $$;
drop trigger if exists payments_stamp_date on public.payments;
create trigger payments_stamp_date before insert or update on public.payments
  for each row execute function public.stamp_payment_date();
