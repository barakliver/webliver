-- ============================================================================
--  0079 — the producer can moderate their own circle, and one post can be
--         opened however old it is
-- ============================================================================
--  Two things 0078 got wrong, both found by reading it rather than by
--  anybody hitting them.
--
--  The first is a button that lies. The circle's screen offers the producer
--  a delete on any post, because a circle with nobody able to take anything
--  down is not a thing to switch on for a paying client. The policy allowed
--  a delete only by the author, so the button did nothing and said nothing:
--  the delete matched no row, which is not an error, so there was not even a
--  failure to report. Either the button goes or the power is real, and the
--  power should be real: it is their circle, under their brand, and they are
--  the one a couple complains to. So the producer may delete a post or a
--  reply in their own circle, and nobody else's, through a function that
--  says whether it removed anything: select is revoked on these tables, so
--  a plain delete could neither return the row nor report the refusal.
--
--  Editing stays with the author. Moderation is removal, not rewriting
--  somebody's words under their own name.
--
--  The second is a post nobody can open. The thread screen found its post by
--  reading the feed and looking through it, and the feed stops at the newest
--  few dozen; the sixty-first post opened as "not found". A reader for one
--  post, with the same gate and the same promise about an anonymous author.
--
--  Nothing here touches a row.
-- ============================================================================

-- ── whose circle is this post in ────────────────────────────────────────────
--  Definer, for the same reason post_in_circle is: a policy that read
--  forum_posts directly would read a table with no select policy and find
--  nothing at all.
create or replace function public.post_mine_to_moderate(p_post uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.forum_posts p
     where p.id = p_post and public.owns_producer(p.producer_id)
  )
$$;

revoke all on function public.post_mine_to_moderate(uuid) from public;
grant execute on function public.post_mine_to_moderate(uuid) to authenticated;


-- ── removal, by the author or by the producer whose circle it is ────────────
--  Through a function rather than through the client's own delete, and for
--  a reason the row policy alone cannot solve: select is revoked on these
--  tables, so a delete that asks for RETURNING is refused outright, and a
--  delete that does not ask has no way to say whether it removed anything.
--  Silence and refusal looked identical, which is exactly how the button
--  came to do nothing quietly. This checks, deletes, and answers.
create or replace function public.circle_delete_post(p_post uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare gone integer;
begin
  with d as (
    delete from public.forum_posts p
     where p.id = p_post
       and (p.author_id = auth.uid() or public.owns_producer(p.producer_id))
    returning 1
  ) select count(*) into gone from d;
  return gone > 0;
end $$;

create or replace function public.circle_delete_comment(p_comment uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare gone integer;
begin
  with d as (
    delete from public.forum_comments fc
     where fc.id = p_comment
       and (fc.author_id = auth.uid() or public.post_mine_to_moderate(fc.post_id))
    returning 1
  ) select count(*) into gone from d;
  return gone > 0;
end $$;

revoke all on function public.circle_delete_post(uuid) from public;
revoke all on function public.circle_delete_comment(uuid) from public;
grant execute on function public.circle_delete_post(uuid) to authenticated;
grant execute on function public.circle_delete_comment(uuid) to authenticated;

/* The policies stay as the second fence, widened to match: the function is
   the door the screen uses, and a direct delete may do no more than it. */
drop policy if exists forum_posts_own_delete on public.forum_posts;
create policy forum_posts_own_delete on public.forum_posts for delete
  using (author_id = auth.uid() or public.owns_producer(producer_id));

drop policy if exists forum_comments_own_delete on public.forum_comments;
create policy forum_comments_own_delete on public.forum_comments for delete
  using (author_id = auth.uid() or public.post_mine_to_moderate(post_id));


-- ── one post, opened directly ───────────────────────────────────────────────
--  The same columns forum_feed emits, for one id, so the thread screen and
--  the feed cannot disagree about what a post says or about who wrote it.
create or replace function public.forum_post(p_post uuid)
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
   where p.id = p_post
     and public.in_circle(p.producer_id)
$$;

revoke all on function public.forum_post(uuid) from public;
grant execute on function public.forum_post(uuid) to authenticated;

comment on function public.forum_post(uuid) is
  'One post of the circle, by id, with the same promise about an anonymous author that forum_feed makes.';
