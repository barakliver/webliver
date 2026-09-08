-- ── The budget line agrees with the button that wrote it ────────────────────
--  0058 got the arithmetic of a hall right in two places and got the tax right
--  in one of them.
--
--  Halls in this market quote the plate either side of VAT, which is why the
--  row carries `is_vat_included`: the screen normalises every column onto one
--  basis so four quotes can be read against each other, and it opens on the
--  inclusive one, because that is what a couple pays. `choose_venue` did not
--  normalise anything. It multiplied `plate_price` by the head count exactly as
--  typed.
--
--  So a hall that quoted 300 a plate before tax showed 354 a plate on the card,
--  and the couple pressed a button under a total of 132,000 that wrote 114,200
--  into their budget. Eighteen per cent of the largest line of the evening,
--  missing from the one figure the rest of the wedding gets planned against,
--  with nothing on any screen that would ever have said so. The reverse is
--  worse in the other direction: read the comparison without tax, choose a hall
--  that quoted inclusive, and the budget baseline comes out high.
--
--  The budget is always what will actually be paid, so the total is computed on
--  the inclusive basis regardless of which way the screen is being read at the
--  moment, and the line says so in its own note. Only the plate is converted —
--  the bar, the sound, the ancillary fees and the service charge are quoted as
--  sums to pay, and giving them a basis would be inventing a number rather than
--  converting one. That is the same rule lib/venues.ts follows, and
--  check-schema now runs the two implementations against each other on the same
--  row rather than against a constant that happened to agree.
--
--  The intermediates are unconstrained `numeric` rather than numeric(14,2) so
--  the sum is rounded once at the end, where the column rounds it, instead of
--  at every step. The old declarations rounded the food before the service
--  charge was taken off it, which is a rounding the screen does not do.

create or replace function public.choose_venue(p_venue uuid, p_guests int)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v       public.venue_comparisons%rowtype;
  guests  int;
  plate   numeric;
  food    numeric;
  bar     numeric;
  service numeric;
  total   numeric;
begin
  select * into v from public.venue_comparisons where id = p_venue;
  if not found then
    raise exception 'no such venue';
  end if;

  /* The policy is the authority here too. A security definer function that
     forgets to ask is a function that lets anybody edit anybody's wedding. */
  if not public.can_read_client(v.client_id) then
    raise exception 'not yours';
  end if;

  guests := greatest(coalesce(nullif(p_guests, 0),
                              (select guest_estimate from public.clients where id = v.client_id),
                              0), 0);

  /* 0.18 is also `VAT` in lib/venues.ts. Two copies of a rate is one copy too
     many, but a database function cannot import a TypeScript constant, so the
     schema test proves they are the same number instead of hoping. */
  plate   := case when v.is_vat_included then v.plate_price else v.plate_price * 1.18 end;
  food    := plate * guests;
  bar     := case when v.bar_type = 'per_person' then v.bar_cost * guests else v.bar_cost end;
  service := v.service_flat + (food * v.service_percent / 100);
  total   := food + bar + v.sound_lighting_cost + v.ancillary_fees + service;

  update public.venue_comparisons set is_selected = false
   where client_id = v.client_id and is_selected;
  update public.venue_comparisons set is_selected = true where id = v.id;

  update public.clients
     set venue = v.venue_name,
         guest_estimate = case when guests > 0 then guests else guest_estimate end
   where id = v.client_id;

  /* The baseline, as one budget line rather than five. A couple reading their
     budget wants to see what the hall costs; the breakdown is on the screen
     they chose it from, and duplicating it here is two places to keep true. */
  delete from public.budget_items
   where client_id = v.client_id and category = 'אולם' and label = v.venue_name;

  insert into public.budget_items (client_id, category, label, estimate, agreed, vendor, notes)
  values (v.client_id, 'אולם', v.venue_name, total, total, v.venue_name,
          'נבחר מתוך השוואת האולמות. ' || guests || ' מוזמנים. המחיר כולל מע״מ.');
end $$;

comment on function public.choose_venue(uuid, int) is
  'Marks one hall as chosen and writes its total into the budget as the '
  'baseline, always on the VAT-inclusive basis because that is what gets '
  'paid. The total is computed here because a number the browser sends is a '
  'number a browser can choose, and this one is the financial floor of '
  'somebody''s wedding.';

revoke all on function public.choose_venue(uuid, int) from public;
grant execute on function public.choose_venue(uuid, int) to authenticated;
