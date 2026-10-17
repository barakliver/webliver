-- 0105  The questionnaire is where a couple is known from.
--
--  Every couple's screen looked the same, because nothing on the platform
--  had ever asked them who they are. This is one questionnaire in six
--  short chapters, answered in stages from a phone, by either partner, and
--  from the moment it is answered the product knows a religious wedding
--  of three hundred from a secular one of a hundred and twenty.
--
--  The questions themselves live in code (`content/intake.ts`), not in a
--  table: they are Hebrew wording, versioned with the product, and a
--  table of questions nobody can edit from a screen is a table somebody
--  has to maintain in SQL. What the database holds is the answers, keyed
--  by question, and a profile derived from them by a trigger so every
--  screen reads one row rather than thirty-six.
--
--  Three privacy rules, each a table and not a column. An answer in the
--  "between us" chapter is `private`: the partner who wrote it and the
--  producer read it, the other partner does not, and that is a row
--  condition on the policy. The producer's note on an answer is its own
--  table with no policy for the couple. And the sensitivities (who must
--  not sit together, a loss in the family) are `couple_profiles_private`,
--  for the crew's reason: a policy grants rows and rows carry columns.

create table if not exists public.questionnaire_responses (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  /* couple_intake / wedding_day */
  form_key     text not null default 'couple_intake',
  question_key text not null,
  answered_by  uuid not null references public.profiles(id) on delete cascade,
  value        jsonb not null,
  /* couple: both partners read it. private: the writer and the producer. */
  visibility   text not null default 'couple',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint questionnaire_responses_len check (
    char_length(form_key) <= 40 and char_length(question_key) <= 60
    and visibility in ('couple', 'private')
    and pg_column_size(value) <= 20000
  ),
  unique (client_id, form_key, question_key, answered_by)
);
create index if not exists questionnaire_responses_client_idx
  on public.questionnaire_responses (client_id, form_key, question_key);

alter table public.questionnaire_responses enable row level security;
drop policy if exists questionnaire_responses_producer on public.questionnaire_responses;
create policy questionnaire_responses_producer on public.questionnaire_responses for all
  using (public.owns_producer(public.producer_of_client(client_id)) or public.is_super_admin())
  with check (public.owns_producer(public.producer_of_client(client_id)) or public.is_super_admin());
drop policy if exists questionnaire_responses_couple_read on public.questionnaire_responses;
create policy questionnaire_responses_couple_read on public.questionnaire_responses for select
  using (public.can_read_client(client_id) and (visibility = 'couple' or answered_by = auth.uid()));
drop policy if exists questionnaire_responses_couple_write on public.questionnaire_responses;
create policy questionnaire_responses_couple_write on public.questionnaire_responses for all
  using (public.can_read_client(client_id) and answered_by = auth.uid())
  with check (public.can_read_client(client_id) and answered_by = auth.uid());

drop trigger if exists questionnaire_responses_touch on public.questionnaire_responses;
create trigger questionnaire_responses_touch before update on public.questionnaire_responses
  for each row execute function public.touch_updated_at();

-- ── the producer's note beside an answer ──────────────────────────────────
create table if not exists public.questionnaire_notes (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  question_key text not null,
  note         text not null,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint questionnaire_notes_len check (char_length(question_key) <= 60 and char_length(note) between 1 and 4000)
);
create index if not exists questionnaire_notes_client_idx on public.questionnaire_notes (client_id, question_key);
alter table public.questionnaire_notes enable row level security;
drop policy if exists questionnaire_notes_producer on public.questionnaire_notes;
create policy questionnaire_notes_producer on public.questionnaire_notes for all
  using (public.owns_producer(public.producer_of_client(client_id)) or public.is_super_admin())
  with check (public.owns_producer(public.producer_of_client(client_id)) or public.is_super_admin());

-- ── the profile, derived ──────────────────────────────────────────────────
create table if not exists public.couple_profiles (
  client_id          uuid primary key references public.clients(id) on delete cascade,
  nickname           text not null default '',
  style_tags         text[] not null default '{}',
  religious_level    text not null default '',
  ceremony           text not null default '',
  kosher_level       text not null default '',
  shabbat_constraint boolean not null default false,
  estimated_guests   int,
  venue_type         text not null default '',
  region             text not null default '',
  priorities         text[] not null default '{}',
  music_genres       jsonb not null default '{}'::jsonb,
  no_play_songs      text[] not null default '{}',
  must_play_songs    text[] not null default '{}',
  colors             text[] not null default '{}',
  avoid_color        text not null default '',
  key_people         jsonb not null default '[]'::jsonb,
  children           int,
  afterparty         boolean not null default false,
  food               text not null default '',
  service_style      text not null default '',
  alcohol            text not null default '',
  budget_range       text not null default '',
  paid_by            text not null default '',
  comms_channel      text not null default '',
  comms_frequency    text not null default '',
  quiet_hours        text not null default '',
  primary_contact    text not null default '',
  /* Answered required questions over all of them, 0 to 1. */
  completeness       numeric(3,2) not null default 0,
  updated_at         timestamptz not null default now()
);
alter table public.couple_profiles enable row level security;
drop policy if exists couple_profiles_read on public.couple_profiles;
create policy couple_profiles_read on public.couple_profiles for select
  using (public.can_read_client(client_id));
/* Written by the trigger alone, which is security definer. No insert or
   update policy for anybody: a profile typed by hand is a profile that
   disagrees with its own answers. */

create table if not exists public.couple_profiles_private (
  client_id     uuid primary key references public.clients(id) on delete cascade,
  sensitivities text not null default '',
  surprises     text not null default '',
  /* "Prepare me for the meeting": the one-page brief, and when it was made. */
  brief         text not null default '',
  brief_at      timestamptz,
  updated_at    timestamptz not null default now()
);
alter table public.couple_profiles_private enable row level security;
drop policy if exists couple_profiles_private_producer on public.couple_profiles_private;
create policy couple_profiles_private_producer on public.couple_profiles_private for all
  using (public.owns_producer(public.producer_of_client(client_id)) or public.is_super_admin())
  with check (public.owns_producer(public.producer_of_client(client_id)) or public.is_super_admin());

-- ── the rebuild ───────────────────────────────────────────────────────────
-- One answer per question, the latest, with the `couple` visibility
-- preferred so a profile is built from what both partners can see. The
-- keys are the ones `content/intake.ts` names, and the test beside it
-- reads this file and fails if a key the content uses is not read here.
create or replace function public.intake_text(p_client uuid, p_key text) returns text
language sql stable as $$
  select case
    when jsonb_typeof(value) = 'string' then value #>> '{}'
    when jsonb_typeof(value) = 'array' then (select string_agg(x, ', ') from jsonb_array_elements_text(value) x)
    else value::text end
  from public.questionnaire_responses
  where client_id = p_client and form_key = 'couple_intake' and question_key = p_key
  order by (visibility = 'couple') desc, updated_at desc limit 1
$$;

create or replace function public.intake_json(p_client uuid, p_key text) returns jsonb
language sql stable as $$
  select value from public.questionnaire_responses
  where client_id = p_client and form_key = 'couple_intake' and question_key = p_key
  order by (visibility = 'couple') desc, updated_at desc limit 1
$$;

create or replace function public.intake_list(p_client uuid, p_key text) returns text[]
language sql stable as $$
  select case
    when v is null then '{}'::text[]
    when jsonb_typeof(v) = 'array' then (select coalesce(array_agg(x), '{}') from jsonb_array_elements_text(v) x)
    when jsonb_typeof(v) = 'string' then array[v #>> '{}']
    else '{}'::text[] end
  from (select public.intake_json(p_client, p_key) v) s
$$;

create or replace function public.rebuild_couple_profile(p_client uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  answered int;
  total int := 52;
  guests text;
  kids text;
begin
  select count(distinct question_key) into answered
    from public.questionnaire_responses
    where client_id = p_client and form_key = 'couple_intake'
      and value is not null and value::text not in ('""', 'null', '[]', '{}');
  guests := public.intake_text(p_client, 'b9_guests');
  kids := public.intake_text(p_client, 'c19_children');

  insert into public.couple_profiles as cp (
    client_id, nickname, style_tags, religious_level, ceremony, kosher_level, shabbat_constraint,
    estimated_guests, venue_type, region, priorities, music_genres, no_play_songs, must_play_songs,
    colors, avoid_color, key_people, children, afterparty, food, service_style, alcohol,
    budget_range, paid_by, comms_channel, comms_frequency, quiet_hours, primary_contact, completeness, updated_at
  ) values (
    p_client,
    coalesce(public.intake_text(p_client, 'a1_nickname'), ''),
    public.intake_list(p_client, 'b11_style'),
    coalesce(public.intake_text(p_client, 'b13_religious'), ''),
    coalesce(public.intake_text(p_client, 'b13_ceremony'), ''),
    coalesce(public.intake_text(p_client, 'b15_kosher'), ''),
    coalesce(public.intake_text(p_client, 'b14_shabbat'), '') in ('after_shabbat', 'both'),
    case when guests ~ '^\d+$' then guests::int else null end,
    coalesce(public.intake_text(p_client, 'b10_venue_type'), ''),
    coalesce(public.intake_text(p_client, 'b10_region'), ''),
    public.intake_list(p_client, 'd28_priorities'),
    coalesce(public.intake_json(p_client, 'd23_genres'), '{}'::jsonb),
    public.intake_list(p_client, 'd22_no_play'),
    public.intake_list(p_client, 'd22_must_play'),
    public.intake_list(p_client, 'd26_colors'),
    coalesce(public.intake_text(p_client, 'd26_avoid'), ''),
    coalesce(public.intake_json(p_client, 'c20_key_people'), '[]'::jsonb),
    case when kids ~ '^\d+$' then kids::int else null end,
    coalesce(public.intake_text(p_client, 'b12_afterparty'), '') = 'yes',
    coalesce(public.intake_text(p_client, 'd24_food'), ''),
    coalesce(public.intake_text(p_client, 'd24_service'), ''),
    coalesce(public.intake_text(p_client, 'd25_alcohol'), ''),
    coalesce(public.intake_text(p_client, 'f34_budget'), ''),
    coalesce(public.intake_text(p_client, 'f34_paid_by'), ''),
    coalesce(public.intake_text(p_client, 'f35_channel'), ''),
    coalesce(public.intake_text(p_client, 'f35_frequency'), ''),
    coalesce(public.intake_text(p_client, 'f35_quiet'), ''),
    coalesce(public.intake_text(p_client, 'f36_contact'), ''),
    least(1, round(answered::numeric / total, 2)),
    now()
  )
  on conflict (client_id) do update set
    nickname = excluded.nickname, style_tags = excluded.style_tags, religious_level = excluded.religious_level,
    ceremony = excluded.ceremony, kosher_level = excluded.kosher_level, shabbat_constraint = excluded.shabbat_constraint,
    estimated_guests = excluded.estimated_guests, venue_type = excluded.venue_type, region = excluded.region,
    priorities = excluded.priorities, music_genres = excluded.music_genres, no_play_songs = excluded.no_play_songs,
    must_play_songs = excluded.must_play_songs, colors = excluded.colors, avoid_color = excluded.avoid_color,
    key_people = excluded.key_people, children = excluded.children, afterparty = excluded.afterparty,
    food = excluded.food, service_style = excluded.service_style, alcohol = excluded.alcohol,
    budget_range = excluded.budget_range, paid_by = excluded.paid_by, comms_channel = excluded.comms_channel,
    comms_frequency = excluded.comms_frequency, quiet_hours = excluded.quiet_hours, primary_contact = excluded.primary_contact,
    completeness = excluded.completeness, updated_at = now();

  /* The private half: only ever the producer's. Both partners' answers
     are kept, one under the other, because the two may differ and that
     difference is the point of the chapter. */
  insert into public.couple_profiles_private as pp (client_id, sensitivities, surprises, updated_at)
  values (
    p_client,
    coalesce((select string_agg(value #>> '{}', E'\n---\n' order by updated_at) from public.questionnaire_responses
      where client_id = p_client and form_key = 'couple_intake' and question_key = 'c21_sensitivities'), ''),
    coalesce((select string_agg(value #>> '{}', E'\n---\n' order by updated_at) from public.questionnaire_responses
      where client_id = p_client and form_key = 'couple_intake' and question_key = 'e31_surprise'), ''),
    now()
  )
  on conflict (client_id) do update set
    sensitivities = excluded.sensitivities, surprises = excluded.surprises, updated_at = now();
end $$;

create or replace function public.questionnaire_rebuild() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.rebuild_couple_profile(coalesce(new.client_id, old.client_id));
  return coalesce(new, old);
end $$;
drop trigger if exists questionnaire_responses_rebuild on public.questionnaire_responses;
create trigger questionnaire_responses_rebuild after insert or update or delete on public.questionnaire_responses
  for each row execute function public.questionnaire_rebuild();

comment on table public.questionnaire_responses is
  'One answer per question per partner. private rows are read by their writer and the producer only.';
comment on table public.couple_profiles is
  'Derived from the answers by rebuild_couple_profile; never written by hand.';
comment on table public.couple_profiles_private is
  'The answers only the producer reads: sensitivities, surprises, and the meeting brief.';
