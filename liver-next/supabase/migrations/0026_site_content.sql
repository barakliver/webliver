-- ============================================================================
--  0026 — changing the words on the site without a deploy
-- ============================================================================
--  Every line of public copy lives in one file, which was the right call: it
--  gets reviewed in one place and it ships with the code that renders it. What
--  it does not do is let the person whose business it describes change a
--  sentence on a Tuesday.
--
--  So this is an override layer, not a replacement. The shipped copy stays the
--  default and stays in the repository; a row here says "this one line reads
--  differently now". Three things follow from that shape, and all three are the
--  reason for it:
--
--  A missing row is not a missing sentence. An empty table renders exactly the
--  site that ships today.
--
--  A database that is unreachable is not a blank homepage. The defaults are
--  compiled in, so the worst case is a visitor reading last month's wording.
--
--  An edit is reversible by deleting a row, which means "put it back the way it
--  was" is a button rather than a support conversation.
--
--  Anonymous may read it, because the public site is anonymous and this is the
--  public site's text. Only the producer it belongs to may write it.
-- ============================================================================

create table if not exists public.site_content (
  producer_id uuid not null references public.producers(id) on delete cascade,
  /* A dotted path into the copy object: 'hero.headline', 'about.body'. The app
     decides which paths are editable and refuses the rest, because a free-form
     key would let a typo write a line nothing ever reads and look like it
     worked. */
  key         text not null,
  value       text not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) on delete set null,
  primary key (producer_id, key),
  constraint site_content_key_shape check (key ~ '^[a-z][a-zA-Z0-9_]*(\.[a-z][a-zA-Z0-9_]*)*$'),
  constraint site_content_not_huge check (length(value) <= 4000)
);

comment on table public.site_content is
  'Overrides for the marketing copy. The shipped text in content/site.ts is the '
  'default and the fallback; a row here changes one line of it.';

create index if not exists site_content_producer_idx on public.site_content (producer_id);

alter table public.site_content enable row level security;

/* The public site reads this while signed out, so anon may select. There is
   nothing private here: every value is a sentence intended to be read by
   strangers on a marketing page. */
drop policy if exists site_content_read on public.site_content;
create policy site_content_read on public.site_content for select using (true);

drop policy if exists site_content_write on public.site_content;
create policy site_content_write on public.site_content for all
  using      (public.owns_producer(producer_id) or public.is_super_admin())
  with check (public.owns_producer(producer_id) or public.is_super_admin());

grant select on public.site_content to anon, authenticated, service_role;
grant insert, update, delete on public.site_content to authenticated, service_role;

/* Who changed a sentence and when, filled in by the database so it cannot be
   left out by a caller. */
create or replace function public.stamp_site_content() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists site_content_stamp on public.site_content;
create trigger site_content_stamp before insert or update on public.site_content
  for each row execute function public.stamp_site_content();


-- ── writing one line ────────────────────────────────────────────────────────
--  An upsert rather than an insert, because editing the same sentence twice is
--  the normal case and the second edit is not a conflict. An empty value
--  deletes the row rather than storing a blank: "put it back the way it was"
--  and "make this line empty" are different intentions, and only one of them is
--  ever meant here.
create or replace function public.set_site_content(p_key text, p_value text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_producer uuid;
begin
  select pr.id into v_producer
    from public.producers pr
   where pr.owner_id = auth.uid() and pr.status = 'approved'
   order by pr.created_at
   limit 1;

  if v_producer is null then
    raise exception 'אין הרשאה' using errcode = 'insufficient_privilege';
  end if;

  if btrim(coalesce(p_value, '')) = '' then
    delete from public.site_content where producer_id = v_producer and key = p_key;
    return;
  end if;

  insert into public.site_content (producer_id, key, value)
  values (v_producer, p_key, left(p_value, 4000))
  on conflict (producer_id, key) do update set value = excluded.value;
end $$;

revoke all on function public.set_site_content(text, text) from public;
grant execute on function public.set_site_content(text, text) to authenticated, service_role;


-- ── the public site has to be able to ask whose copy this is ────────────────
--  public_site_producer() has been callable by anonymous since 0009 only
--  because nothing ever revoked the default. Stating it means the day somebody
--  tightens function privileges across the schema, the marketing page does not
--  quietly fall back to the shipped wording with no error anywhere.
grant execute on function public.public_site_producer() to anon, authenticated, service_role;
