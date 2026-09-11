-- ============================================================================
--  0085 — a quote is compared, and one is chosen into the budget
-- ============================================================================
--  Round four of the planning brief. The halls have had a comparison since
--  0058: four quotes side by side, one number each, and choosing one writes
--  the budget line everything else is planned around. Every other supplier
--  had nothing. A couple with three photographers' quotes in a WhatsApp
--  thread compared them there, and the budget found out in March.
--
--  So a quote lives on the supplier row. Amount, hours, what the scope is,
--  what is included, what costs extra, and the payment terms — the six
--  things a producer reads off a quote before saying anything — each of them
--  nullable or empty, because an unknown is a real state and a zero is a
--  lie. Nothing here is computed from anything: a quote is what the supplier
--  said, written down.
--
--  Choosing one is the part that has to be done in one place. It marks the
--  chosen quote and unmarks the rest of its category, takes the previously
--  chosen supplier's estimate line out of the budget, and writes this one's
--  in, or updates it if it is already there. Done as three statements from
--  the browser it would be three statements with two gaps between them, and
--  the gaps are where a budget ends up with two photographers on it.
--
--  Two rules the function keeps that the brief asks for by name.
--
--  Choosing is not booking. It changes no status, signs no contract and
--  records no payment. What it writes is an estimate — the `estimate`
--  column — and never `agreed`, which is the column for a commitment. The
--  tracker already reads the two apart.
--
--  Choosing twice is choosing once. A line is keyed by the supplier it is
--  for, so pressing the button again, or choosing A, then B, then A, leaves
--  exactly one line for exactly one supplier in that category. And a line
--  that has an agreed figure on it — money somebody committed — is never
--  deleted by this, whatever else is chosen: a commitment is not undone by
--  a comparison.
--
--  Nothing here touches a row: the columns are added empty, and the function
--  writes only when it is called.
-- ============================================================================

alter table public.event_vendors
  add column if not exists quote_amount   numeric(12,2),
  add column if not exists quote_hours    numeric(5,1),
  add column if not exists quote_scope    text not null default '',
  add column if not exists quote_includes text not null default '',
  add column if not exists quote_extras   text not null default '',
  add column if not exists quote_terms    text not null default '',
  add column if not exists chosen         boolean not null default false;

do $$ begin
  alter table public.event_vendors add constraint event_vendors_quote_nonneg
    check (quote_amount is null or quote_amount >= 0);
  alter table public.event_vendors add constraint event_vendors_quote_hours_sane
    check (quote_hours is null or (quote_hours > 0 and quote_hours <= 72));
  alter table public.event_vendors add constraint event_vendors_quote_text_len
    check (char_length(quote_scope) <= 300 and char_length(quote_includes) <= 600
       and char_length(quote_extras) <= 600 and char_length(quote_terms) <= 600);
exception when duplicate_object then null; end $$;

comment on column public.event_vendors.quote_amount is
  'What the supplier quoted, in shekels, VAT included, as they said it. Null '
  'until a quote is written down; never computed.';
comment on column public.event_vendors.chosen is
  'The one quote in its category the couple and producer are planning '
  'around. Not a booking: status says whether they are booked, this says '
  'whose figure is in the budget as the estimate.';

/* One chosen per category per event, kept by the database rather than by
   the function alone, so a direct write cannot leave two. */
create unique index if not exists event_vendors_one_chosen_per_category
  on public.event_vendors (client_id, category) where chosen;


-- ── the choice, in one place ────────────────────────────────────────────────
create or replace function public.choose_vendor_quote(p_vendor uuid, p_category_label text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v        public.event_vendors%rowtype;
  replaced text[] := '{}';
  sib      record;
  line_id  uuid;
begin
  select * into v from public.event_vendors where id = p_vendor;
  if not found then
    raise exception 'no such supplier';
  end if;
  if not public.can_read_client(v.client_id) then
    raise exception 'אין הרשאה' using errcode = 'insufficient_privilege';
  end if;
  if v.quote_amount is null then
    raise exception 'no quote to choose' using errcode = 'check_violation';
  end if;

  /* The others in this category: unmarked, and their estimate-only lines
     taken out of the budget. A line carrying an agreed figure stays: that
     is a commitment somebody made, and a comparison does not undo it. */
  for sib in
    select ev.id, ev.name from public.event_vendors ev
     where ev.client_id = v.client_id and ev.category = v.category
       and ev.id <> v.id and ev.chosen
  loop
    delete from public.budget_items b
     where b.client_id = v.client_id and b.event_vendor_id = sib.id and b.agreed is null;
    if found then replaced := array_append(replaced, sib.name); end if;
  end loop;

  update public.event_vendors set chosen = false
   where client_id = v.client_id and category = v.category and id <> v.id and chosen;
  update public.event_vendors set chosen = true where id = v.id;

  /* This supplier's line: updated if it exists, written if it does not.
     `agreed` is left exactly as it was either way. */
  select b.id into line_id from public.budget_items b
   where b.client_id = v.client_id and b.event_vendor_id = v.id
   order by b.created_at limit 1;

  if line_id is not null then
    update public.budget_items
       set estimate = v.quote_amount, label = v.name, vendor = v.name,
           category = coalesce(nullif(btrim(p_category_label), ''), category)
     where id = line_id;
  else
    insert into public.budget_items (client_id, category, label, estimate, vendor, event_vendor_id, notes)
    values (v.client_id, coalesce(nullif(btrim(p_category_label), ''), v.category), v.name,
            v.quote_amount, v.name, v.id, 'נבחר מתוך השוואת הצעות המחיר.')
    returning id into line_id;
  end if;

  return jsonb_build_object('replaced', to_jsonb(replaced), 'line', line_id, 'estimate', v.quote_amount);
end $$;

comment on function public.choose_vendor_quote(uuid, text) is
  'Marks one supplier''s quote as the one the budget is planned around, '
  'unmarks the rest of its category, and writes its amount into the budget '
  'as an estimate: one line per supplier, never twice, never touching an '
  'agreed figure. Not a booking.';

revoke all on function public.choose_vendor_quote(uuid, text) from public, anon;
grant execute on function public.choose_vendor_quote(uuid, text) to authenticated;
