-- ============================================================================
--  0100 — a post in the circle can be corrected, and it says that it was
-- ============================================================================
--  0078 gave the author an update policy on both tables and nothing ever
--  used it, because an update on these tables cannot report what it did.
--  `select` is revoked here on purpose — the readers are two definer
--  functions and nothing else — so an update cannot ask for RETURNING, and
--  an update the policy refuses simply matches nothing, which is not an
--  error. Silence and refusal look identical. That is the same trap 0079
--  found under the producer's delete button, and the same answer: a function
--  that checks, writes, and says whether it wrote.
--
--  0079 also recorded who this belongs to, and nothing here widens it:
--  "Editing stays with the author. Moderation is removal, not rewriting
--  somebody's words under their own name." The producer may still take a
--  post down in their own circle and may still not change what it says.
--
--  The half that is new thinking is `edited_at`.
--
--  Every other panel that gained an edit this week holds a private record —
--  a budget line, an envelope, a car. The circle does not. A post is read by
--  strangers and answered underneath, and a rewrite with no mark leaves four
--  replies answering a question that is no longer on the screen. It makes
--  the people who replied look careless, which is a thing a product can do
--  to somebody and should not. So an edit is stamped and the stamp is shown.
--  It is nullable and null means never edited, rather than defaulting to the
--  creation time: "edited" has to mean edited.
--
--  `updated_at` is deliberately left alone. It exists on forum_posts, it is
--  only ever the insert default, and giving it a second meaning now would
--  make a column that is sometimes an audit field and sometimes a claim to
--  the reader.
--
--  Nothing here touches a row. Two nullable columns, two functions, and two
--  readers that emit one more field.
-- ============================================================================

-- ── the stamp ───────────────────────────────────────────────────────────────
--  Nullable, no default, no constraint: there is nothing an existing row
--  could fail, so nothing here can refuse one. (A check constraint on a
--  populated table would have to be `not valid`; there is no constraint.)
alter table public.forum_posts    add column if not exists edited_at timestamptz;
alter table public.forum_comments add column if not exists edited_at timestamptz;


-- ── correcting a post, by its author and nobody else ────────────────────────
--  The three fields a person can get wrong. Not `producer_id`, not
--  `author_id`, not `is_anonymous`: whether a post was signed is a promise
--  made to the room when it was written, and letting it be changed
--  afterwards would let somebody un-anonymise a neighbour's reply to them,
--  or disown a signed post after the argument went badly.
--
--  The same length rules as the insert, named here rather than left to the
--  table's check constraints, so a too-short title comes back as a sentence
--  the screen can show instead of as a Postgres error.
create or replace function public.circle_edit_post(
  p_post uuid, p_title text, p_content text, p_category text
) returns boolean
language plpgsql security definer set search_path = public as $$
declare done integer;
begin
  if char_length(btrim(coalesce(p_title, ''))) not between 2 and 140 then return false; end if;
  if char_length(btrim(coalesce(p_content, ''))) not between 2 and 6000 then return false; end if;

  with u as (
    update public.forum_posts p
       set title     = btrim(p_title),
           content   = btrim(p_content),
           category  = coalesce(nullif(btrim(p_category), ''), p.category),
           edited_at = now()
     where p.id = p_post
       and p.author_id = auth.uid()
    returning 1
  ) select count(*) into done from u;
  return done > 0;
end $$;

create or replace function public.circle_edit_comment(p_comment uuid, p_content text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare done integer;
begin
  if char_length(btrim(coalesce(p_content, ''))) not between 1 and 4000 then return false; end if;

  with u as (
    update public.forum_comments fc
       set content   = btrim(p_content),
           edited_at = now()
     where fc.id = p_comment
       and fc.author_id = auth.uid()
    returning 1
  ) select count(*) into done from u;
  return done > 0;
end $$;

revoke all on function public.circle_edit_post(uuid, text, text, text) from public;
revoke all on function public.circle_edit_comment(uuid, text) from public;
grant execute on function public.circle_edit_post(uuid, text, text, text) to authenticated;
grant execute on function public.circle_edit_comment(uuid, text) to authenticated;


-- ── the readers carry the stamp ─────────────────────────────────────────────
--  A function's return table cannot be widened in place, so each is dropped
--  and written again. `drop ... if exists` rather than a bare drop, because
--  sync.sql replays this file on every deploy with ON_ERROR_STOP and a
--  second run must be as quiet as the first.
drop function if exists public.forum_feed(uuid, text, integer);
create function public.forum_feed(p_producer uuid, p_category text default '', p_limit integer default 40)
returns table (
  id uuid, category text, title text, content text, upvotes integer,
  created_at timestamptz, is_anonymous boolean, is_producer boolean,
  author_name text, months_out integer, mine boolean, voted boolean, replies integer,
  edited_at timestamptz
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
         (select count(*)::integer from public.forum_comments fc where fc.post_id = p.id),
         p.edited_at
    from public.forum_posts p
    join public.profiles pr on pr.id = p.author_id
    left join public.clients c on c.id = p.client_id
   where public.in_circle(p.producer_id)
     and p.producer_id = p_producer
     and (p_category = '' or p.category = p_category)
   order by p.created_at desc
   limit greatest(1, least(coalesce(p_limit, 40), 200))
$$;

revoke all on function public.forum_feed(uuid, text, integer) from public;
grant execute on function public.forum_feed(uuid, text, integer) to authenticated;


drop function if exists public.forum_thread(uuid);
create function public.forum_thread(p_post uuid)
returns table (
  id uuid, content text, created_at timestamptz,
  is_anonymous boolean, is_producer boolean, author_name text, months_out integer, mine boolean,
  edited_at timestamptz
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
         fc.author_id = auth.uid(),
         fc.edited_at
    from public.forum_comments fc
    join public.profiles pr on pr.id = fc.author_id
    left join public.clients c on c.id = fc.client_id
   where public.post_in_circle(fc.post_id)
     and fc.post_id = p_post
   order by fc.created_at
$$;

revoke all on function public.forum_thread(uuid) from public;
grant execute on function public.forum_thread(uuid) to authenticated;


drop function if exists public.forum_post(uuid);
create function public.forum_post(p_post uuid)
returns table (
  id uuid, category text, title text, content text, upvotes integer,
  created_at timestamptz, is_anonymous boolean, is_producer boolean,
  author_name text, months_out integer, mine boolean, voted boolean, replies integer,
  edited_at timestamptz
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
         (select count(*)::integer from public.forum_comments fc where fc.post_id = p.id),
         p.edited_at
    from public.forum_posts p
    join public.profiles pr on pr.id = p.author_id
    left join public.clients c on c.id = p.client_id
   where public.in_circle(p.producer_id)
     and p.id = p_post
$$;

revoke all on function public.forum_post(uuid) from public;
grant execute on function public.forum_post(uuid) to authenticated;
