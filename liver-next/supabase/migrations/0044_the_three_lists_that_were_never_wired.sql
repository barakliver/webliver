-- ============================================================================
--  0044 — the three lists that were never wired
-- ============================================================================
--  His music table, his equipment checklist and the personal details he keeps
--  about each couple were read out of his own documents and written into
--  `content/eventFile.ts` a while ago. They have sat there since, reaching no
--  screen and having nowhere to be stored. Third time this shape has turned up
--  in a week: the work was done and nothing could get to it.
--
--  Who fills each one in is what decides its policy, and the three differ:
--
--    the songs        the couple chooses them, the producer tells the DJ
--    the equipment    the producer's own logistics
--    the details      the couple writes them, the producer reads them
--
--  So they are three tables rather than one with a `kind`, because a single
--  table would need one policy for three different answers to "who may write
--  this", and that is exactly the sort of clever which ends with a couple
--  editing the generator.
-- ============================================================================


-- ── the seven moments that need a song ──────────────────────────────────────
--  One row per moment per event, and the moment is a string from the shipped
--  list rather than an enum: adding an eighth moment should be a line in a
--  content file, not a migration and a deploy.
create table if not exists public.event_music (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  moment     text not null,
  song       text not null default '',
  artist     text not null default '',
  note       text not null default '',
  updated_at timestamptz not null default now(),
  unique (client_id, moment),
  constraint music_moment_len check (char_length(btrim(moment)) between 1 and 120),
  constraint music_song_len   check (char_length(song) <= 200),
  constraint music_artist_len check (char_length(artist) <= 160),
  constraint music_note_len   check (char_length(note) <= 500)
);
create index if not exists event_music_client_idx on public.event_music (client_id);

alter table public.event_music enable row level security;

/* Both sides, both ways. The couple picks the songs and the producer is the
   one who has to hand the list to a DJ, and a screen where only one of them
   can type turns into a screen where the other one sends a WhatsApp instead. */
drop policy if exists event_music_all on public.event_music;
create policy event_music_all on public.event_music for all
  using      (public.can_read_client(client_id))
  with check (public.can_read_client(client_id));

grant all on public.event_music to authenticated, service_role;


-- ── the equipment ───────────────────────────────────────────────────────────
--  Production logistics. A generator, a sound system and a set of screens are
--  the producer's problem, and 0025 already decided that side of the wall.
--  Readable by the couple deliberately, though: there is nothing sensitive in
--  "there is a generator", and a couple who can see it stops asking.
create table if not exists public.event_equipment (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  item       text not null,
  needed     boolean not null default false,
  sorted     boolean not null default false,
  note       text not null default '',
  updated_at timestamptz not null default now(),
  unique (client_id, item),
  constraint equipment_item_len check (char_length(btrim(item)) between 1 and 120),
  constraint equipment_note_len check (char_length(note) <= 500)
);
create index if not exists event_equipment_client_idx on public.event_equipment (client_id);

alter table public.event_equipment enable row level security;

drop policy if exists event_equipment_read on public.event_equipment;
create policy event_equipment_read on public.event_equipment for select
  using (public.can_read_client(client_id));

drop policy if exists event_equipment_write on public.event_equipment;
create policy event_equipment_write on public.event_equipment for all
  using      (public.owns_producer(public.producer_of_client(client_id)))
  with check (public.owns_producer(public.producer_of_client(client_id)));

grant all on public.event_equipment to authenticated, service_role;


-- ── what he writes down about each of them ──────────────────────────────────
--  Two people per event, and the fields are the ones from his own file: what
--  she likes to drink, who is walking her in, what must not be forgotten. The
--  values are a jsonb object rather than a column each, for the same reason
--  the template steps are: the shape is edited and read as a whole, and a
--  field added to the list should not need a migration.
create table if not exists public.couple_details (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  /* 'a' and 'b' rather than bride and groom. Not every event this platform
     serves is a wedding, and not every wedding has one of each. */
  person     text not null,
  name       text not null default '',
  fields     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (client_id, person),
  constraint couple_person check (person in ('a', 'b')),
  constraint couple_name_len check (char_length(name) <= 120),
  constraint couple_fields check (jsonb_typeof(fields) = 'object')
);
create index if not exists couple_details_client_idx on public.couple_details (client_id);

alter table public.couple_details enable row level security;

/* The couple writes these about themselves. Producer reads and may correct,
   because half of them arrive over the phone and get typed by whoever is
   holding it. */
drop policy if exists couple_details_all on public.couple_details;
create policy couple_details_all on public.couple_details for all
  using      (public.can_read_client(client_id))
  with check (public.can_read_client(client_id));

grant all on public.couple_details to authenticated, service_role;


-- ── stamps ──────────────────────────────────────────────────────────────────
create or replace function public.stamp_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists event_music_stamped on public.event_music;
create trigger event_music_stamped before insert or update on public.event_music
  for each row execute function public.stamp_updated_at();

drop trigger if exists event_equipment_stamped on public.event_equipment;
create trigger event_equipment_stamped before insert or update on public.event_equipment
  for each row execute function public.stamp_updated_at();

drop trigger if exists couple_details_stamped on public.couple_details;
create trigger couple_details_stamped before insert or update on public.couple_details
  for each row execute function public.stamp_updated_at();


-- ── live, like everything else ──────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['event_music', 'event_equipment', 'couple_details'] loop
    execute format('alter table public.%I replica identity full', t);
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
