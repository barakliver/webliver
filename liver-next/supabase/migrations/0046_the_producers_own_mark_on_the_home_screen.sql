-- ============================================================================
--  0046 — the producer's own mark on the home screen
-- ============================================================================
--  The installed app carried the producer's name and the platform's icon. A
--  home screen is the one place a brand is looked at forty times a day, and an
--  icon that belongs to somebody else's business undoes every other line of
--  the white label.
--
--  Three pictures, one bucket. The logo (already a column, never uploadable
--  from the branding screen until now), the app icon the phone shows, and a
--  cover the front door and the share card can carry. Public for read, since
--  every one of them is drawn on a page a stranger may open; writable by the
--  producer who owns the folder and nobody else.
-- ============================================================================

alter table public.producers add column if not exists icon_url  text;
alter table public.producers add column if not exists cover_url text;

comment on column public.producers.icon_url is
  'The square icon an installed app shows. A public URL in the brand bucket.';
comment on column public.producers.cover_url is
  'A wide photograph for the front door and the share card. Public URL.';


-- ── the bucket ──────────────────────────────────────────────────────────────
--  Laid out as <producer_id>/<file>, the same shape as avatars: the folder is
--  the owner. storage_owner_id() reads the first segment as a uuid and answers
--  null for anything else, and owns_producer(null) is false, so a file dropped
--  at the root of the bucket belongs to nobody and cannot be written.
insert into storage.buckets (id, name, public)
values ('brand', 'brand', true)
on conflict (id) do update set public = true;

drop policy if exists brand_objects_read on storage.objects;
create policy brand_objects_read on storage.objects for select
  using (bucket_id = 'brand');

drop policy if exists brand_objects_write on storage.objects;
create policy brand_objects_write on storage.objects for insert
  with check (bucket_id = 'brand' and public.owns_producer(public.storage_owner_id(name)));

drop policy if exists brand_objects_update on storage.objects;
create policy brand_objects_update on storage.objects for update
  using (bucket_id = 'brand' and public.owns_producer(public.storage_owner_id(name)));

drop policy if exists brand_objects_delete on storage.objects;
create policy brand_objects_delete on storage.objects for delete
  using (bucket_id = 'brand' and public.owns_producer(public.storage_owner_id(name)));


-- ── the two lookups learn the two new pictures ──────────────────────────────
--  A function's return shape cannot be changed in place, so both are dropped
--  and written again with the same body plus two columns. Everything that
--  called them reads by name, so the extra columns cost nobody anything.
drop function if exists public.producer_by_host(text);
create or replace function public.producer_by_host(p_host text)
returns table (
  brand text, tagline text, accent text, logo_url text, whatsapp text, booking_url text,
  icon_url text, cover_url text
)
language sql stable security definer set search_path = public as $$
  select
    coalesce(nullif(pr.brand_name, ''), nullif(pr.contact_name, ''), ''),
    pr.tagline,
    pr.accent,
    pr.logo_url,
    pr.whatsapp,
    pr.booking_url,
    pr.icon_url,
    pr.cover_url
  from public.producers pr
  where pr.status = 'approved'
    and (
      pr.domain = lower(btrim(p_host))
      or pr.slug = split_part(lower(btrim(p_host)), '.', 1)
    )
  order by (pr.domain = lower(btrim(p_host))) desc
  limit 1
$$;

revoke all on function public.producer_by_host(text) from public;
grant execute on function public.producer_by_host(text) to anon, authenticated, service_role;

drop function if exists public.my_workspace_brand();
create or replace function public.my_workspace_brand()
returns table (
  brand text, tagline text, accent text, logo_url text, whatsapp text, booking_url text,
  icon_url text, cover_url text
)
language sql stable security definer set search_path = public as $$
  select
    coalesce(nullif(pr.brand_name, ''), nullif(pr.contact_name, ''), ''),
    pr.tagline,
    pr.accent,
    pr.logo_url,
    pr.whatsapp,
    pr.booking_url,
    pr.icon_url,
    pr.cover_url
  from public.clients c
  join public.producers pr on pr.id = c.producer_id
  where public.can_read_client(c.id)
    and c.archived_at is null
  order by c.event_date asc nulls last
  limit 1
$$;

revoke all on function public.my_workspace_brand() from public;
grant execute on function public.my_workspace_brand() to authenticated;
