-- ============================================================================
--  0078 — the couple keeps a journal, and joins a circle
-- ============================================================================
--  Two things a couple does that the platform had no room for.
--
--  The first is private: they go to four weddings in the year before their
--  own, and every one of them teaches something. What worked, what to avoid,
--  and what it means for their evening. That went into a phone's notes app
--  and was never read again. `event_critique_logs` is one row per wedding
--  they attended, on their own workspace, readable by them and by their
--  producer and by nobody else — the same gate every other row on a
--  workspace uses, `can_read_client`, rather than a second answer to the
--  same question.
--
--  The second is shared, and is where the care goes. A circle of couples
--  advising each other has three properties that have to be true in the
--  database rather than on the screen:
--
--    1. It stops at the producer. This is a white-label platform: one
--       producer's couples are not another producer's couples, and a forum
--       that spans tenants is a leak wearing the clothes of a feature. Every
--       post carries the producer it belongs to and every read goes through
--       `in_circle`.
--
--    2. Anonymous means anonymous. A row policy cannot hide a column, so a
--       couple with the publishable key could have read `author_id` off an
--       anonymous post and undone the promise. There is therefore no select
--       policy on these tables at all: reading happens through the two
--       definer readers below, which never emit the author of an anonymous
--       post. Writing keeps its policies, so a couple may post, edit their
--       own and delete their own, and nothing else.
--
--    3. The producer's badge is earned, not asserted. `is_producer` is set
--       by a trigger from the author's actual role. As a column the caller
--       could set, it would be a way to answer as somebody's producer.
--
--  A vote is a row rather than a number somebody can increment: one per
--  person per post, by the primary key, with the count kept on the post by
--  a trigger so a feed costs one read.
--
--  Nothing here touches an existing row.
-- ============================================================================

-- ── the journal ─────────────────────────────────────────────────────────────
create table if not exists public.event_critique_logs (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  venue_name  text not null default '',
  event_date  date,
  /* גן, אולם, שישי צהריים, טבע — checked in the application against one
     list, kept as text here so a new style is a content change. */
  style       text not null default '',
  /* Tag keys from src/content/critique.ts, plus whatever they typed. */
  pros        text[] not null default '{}',
  cons        text[] not null default '{}',
  pros_note   text not null default '',
  cons_note   text not null default '',
  takeaways   text not null default '',
  /* Object paths in the `files` bucket, under this workspace's own folder,
     so the storage policy already written governs them. */
  photos      text[] not null default '{}',
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint event_critique_venue check (char_length(venue_name) <= 120),
  constraint event_critique_style check (char_length(style) <= 40),
  constraint event_critique_notes check (char_length(pros_note) <= 2000 and char_length(cons_note) <= 2000),
  constraint event_critique_take  check (char_length(takeaways) <= 4000),
  constraint event_critique_tags  check (array_length(pros, 1) is null or array_length(pros, 1) <= 30),
  constraint event_critique_cons  check (array_length(cons, 1) is null or array_length(cons, 1) <= 30),
  constraint event_critique_photos check (array_length(photos, 1) is null or array_length(photos, 1) <= 20)
);

alter table public.event_critique_logs enable row level security;

drop policy if exists event_critique_logs_workspace on public.event_critique_logs;
create policy event_critique_logs_workspace on public.event_critique_logs for all
  using      (public.can_read_client(client_id))
  with check (public.can_read_client(client_id));

grant select, insert, update, delete on public.event_critique_logs to authenticated;

create index if not exists event_critique_logs_client_idx
  on public.event_critique_logs (client_id, event_date desc nulls last);

comment on table public.event_critique_logs is
  'A wedding the couple attended as guests: what worked, what to avoid, and what it means for their own evening. Theirs and their producer''s.';


-- ── who is in a producer's circle ───────────────────────────────────────────
--  The producer, and every couple with a live workspace under them. Archived
--  workspaces stay in: a couple who married last month still has advice, and
--  taking their posts away the day their event closes would be a strange way
--  to end a year of planning.
create or replace function public.in_circle(p_producer uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.owns_producer(p_producer)
      or exists (
        select 1
          from public.clients c
         where c.producer_id = p_producer
           and public.is_authorized_on_client(c.id)
      )
$$;

revoke all on function public.in_circle(uuid) from public;
grant execute on function public.in_circle(uuid) to authenticated;

comment on function public.in_circle(uuid) is
  'Whether the signed-in account belongs to this producer''s circle: the producer, or a couple on one of their workspaces.';


-- ── the circle ──────────────────────────────────────────────────────────────
create table if not exists public.forum_posts (
  id          uuid primary key default gen_random_uuid(),
  producer_id uuid not null references public.producers(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  /* The author's workspace, for the months-until label on an anonymous
     post. Never emitted by either reader below. */
  client_id   uuid references public.clients(id) on delete set null,
  is_anonymous boolean not null default false,
  /* general, vendors, styling, food — checked in the application. */
  category    text not null default 'general',
  title       text not null,
  content     text not null,
  /* Kept by the trigger under forum_votes; never written by a caller. */
  upvotes     integer not null default 0,
  /* Set by a trigger from the author's role, so the badge cannot be worn. */
  is_producer boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint forum_posts_title   check (char_length(btrim(title)) between 2 and 140),
  constraint forum_posts_content check (char_length(btrim(content)) between 2 and 6000),
  constraint forum_posts_category check (char_length(category) <= 24)
);

create table if not exists public.forum_comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.forum_posts(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  client_id   uuid references public.clients(id) on delete set null,
  is_anonymous boolean not null default false,
  is_producer boolean not null default false,
  content     text not null,
  created_at  timestamptz not null default now(),
  constraint forum_comments_content check (char_length(btrim(content)) between 1 and 4000)
);

create table if not exists public.forum_votes (
  post_id    uuid not null references public.forum_posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);

create index if not exists forum_posts_circle_idx on public.forum_posts (producer_id, created_at desc);
create index if not exists forum_comments_post_idx on public.forum_comments (post_id, created_at);

alter table public.forum_posts    enable row level security;
alter table public.forum_comments enable row level security;
alter table public.forum_votes    enable row level security;

/* No select policy anywhere here, deliberately: see the head of this file.
   Reading is the two definer readers below. */
drop policy if exists forum_posts_write on public.forum_posts;
create policy forum_posts_write on public.forum_posts for insert
  with check (author_id = auth.uid() and public.in_circle(producer_id));
drop policy if exists forum_posts_own_update on public.forum_posts;
create policy forum_posts_own_update on public.forum_posts for update
  using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists forum_posts_own_delete on public.forum_posts;
create policy forum_posts_own_delete on public.forum_posts for delete
  using (author_id = auth.uid());

/* Whether a post is in the reader's circle, answered by a definer.
   A policy that read forum_posts directly would read a table with no
   select policy and always find nothing, which is how the producer's very
   first reply was refused. */
create or replace function public.post_in_circle(p_post uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.forum_posts p
     where p.id = p_post and public.in_circle(p.producer_id)
  )
$$;
revoke all on function public.post_in_circle(uuid) from public;
grant execute on function public.post_in_circle(uuid) to authenticated;

drop policy if exists forum_comments_write on public.forum_comments;
create policy forum_comments_write on public.forum_comments for insert
  with check (author_id = auth.uid() and public.post_in_circle(post_id));
drop policy if exists forum_comments_own_update on public.forum_comments;
create policy forum_comments_own_update on public.forum_comments for update
  using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists forum_comments_own_delete on public.forum_comments;
create policy forum_comments_own_delete on public.forum_comments for delete
  using (author_id = auth.uid());

drop policy if exists forum_votes_own on public.forum_votes;
create policy forum_votes_own on public.forum_votes for insert
  with check (profile_id = auth.uid() and public.post_in_circle(post_id));
drop policy if exists forum_votes_own_delete on public.forum_votes;
create policy forum_votes_own_delete on public.forum_votes for delete
  using (profile_id = auth.uid());

/* Select is revoked as well as ungranted: Supabase grants the public
   schema's tables to `authenticated` by default, and with a grant in place
   and no policy a direct read is a silent empty rather than a refusal.
   Silent is safe and a refusal is honest, and an anonymous author's id
   should be behind both. */
revoke select on public.forum_posts    from authenticated, anon;
revoke select on public.forum_comments from authenticated, anon;
revoke select on public.forum_votes    from authenticated, anon;
grant insert, update, delete on public.forum_posts    to authenticated;
grant insert, update, delete on public.forum_comments to authenticated;
grant insert, delete         on public.forum_votes    to authenticated;


-- ── the badge is earned ─────────────────────────────────────────────────────
create or replace function public.forum_stamp_author() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.is_producer := exists (
    select 1 from public.producers pr where pr.owner_id = new.author_id
  );
  return new;
end $$;

drop trigger if exists forum_posts_stamp on public.forum_posts;
create trigger forum_posts_stamp before insert or update on public.forum_posts
  for each row execute function public.forum_stamp_author();

drop trigger if exists forum_comments_stamp on public.forum_comments;
create trigger forum_comments_stamp before insert or update on public.forum_comments
  for each row execute function public.forum_stamp_author();


-- ── the count follows the votes ─────────────────────────────────────────────
create or replace function public.forum_count_votes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.forum_posts p
     set upvotes = (select count(*) from public.forum_votes v where v.post_id = p.id)
   where p.id = coalesce(new.post_id, old.post_id);
  return null;
end $$;

drop trigger if exists forum_votes_counted on public.forum_votes;
create trigger forum_votes_counted after insert or delete on public.forum_votes
  for each row execute function public.forum_count_votes();


-- ── reading the circle ──────────────────────────────────────────────────────
--  Definer, because there is no select policy: the gate is `in_circle` in
--  the body. An anonymous post emits no author id and no name — only how
--  many months out its author is, which is the whole point of the label the
--  screen shows.
create or replace function public.forum_feed(p_producer uuid, p_category text default '', p_limit integer default 40)
returns table (
  id uuid, category text, title text, content text, upvotes integer,
  created_at timestamptz, is_anonymous boolean, is_producer boolean,
  author_name text, months_out integer, mine boolean, voted boolean, replies integer
)
language sql stable security definer set search_path = public as $$
  select p.id, p.category, p.title, p.content, p.upvotes,
         p.created_at, p.is_anonymous, p.is_producer,
         case when p.is_anonymous then '' else coalesce(pr.full_name, '') end,
         case
           when p.is_anonymous and c.event_date is not null and c.event_date > current_date
           then (extract(year  from age(c.event_date, current_date)) * 12
               + extract(month from age(c.event_date, current_date)))::integer
           else null
         end,
         p.author_id = auth.uid(),
         exists (select 1 from public.forum_votes v where v.post_id = p.id and v.profile_id = auth.uid()),
         (select count(*)::integer from public.forum_comments fc where fc.post_id = p.id)
    from public.forum_posts p
    join public.profiles pr on pr.id = p.author_id
    left join public.clients c on c.id = p.client_id
   where public.in_circle(p.producer_id)
     and p.producer_id = p_producer
     and (p_category = '' or p.category = p_category)
   order by p.created_at desc
   limit greatest(1, least(coalesce(p_limit, 40), 200))
$$;

create or replace function public.forum_thread(p_post uuid)
returns table (
  id uuid, content text, created_at timestamptz,
  is_anonymous boolean, is_producer boolean, author_name text, months_out integer, mine boolean
)
language sql stable security definer set search_path = public as $$
  select fc.id, fc.content, fc.created_at, fc.is_anonymous, fc.is_producer,
         case when fc.is_anonymous then '' else coalesce(pr.full_name, '') end,
         case
           when fc.is_anonymous and c.event_date is not null and c.event_date > current_date
           then (extract(year  from age(c.event_date, current_date)) * 12
               + extract(month from age(c.event_date, current_date)))::integer
           else null
         end,
         fc.author_id = auth.uid()
    from public.forum_comments fc
    join public.forum_posts p on p.id = fc.post_id
    join public.profiles pr on pr.id = fc.author_id
    left join public.clients c on c.id = fc.client_id
   where fc.post_id = p_post
     and public.in_circle(p.producer_id)
   order by fc.created_at
$$;

revoke all on function public.forum_feed(uuid, text, integer) from public;
revoke all on function public.forum_thread(uuid) from public;
grant execute on function public.forum_feed(uuid, text, integer) to authenticated;
grant execute on function public.forum_thread(uuid) to authenticated;

comment on function public.forum_feed(uuid, text, integer) is
  'The circle''s posts for one producer. Emits no author for an anonymous post: the promise is kept here rather than on the screen.';
