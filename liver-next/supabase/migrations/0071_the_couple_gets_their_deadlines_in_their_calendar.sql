-- ============================================================================
--  0071 — the couple gets their deadlines in their calendar
-- ============================================================================
--  The plan for the year is written into tasks with due dates. A due date
--  nobody is reminded of is a date that is discovered the morning after, so
--  a task can now carry how many days ahead to say so, and the calendar
--  subscription turns that into an alarm on the phone.
--
--  The couple's calendar feed carried their event and its run sheet, which
--  is what they want on the morning. It did not carry the tasks, which is
--  what they want in the year before: "send the invitations" on the family
--  calendar, with a reminder a week ahead, is the whole point of the plan.
--  Only the tasks the producer shares with them, and only the open ones.
--
--  The feed function changes its shape (one more column), and Postgres will
--  not alter a function's return type in place, so it is dropped and made
--  again. The grants go with it and are restored below. No row is touched.
-- ============================================================================

alter table public.tasks
  add column if not exists remind_days smallint;

do $$ begin
  alter table public.tasks add constraint tasks_remind_days_range
    check (remind_days is null or (remind_days between 0 and 60));
exception when duplicate_object then null; end $$;

comment on column public.tasks.remind_days is
  'Days before due_on to remind. Null means no reminder beyond the date itself.';

drop function if exists public.calendar_by_token(text);

create function public.calendar_by_token(p_token text)
returns table (starts_on date, at_time time, title text, detail text, kind text, remind_days integer)
language plpgsql security definer set search_path = public as $$
declare f record;
begin
  select cf.profile_id, cf.client_id into f
    from public.calendar_feeds cf
   where cf.token = p_token and cf.revoked_at is null
   limit 1;

  if not found then return; end if;

  if f.client_id is null then
    -- the producer's whole diary
    return query
      select c.event_date, null::time, c.display_name,
             coalesce(nullif(c.venue, ''), ''), 'event', null::integer
        from public.clients c
        join public.producers pr on pr.id = c.producer_id
       where pr.owner_id = f.profile_id
         and c.archived_at is null
         and c.event_date is not null;

    return query
      select t.due_on, null::time, t.title, coalesce(c.display_name, ''), 'task', t.remind_days::integer
        from public.tasks t
        join public.clients c on c.id = t.client_id
        join public.producers pr on pr.id = c.producer_id
       where pr.owner_id = f.profile_id
         and c.archived_at is null
         and t.due_on is not null
         and not t.done;

    return query
      select p.due_on, null::time, p.title,
             coalesce(c.display_name, '') ||
               case when p.amount is not null then ' · ₪' || round(p.amount)::text else '' end,
             'payment', null::integer
        from public.payments p
        join public.clients c on c.id = p.client_id
        join public.producers pr on pr.id = c.producer_id
       where pr.owner_id = f.profile_id
         and c.archived_at is null
         and p.due_on is not null
         and not p.paid;
  else
    -- one event, for the couple
    return query
      select c.event_date, null::time, c.display_name,
             coalesce(nullif(c.venue, ''), ''), 'event', null::integer
        from public.clients c
       where c.id = f.client_id and c.event_date is not null;

    return query
      select c.event_date, d.at_time, d.title, coalesce(d.note, ''), 'schedule', null::integer
        from public.day_schedule d
        join public.clients c on c.id = d.client_id
       where d.client_id = f.client_id
         and c.event_date is not null;

    /* The year before: the open, dated tasks the producer shares with them.
       Nothing marked private reaches a calendar the couple can read. */
    return query
      select t.due_on, null::time, t.title, '', 'task', t.remind_days::integer
        from public.tasks t
       where t.client_id = f.client_id
         and t.visible_to_client
         and t.due_on is not null
         and not t.done;
  end if;
end $$;

revoke all on function public.calendar_by_token(text) from public;
grant execute on function public.calendar_by_token(text) to anon, authenticated, service_role;
