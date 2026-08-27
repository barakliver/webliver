-- ============================================================================
--  0040 — a shop, and a till that adds up on this side of the wire
-- ============================================================================
--  `orders` has been in the schema since 0001 and has never had a row in it,
--  because there was nothing to order: no catalogue, no storefront, and no way
--  for a visitor to place one. This is the other three quarters of it.
--
--  Two things decide the shape.
--
--  The first is that a producer sells two different things out of the same
--  page. A product is a thing (a bar package, a set of lanterns, a printed
--  seating chart). A service is time (an extra hour of the band, a rehearsal
--  visit, a second photographer). They differ in the sentence under the price
--  and in nothing else, so they are one table with a kind rather than two
--  tables that drift apart.
--
--  The second is that the price the buyer sees is a *claim*, and the total is
--  computed here from the catalogue rather than accepted from the browser.
--  Every storefront that has ever trusted a posted price has eventually sold
--  something for a shekel. place_order() reads the products itself, sums them
--  itself, and ignores whatever arrived alongside them.
-- ============================================================================

alter type notice_kind add value if not exists 'order';


-- ── the catalogue ───────────────────────────────────────────────────────────
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  producer_id uuid not null references public.producers(id) on delete cascade,
  name        text not null,
  blurb       text not null default '',
  body        text not null default '',
  price       numeric(12,2) not null default 0,
  /* What the price buys. Only the sentence under it differs, which is why this
     is a column and not a second table. */
  kind        text not null default 'product',
  image_path  text not null default '',
  active      boolean not null default true,
  /* Where it sits on the page. The producer drags the rows into the order they
     want customers to read them in, and reorder_products() writes the result
     in one statement so a half-applied drag cannot exist. */
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  constraint products_name_len  check (char_length(btrim(name)) between 1 and 160),
  constraint products_blurb_len check (char_length(blurb) <= 300),
  constraint products_body_len  check (char_length(body) <= 6000),
  constraint products_kind      check (kind in ('product','service')),
  constraint products_price     check (price >= 0 and price <= 1000000)
);
create index if not exists products_producer_idx
  on public.products (producer_id, sort_order, created_at);

alter table public.products enable row level security;

/* A visitor reads the shop while signed out, so anon may select — but only
   what is actually for sale. A draft the producer has switched off is not a
   private secret, and it is also not something a stranger should be able to
   list, price and order. The producer sees their own either way. */
drop policy if exists products_read on public.products;
create policy products_read on public.products for select
  using (active or public.owns_producer(producer_id));

drop policy if exists products_write on public.products;
create policy products_write on public.products for all
  using      (public.owns_producer(producer_id) and public.is_approved_producer())
  with check (public.owns_producer(producer_id) and public.is_approved_producer());

grant select on public.products to anon, authenticated, service_role;
grant insert, update, delete on public.products to authenticated, service_role;


-- ── the pictures ────────────────────────────────────────────────────────────
--  Public, unlike every other bucket here, and deliberately: this is a photo
--  of something for sale on a page anybody may read. A signed link would
--  expire in the middle of somebody browsing, and there is nothing to protect.
--  Writing is still the producer's own folder only.
insert into storage.buckets (id, name, public)
values ('store', 'store', true)
on conflict (id) do update set public = true;

/* The first path segment is the producer, which is the same shape the other
   buckets use — but producer_id rather than client_id, so it gets its own
   reader rather than borrowing storage_client_id() and asking the wrong
   question of the answer. */
create or replace function public.storage_producer_id(object_name text) returns uuid
language plpgsql immutable as $$
declare seg text;
begin
  seg := split_part(object_name, '/', 1);
  if seg !~ '^[0-9a-fA-F-]{36}$' then return null; end if;
  return seg::uuid;
exception when others then
  return null;
end $$;

drop policy if exists store_objects_read on storage.objects;
create policy store_objects_read on storage.objects for select
  using (bucket_id = 'store');

drop policy if exists store_objects_write on storage.objects;
create policy store_objects_write on storage.objects for insert
  with check (bucket_id = 'store' and public.owns_producer(public.storage_producer_id(name)));

drop policy if exists store_objects_update on storage.objects;
create policy store_objects_update on storage.objects for update
  using (bucket_id = 'store' and public.owns_producer(public.storage_producer_id(name)));

drop policy if exists store_objects_delete on storage.objects;
create policy store_objects_delete on storage.objects for delete
  using (bucket_id = 'store' and public.owns_producer(public.storage_producer_id(name)));


-- ── dragging the rows into order ────────────────────────────────────────────
--  One statement, so a reorder either lands whole or does not land. A loop of
--  updates from the browser leaves the page in an order that exists nowhere
--  the moment one of them fails, and the row that moved is the one that looks
--  right while the four around it are wrong.
create or replace function public.reorder_products(p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_ids is null or array_length(p_ids, 1) is null then return; end if;

  update public.products p
     set sort_order = x.pos
    from unnest(p_ids) with ordinality as x(id, pos)
   where p.id = x.id
     and public.owns_producer(p.producer_id)
     and public.is_approved_producer();
end $$;

revoke all on function public.reorder_products(uuid[]) from public;
grant execute on function public.reorder_products(uuid[]) to authenticated, service_role;


-- ── the order itself ────────────────────────────────────────────────────────
alter table public.orders add column if not exists note       text not null default '';
alter table public.orders add column if not exists updated_at timestamptz not null default now();

create or replace function public.stamp_order() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists orders_stamp on public.orders;
create trigger orders_stamp before update on public.orders
  for each row execute function public.stamp_order();

/* A number a person can read out on the phone. The date is the useful half —
   "the one from Tuesday" is how anybody actually refers to an order — and four
   random characters are enough to separate two on the same day without turning
   it into a serial number that leaks how many have been sold. */
create or replace function public.next_order_number() returns text
language sql volatile set search_path = public, extensions as $$
  select 'LP-' || to_char(now() at time zone 'Asia/Jerusalem', 'YYMMDD')
      || '-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 4))
$$;


/**
 *  Placing one, from a page with nobody signed in.
 *
 *  The items arrive as [{"id": "<uuid>", "qty": 2}, …] and every price in the
 *  request is thrown away. What is stored is what the catalogue says right
 *  now, read here, under this function's own rights — which is the entire
 *  reason this is a function and not an insert policy.
 */
create or replace function public.place_order(
  p_producer uuid,
  p_items    jsonb,
  p_name     text,
  p_phone    text default '',
  p_email    text default '',
  p_note     text default ''
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_name   text := btrim(coalesce(p_name, ''));
  v_phone  text := btrim(coalesce(p_phone, ''));
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_lines  jsonb := '[]'::jsonb;
  v_total  numeric(12,2) := 0;
  v_number text;
  v_owner  uuid;
  r        record;
begin
  if length(v_name) < 2 then
    raise exception 'שם מלא חסר' using errcode = 'check_violation';
  end if;
  if v_phone = '' and v_email = '' then
    raise exception 'צריך טלפון או אימייל' using errcode = 'check_violation';
  end if;
  if v_email <> '' and v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'אימייל לא תקין' using errcode = 'check_violation';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'הסל ריק' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(p_items) > 30 then
    raise exception 'יותר מדי פריטים בהזמנה' using errcode = 'check_violation';
  end if;

  if not exists (select 1 from public.producers where id = p_producer and status = 'approved') then
    raise exception 'החנות הזאת לא פעילה' using errcode = 'check_violation';
  end if;

  /* Joined against the catalogue rather than looked up per line, so a product
     that is not this producer's, or is switched off, simply is not in the
     result — and an order made entirely of those comes out empty and is
     refused below rather than saved as a zero. */
  for r in
    select p.id, p.name, p.kind, p.price,
           least(greatest(coalesce((i->>'qty')::int, 1), 1), 99) as qty
      from jsonb_array_elements(p_items) as i
      join public.products p
        on p.id = (i->>'id')::uuid
       and p.producer_id = p_producer
       and p.active
  loop
    v_total := v_total + (r.price * r.qty);
    v_lines := v_lines || jsonb_build_object(
      'id', r.id, 'name', r.name, 'kind', r.kind,
      'price', r.price, 'qty', r.qty, 'line', r.price * r.qty
    );
  end loop;

  if jsonb_array_length(v_lines) = 0 then
    raise exception 'הפריטים בסל כבר לא זמינים' using errcode = 'check_violation';
  end if;

  v_number := public.next_order_number();

  insert into public.orders
    (producer_id, number, buyer_name, buyer_email, buyer_phone, items, total, status, note)
  values
    (p_producer, v_number, left(v_name, 120), left(v_email, 160), left(v_phone, 40),
     v_lines, v_total, 'pending', left(coalesce(p_note, ''), 2000));

  select owner_id into v_owner from public.producers where id = p_producer;
  if v_owner is not null then
    perform public.notify(v_owner, 'order', 'הזמנה חדשה',
                          v_name || ' · ' || v_number, '/app/store');
  end if;

  return v_number;
end $$;

revoke all on function public.place_order(uuid, jsonb, text, text, text, text) from public;
grant execute on function public.place_order(uuid, jsonb, text, text, text, text)
  to anon, authenticated, service_role;


-- ── live, like everything else ──────────────────────────────────────────────
alter table public.products replica identity full;
alter table public.orders   replica identity full;
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'products'
  ) then
    alter publication supabase_realtime add table public.products;
  end if;
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
