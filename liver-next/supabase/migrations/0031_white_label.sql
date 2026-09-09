-- ============================================================================
--  0031 — a producer's own identity, and the host that leads to it
-- ============================================================================
--  Three columns and one function.
--
--  `accent` is a key rather than a colour. The palette in this app was
--  measured rather than judged by eye, and two tones were darkened on the way
--  in because the measurement said so and both looked fine. A free hex field
--  would hand a producer the ability to make their own couples' text
--  unreadable, and neither of them would find out by looking at it. So the
--  choice is a shortlist, every entry of which is checked by a script that
--  refuses to pass a preset that fails.
--
--  `slug` and `domain` are how a request finds a tenant. Nothing here connects
--  a domain to anything: setting up DNS is a separate act, done deliberately,
--  and this only records what to do with a request once one arrives.
-- ============================================================================

alter table public.producers add column if not exists accent text not null default 'slate';
alter table public.producers add column if not exists slug   text;
alter table public.producers add column if not exists domain text;
alter table public.producers add column if not exists tagline text not null default '';

comment on column public.producers.accent is
  'Key into the shortlist in src/content/brand.ts, never a hex value. An '
  'unknown key falls back to the base palette rather than to nothing.';
comment on column public.producers.slug is
  'The subdomain this producer answers on. Lowercase letters, digits and '
  'hyphens; short enough to say out loud.';
comment on column public.producers.domain is
  'A custom domain this producer has pointed here. Recorded only — the DNS is '
  'a separate, deliberate act and this column does not perform it.';

/* Lowercased and trimmed on the way in, so a host lookup is a plain equality
   test rather than a function call the index cannot use. */
create or replace function public.normalize_producer_host() returns trigger
language plpgsql set search_path = public as $$
begin
  new.slug := nullif(lower(btrim(coalesce(new.slug, ''))), '');
  new.domain := nullif(lower(btrim(coalesce(new.domain, ''))), '');
  /* A pasted address rather than a hostname is the common mistake. Strip the
     parts a host does not have instead of refusing the row. */
  if new.domain is not null then
    new.domain := regexp_replace(new.domain, '^https?://', '');
    new.domain := regexp_replace(new.domain, '/.*$', '');
    new.domain := regexp_replace(new.domain, '^www\.', '');
  end if;
  return new;
end $$;

drop trigger if exists producers_normalize_host on public.producers;
create trigger producers_normalize_host before insert or update on public.producers
  for each row execute function public.normalize_producer_host();

do $$ begin
  alter table public.producers add constraint producers_slug_shape
    check (slug is null or slug ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$');
exception when duplicate_object then null; end $$;

create unique index if not exists producers_slug_key   on public.producers (slug)   where slug is not null;
create unique index if not exists producers_domain_key on public.producers (domain) where domain is not null;


-- ── resolving a request to a tenant ─────────────────────────────────────────
--  Called before anybody has signed in, so it is granted to anon, and it
--  therefore returns only what a visitor to that producer's public page is
--  meant to see: how they are called, how they look, and how to reach them.
--  No status, no counts, no address, no id of anything owned.
create or replace function public.producer_by_host(p_host text)
returns table (brand text, tagline text, accent text, logo_url text, whatsapp text, booking_url text)
language sql stable security definer set search_path = public as $$
  select
    coalesce(nullif(pr.brand_name, ''), nullif(pr.contact_name, ''), ''),
    pr.tagline,
    pr.accent,
    pr.logo_url,
    pr.whatsapp,
    pr.booking_url
  from public.producers pr
  where pr.status = 'approved'
    and (
      pr.domain = lower(btrim(p_host))
      or pr.slug = split_part(lower(btrim(p_host)), '.', 1)
    )
  /* An exact custom domain always beats a subdomain that happens to share a
     first label. Without the ordering the OR above could answer either way on
     two different days, which is the worst kind of routing bug. */
  order by (pr.domain = lower(btrim(p_host))) desc
  limit 1
$$;

revoke all on function public.producer_by_host(text) from public;
grant execute on function public.producer_by_host(text) to anon, authenticated, service_role;


-- ── the brand a couple sees ─────────────────────────────────────────────────
--  A couple cannot read the producers table, and should not be able to: it
--  carries approval status and contact details for every producer on the
--  platform. But the couple must see whose business they are inside, or the
--  workspace is white-labelled to nobody.
--
--  So the same narrow shape as producer_by_host, reached from the other
--  direction: the producer running an event this caller is actually on.
create or replace function public.my_workspace_brand()
returns table (brand text, tagline text, accent text, logo_url text, whatsapp text, booking_url text)
language sql stable security definer set search_path = public as $$
  select
    coalesce(nullif(pr.brand_name, ''), nullif(pr.contact_name, ''), ''),
    pr.tagline,
    pr.accent,
    pr.logo_url,
    pr.whatsapp,
    pr.booking_url
  from public.clients c
  join public.producers pr on pr.id = c.producer_id
  where public.can_read_client(c.id)
    and c.archived_at is null
  /* A couple is normally on exactly one workspace. When somebody is on two,
     the nearer event wins, which is the one they opened the app to look at. */
  order by c.event_date asc nulls last
  limit 1
$$;

revoke all on function public.my_workspace_brand() from public;
grant execute on function public.my_workspace_brand() to authenticated;
