-- ============================================================================
--  0041 — a list you can put in your own order
-- ============================================================================
--  A task list is sorted by whether it is done and then by when it is due,
--  which is a reasonable guess and is not how anybody works. The three things
--  that matter this week are not the three with the earliest dates; they are
--  the three the producer decided matter, and until now there was nowhere to
--  record that decision.
--
--  So: a position, and one call that writes a whole new order at once.
--
--  Written as a single statement on purpose. A loop of updates sent from a
--  browser leaves the list in an order that exists nowhere the moment one of
--  them fails, and the row that moved is the one that looks right while the
--  four around it are wrong.
-- ============================================================================

alter table public.tasks add column if not exists sort_order integer not null default 0;

/* Existing rows get the order they are already being shown in, so the first
   drag moves one row rather than shuffling the whole list. Runs once: every
   row is at zero exactly until this has been applied. */
do $$ begin
  if not exists (select 1 from public.tasks where sort_order <> 0) then
    update public.tasks t
       set sort_order = x.pos
      from (
        select id, row_number() over (
                 partition by client_id
                 order by done, due_on nulls last, created_at
               ) as pos
          from public.tasks
      ) x
     where t.id = x.id;
  end if;
end $$;

create index if not exists tasks_order_idx on public.tasks (client_id, sort_order);


/**
 *  The result of a drag, in one statement.
 *
 *  Deliberately not "the caller owns these": a couple reorders their own
 *  checklist too, and the question this asks is the same one the read policy
 *  asks. What it will not do is move a task between workspaces — every row is
 *  matched by id and left where it is if the caller cannot reach it, so an
 *  array with somebody else's task id in it reorders everything except that.
 */
create or replace function public.reorder_tasks(p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_ids is null or array_length(p_ids, 1) is null then return; end if;

  update public.tasks t
     set sort_order = x.pos
    from unnest(p_ids) with ordinality as x(id, pos)
   where t.id = x.id
     and public.can_read_client(t.client_id);
end $$;

revoke all on function public.reorder_tasks(uuid[]) from public;
grant execute on function public.reorder_tasks(uuid[]) to authenticated, service_role;
