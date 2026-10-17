-- 0104  A budget you can type into.
--
--  The budget was a list of rows that each opened onto a form, and a form
--  per row is four presses to change one number. What a couple and a
--  producer both reach for is a spreadsheet: press a cell, type, Enter,
--  and the totals move. This migration gives `budget_items` what a
--  spreadsheet row needs and the old rows never had: a state, a quote
--  beside the plan and the agreed price, whether the price is before or
--  after VAT, a per-plate switch, an order, and a source saying where the
--  line came from. Nothing is renamed and nothing is dropped - `estimate`
--  is the planned figure and stays `estimate`, because fifteen weddings'
--  rows carry it and a column rename is a data migration in disguise.
--
--  Two tables beside it. `budget_payments` is money paid to a supplier
--  against one line, and it is a table of its own rather than more columns
--  on `payments` because `payments` is the couple's schedule to the
--  producer, and `ledgerOf` counts it as income: a supplier's deposit
--  written there would read as money arriving. `budget_item_private` holds
--  the producer's own note on a line, in a table the couple has no policy
--  on, for the reason the crew functions give - a policy grants rows and
--  rows carry columns, so a private column on a shared row is not private.
--
--  The backfill runs once, inside the branch that adds the column. sync.sql
--  replays this file on every deploy, and an unguarded `update ... where
--  agreed is not null` would set a line back to booked every five minutes
--  after somebody deliberately moved it off.

-- ── the line ──────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'budget_items' and column_name = 'status'
  ) then
    alter table public.budget_items add column status text not null default 'idea';
    /* A row with a price agreed is a booking; everything else is still an
       idea. Quoted and paid cannot be told from the old columns, so they
       are not guessed. */
    update public.budget_items set status = 'booked' where agreed is not null;
  end if;
end $$;

alter table public.budget_items
  add column if not exists quoted               numeric(12,2) check (quoted is null or quoted >= 0),
  add column if not exists includes_vat         boolean not null default true,
  add column if not exists vat_rate             numeric(4,3) not null default 0.18,
  add column if not exists per_guest            boolean not null default false,
  add column if not exists guest_count_override int check (guest_count_override is null or guest_count_override >= 0),
  add column if not exists paid_by              text not null default 'couple',
  add column if not exists due_date             date,
  add column if not exists visible_to_couple    boolean not null default true,
  add column if not exists sort_order           int not null default 0,
  add column if not exists source               text not null default 'manual',
  add column if not exists updated_at           timestamptz not null default now();

/* `not valid`, because the table has rows and a constraint that one old row
   refuses fails every deploy forever. The values are the five the screen
   draws. */
alter table public.budget_items drop constraint if exists budget_items_status_chk;
alter table public.budget_items add constraint budget_items_status_chk
  check (status in ('idea', 'quoted', 'booked', 'paid', 'cancelled')) not valid;
alter table public.budget_items drop constraint if exists budget_items_paid_by_chk;
alter table public.budget_items add constraint budget_items_paid_by_chk
  check (paid_by in ('couple', 'parents_a', 'parents_b', 'split')) not valid;
alter table public.budget_items drop constraint if exists budget_items_source_len;
alter table public.budget_items add constraint budget_items_source_len
  check (char_length(source) <= 80) not valid;

create index if not exists budget_items_order_idx
  on public.budget_items (client_id, category, sort_order, created_at);

drop trigger if exists budget_items_touch on public.budget_items;
create trigger budget_items_touch before update on public.budget_items
  for each row execute function public.touch_updated_at();

-- ── who sees which line ───────────────────────────────────────────────────
-- The couple's branch gains one condition: a line the producer has turned
-- off is not theirs to read. The producer's branch is unchanged.
drop policy if exists budget_read on public.budget_items;
create policy budget_read on public.budget_items for select
  using (
    public.owns_producer(public.producer_of_client(client_id))
    or public.is_super_admin()
    or (
      public.can_read_client(client_id)
      and visible_to_couple
      and exists (select 1 from public.clients c where c.id = client_id and c.budget_visible)
    )
  );

/* The couple may correct their own lines - the hall's quote arrives on
   their phone, not the producer's - but never the two figures the producer
   locks: the plan once approved, and the agreed price once booked. Those
   are refused in the action; here the row is theirs to write when the
   budget is open to them at all. */
drop policy if exists budget_couple_write on public.budget_items;
create policy budget_couple_write on public.budget_items for update
  using (
    public.can_read_client(client_id)
    and visible_to_couple
    and exists (select 1 from public.clients c where c.id = client_id and c.budget_visible)
  )
  with check (
    public.can_read_client(client_id)
    and visible_to_couple
    and exists (select 1 from public.clients c where c.id = client_id and c.budget_visible)
  );
drop policy if exists budget_couple_insert on public.budget_items;
create policy budget_couple_insert on public.budget_items for insert
  with check (
    public.can_read_client(client_id)
    and exists (select 1 from public.clients c where c.id = client_id and c.budget_visible)
  );

-- ── the producer's own note on a line ─────────────────────────────────────
create table if not exists public.budget_item_private (
  item_id        uuid primary key references public.budget_items(id) on delete cascade,
  internal_notes text not null default '',
  updated_at     timestamptz not null default now(),
  constraint budget_item_private_len check (char_length(internal_notes) <= 4000)
);
alter table public.budget_item_private enable row level security;
drop policy if exists budget_item_private_producer on public.budget_item_private;
create policy budget_item_private_producer on public.budget_item_private for all
  using (
    public.is_super_admin() or exists (
      select 1 from public.budget_items b
      where b.id = item_id and public.owns_producer(public.producer_of_client(b.client_id))
    )
  )
  with check (
    public.is_super_admin() or exists (
      select 1 from public.budget_items b
      where b.id = item_id and public.owns_producer(public.producer_of_client(b.client_id))
    )
  );
drop trigger if exists budget_item_private_touch on public.budget_item_private;
create trigger budget_item_private_touch before update on public.budget_item_private
  for each row execute function public.touch_updated_at();

-- ── money paid against a line ─────────────────────────────────────────────
create table if not exists public.budget_payments (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.budget_items(id) on delete cascade,
  client_id    uuid not null references public.clients(id) on delete cascade,
  amount       numeric(12,2) not null check (amount > 0),
  /* Null is planned and not yet paid. */
  paid_at      date,
  due_at       date,
  method       text not null default '',
  paid_by      text not null default '',
  reference    text not null default '',
  receipt_path text,
  notes        text not null default '',
  created_at   timestamptz not null default now(),
  constraint budget_payments_len check (
    char_length(method) <= 20 and char_length(paid_by) <= 20
    and char_length(reference) <= 80 and char_length(notes) <= 2000
  )
);
create index if not exists budget_payments_item_idx on public.budget_payments (item_id, due_at);
create index if not exists budget_payments_client_idx on public.budget_payments (client_id, paid_at, due_at);

alter table public.budget_payments enable row level security;
/* Read follows the line: whoever may read the line may read what was paid
   against it, which is how the couple's branch inherits `visible_to_couple`
   and `budget_visible` without restating them. */
drop policy if exists budget_payments_read on public.budget_payments;
create policy budget_payments_read on public.budget_payments for select
  using (exists (select 1 from public.budget_items b where b.id = item_id));
drop policy if exists budget_payments_write on public.budget_payments;
create policy budget_payments_write on public.budget_payments for all
  using (public.owns_producer(public.producer_of_client(client_id)) or public.is_super_admin())
  with check (public.owns_producer(public.producer_of_client(client_id)) or public.is_super_admin());
/* The couple records their own payments too - they are the ones who paid
   the photographer's deposit - but may not touch a row once it is marked
   paid, so a settled payment is corrected by the producer alone. */
drop policy if exists budget_payments_couple_insert on public.budget_payments;
create policy budget_payments_couple_insert on public.budget_payments for insert
  with check (
    public.can_read_client(client_id)
    and exists (select 1 from public.budget_items b where b.id = item_id and b.visible_to_couple)
    and exists (select 1 from public.clients c where c.id = client_id and c.budget_visible)
  );
drop policy if exists budget_payments_couple_update on public.budget_payments;
create policy budget_payments_couple_update on public.budget_payments for update
  using (
    paid_at is null and public.can_read_client(client_id)
    and exists (select 1 from public.budget_items b where b.id = item_id and b.visible_to_couple)
    and exists (select 1 from public.clients c where c.id = client_id and c.budget_visible)
  )
  with check (
    public.can_read_client(client_id)
    and exists (select 1 from public.budget_items b where b.id = item_id and b.visible_to_couple)
    and exists (select 1 from public.clients c where c.id = client_id and c.budget_visible)
  );

-- ── the approved baseline ─────────────────────────────────────────────────
-- Variance is measured against something, and until the couple says "this
-- is the plan" there is nothing to measure against. The producer asks, the
-- couple approves, the plan locks and a snapshot is kept so the number
-- they agreed to survives every edit after it.
alter table public.clients
  add column if not exists budget_approval_asked_at timestamptz,
  add column if not exists budget_approved_at       timestamptz;

create table if not exists public.budget_snapshots (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  total_planned numeric(12,2) not null default 0,
  total_agreed  numeric(12,2) not null default 0,
  total_paid    numeric(12,2) not null default 0,
  /* approved / daily / manual */
  reason        text not null default 'manual',
  taken_at      timestamptz not null default now(),
  constraint budget_snapshots_reason_len check (char_length(reason) <= 20)
);
create index if not exists budget_snapshots_client_idx on public.budget_snapshots (client_id, taken_at desc);
alter table public.budget_snapshots enable row level security;
drop policy if exists budget_snapshots_read on public.budget_snapshots;
create policy budget_snapshots_read on public.budget_snapshots for select
  using (public.can_read_client(client_id));
drop policy if exists budget_snapshots_write on public.budget_snapshots;
create policy budget_snapshots_write on public.budget_snapshots for insert
  with check (public.can_read_client(client_id));

comment on table public.budget_payments is
  'Money paid to a supplier against one budget line. Not the couple''s schedule to the producer, which is public.payments.';
comment on table public.budget_item_private is
  'The producer''s own note on a budget line, in a table the couple has no policy on.';
comment on table public.budget_snapshots is
  'The three totals on a day, kept when the couple approves the plan so variance has a baseline.';
