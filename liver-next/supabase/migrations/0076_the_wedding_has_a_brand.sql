-- ============================================================================
--  0076 — the wedding has a brand
-- ============================================================================
--  The couple's inspiration board was a wall of photographs and nothing came
--  of it inside the platform: the palette, the type, the words and the
--  motifs were read off it by a designer, somewhere else, and the seven
--  printed pieces were made somewhere else again. This puts the reading on
--  the event.
--
--  One jsonb column on the event, null until somebody reads the board: five
--  colours with a role each, a font pairing from a fixed list, three words,
--  the motifs, a voice, which of the two options was picked for each piece,
--  and the few lines of text the pieces need (the story, how to get there,
--  the menu). The application validates the shape; the database only insists
--  it is an object.
--
--  Two functions. The couple may pick between the two options of a piece,
--  and the row policy on clients gives them no write, so the pick goes
--  through a definer function that checks the workspace and touches one key.
--  And the guests' page returns the brand with the rest of its public face,
--  so the site two hundred people open is in the wedding's own colours.
--
--  Nothing here touches a row. The column is added null and the two
--  functions are replaced.
-- ============================================================================

alter table public.clients
  add column if not exists brand jsonb;

do $$ begin
  alter table public.clients add constraint clients_brand_is_object
    check (brand is null or jsonb_typeof(brand) = 'object');
exception when duplicate_object then null; end $$;

comment on column public.clients.brand is
  'The wedding''s own brand: palette, font pair, words, motifs, voice, picks per piece, texts. Null until the board was read.';


-- ── the couple picks an option ───────────────────────────────────────────────
--  Both sides may pick. The check is the same one every read on the workspace
--  makes, so a couple can pick on their own wedding and nothing else, and
--  the write touches picks.<piece> and no other key.
create or replace function public.pick_brand_variant(p_client uuid, p_piece text, p_variant text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_read_client(p_client) then
    raise exception 'not your workspace' using errcode = '42501';
  end if;
  if p_variant not in ('safe', 'bold') then
    raise exception 'unknown option' using errcode = '22023';
  end if;
  if p_piece !~ '^[a-z]{3,12}$' then
    raise exception 'unknown piece' using errcode = '22023';
  end if;

  update public.clients
     set brand = jsonb_set(
           coalesce(brand, '{}'::jsonb) || jsonb_build_object('picks', coalesce(brand->'picks', '{}'::jsonb)),
           array['picks', p_piece],
           to_jsonb(p_variant),
           true)
   where id = p_client;
end $$;

revoke all on function public.pick_brand_variant(uuid, text, text) from public;
grant execute on function public.pick_brand_variant(uuid, text, text) to authenticated;


-- ── the guests' page, now in the brand ──────────────────────────────────────
--  The return type gains a column, and Postgres will not change a function's
--  return type in place, so the function is dropped and recreated (the same
--  way 0071 did for the calendar feed). The body is 0045's with one column.
drop function if exists public.guest_site(text);

create function public.guest_site(p_token text)
returns table (
  event_name text,
  event_date date,
  venue      text,
  note       text,
  producer   text,
  moments    jsonb,
  brand      jsonb
)
language sql stable security definer set search_path = public as $$
  select c.display_name,
         c.event_date,
         c.venue,
         c.guest_note,
         p.brand_name,
         coalesce((
           select jsonb_agg(jsonb_build_object('at', d.at_time, 'title', d.title) order by d.at_time)
             from public.day_schedule d
            where d.client_id = c.id
              and d.key_moment
         ), '[]'::jsonb),
         c.brand
    from public.clients c
    join public.producers p on p.id = c.producer_id
   where c.guest_token = p_token
     and c.guest_site_on
   limit 1
$$;

revoke all on function public.guest_site(text) from public;
grant execute on function public.guest_site(text) to anon, authenticated;
