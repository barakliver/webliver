-- ============================================================================
--  0008 — the running order for the day itself
-- ============================================================================
--  A wedding day is not one timeline. The couple spend the morning apart and
--  their hours look nothing alike: one is at hair and makeup while the other
--  is collecting suits. Holding that in a single list forces every line to
--  explain who it is for, and the two people who need it most end up reading
--  around each other's entries.
--
--  So a day has three tracks: what is shared, and one for each partner. The
--  labels are the couple's own words, because "bride" and "groom" do not fit
--  every event this app will be asked to run.
-- ============================================================================

do $$ begin
  create type day_track as enum ('shared','partner_a','partner_b');
exception when duplicate_object then null; end $$;

alter table public.clients
  add column if not exists track_a_label text not null default 'לוז כלה',
  add column if not exists track_b_label text not null default 'לוז חתן';

create table if not exists public.day_schedule (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  track      day_track not null default 'shared',
  at_time    time not null,
  title      text not null,
  note       text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists day_schedule_client_idx
  on public.day_schedule(client_id, track, at_time);

alter table public.day_schedule enable row level security;

-- both sides build this together, the same way they build the checklist
drop policy if exists day_schedule_all on public.day_schedule;
create policy day_schedule_all on public.day_schedule for all
  using (public.can_read_client(client_id))
  with check (public.can_read_client(client_id));

-- ── the labels belong to the couple, the rest of the row does not ───────────
--  clients_write is producer-only for good reason: the row carries the date,
--  the venue and whether the budget is visible. But the two track labels are
--  the couple's own words for their own morning, and row level security has
--  no column granularity to express that. A narrow function does: it checks
--  the same read rule as everything else and touches nothing but the labels.
create or replace function public.set_day_track_labels(
  p_client uuid,
  p_a      text,
  p_b      text
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_read_client(p_client) then
    raise exception 'not your event';
  end if;

  update public.clients
     set track_a_label = coalesce(nullif(btrim(left(p_a, 40)), ''), track_a_label),
         track_b_label = coalesce(nullif(btrim(left(p_b, 40)), ''), track_b_label)
   where id = p_client;

  return true;
end $$;

revoke all on function public.set_day_track_labels(uuid, text, text) from public;
grant execute on function public.set_day_track_labels(uuid, text, text) to authenticated;
