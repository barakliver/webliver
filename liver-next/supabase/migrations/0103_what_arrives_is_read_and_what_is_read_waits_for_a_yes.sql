-- ============================================================================
--  0103 — what arrives is read, and what is read waits for a yes
-- ============================================================================
--  A producer's day is a mailbox and a WhatsApp thread: a supplier's quote
--  as a PDF, a couple's "we moved the date", a photographer's invoice, a
--  calendar entry for a tasting. Every one of them is a change to the
--  event's file, and every one of them is typed into the file by hand, by
--  the one person whose time the product exists to save. The reading can
--  be done for them. The deciding cannot, and must not: a budget that a
--  model edits on its own is a budget nobody trusts by March.
--
--  So three tables, one for each step the brief draws. `inbox_items` is
--  what arrived, whole, with whom it was matched to and how surely.
--  `suggested_actions` is what the reading proposes, each one a kind, a
--  payload and a sentence, waiting. `activity_log` is what happened to the
--  event, in order, written always - an arrival is a fact whether or not
--  anything is done about it. And `ai_calls`, because a reading costs
--  money and a cost nobody can see is a cost that grows.
--
--  Row level security the simple way: every row carries `producer_id` and
--  the producer's policy is `owns_producer`. The couple reads nothing here
--  except the lines in `activity_log` a producer marked for them, through
--  the same `can_read_client` the rest of their screen uses. Nothing
--  touches a row that exists.
-- ============================================================================

-- ── what arrived ───────────────────────────────────────────────────────────
do $$ begin
  create type public.inbox_channel as enum ('email', 'whatsapp', 'calendar', 'upload', 'voice');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.inbox_status as enum ('new', 'processed', 'needs_review', 'ignored', 'failed');
exception when duplicate_object then null; end $$;

create table if not exists public.inbox_items (
  id               uuid primary key default gen_random_uuid(),
  producer_id      uuid not null references public.producers(id) on delete cascade,
  channel          public.inbox_channel not null,
  /* The sender's own id for the message, so a webhook that retries and a
     poll that overlaps a push cannot make two of one. */
  external_id      text,
  from_identity    text not null default '',
  from_name        text not null default '',
  subject          text not null default '',
  body_text        text not null default '',
  /* [{name, mime, path, size}] in the inbox bucket. */
  attachments      jsonb not null default '[]'::jsonb,
  received_at      timestamptz not null default now(),
  /* Who this is about. One of the three, or none and the sorting box. */
  client_id        uuid references public.clients(id) on delete set null,
  vendor_id        uuid references public.vendors(id) on delete set null,
  lead_id          uuid references public.leads(id) on delete set null,
  match_confidence text not null default '',
  match_reason     text not null default '',
  status           public.inbox_status not null default 'new',
  ai_summary       text not null default '',
  category         text not null default '',
  processed_at     timestamptz,
  error            text not null default '',
  created_at       timestamptz not null default now(),
  constraint inbox_items_text_len check (
    char_length(from_identity) <= 200 and char_length(from_name) <= 200 and char_length(subject) <= 500
    and char_length(body_text) <= 60000 and char_length(ai_summary) <= 1000 and char_length(category) <= 40
    and char_length(match_confidence) <= 10 and char_length(match_reason) <= 300 and char_length(error) <= 1000
  ),
  constraint inbox_items_confidence check (match_confidence in ('', 'high', 'medium', 'low'))
);
create unique index if not exists inbox_items_external_key
  on public.inbox_items (producer_id, channel, external_id) where external_id is not null;
create index if not exists inbox_items_status_idx on public.inbox_items (producer_id, status, received_at desc);
create index if not exists inbox_items_client_idx on public.inbox_items (client_id, received_at desc);

alter table public.inbox_items enable row level security;
drop policy if exists inbox_items_producer on public.inbox_items;
create policy inbox_items_producer on public.inbox_items for all
  using (public.owns_producer(producer_id)) with check (public.owns_producer(producer_id));

-- ── what the reading proposes ──────────────────────────────────────────────
do $$ begin
  create type public.action_kind as enum (
    'budget_add_item', 'budget_update_item', 'budget_mark_paid',
    'vendor_create', 'vendor_update',
    'task_create', 'task_complete',
    'timeline_update', 'couple_field_update', 'meeting_summary', 'reply_draft'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.action_status as enum ('pending', 'approved', 'rejected', 'applied', 'failed');
exception when duplicate_object then null; end $$;

create table if not exists public.suggested_actions (
  id            uuid primary key default gen_random_uuid(),
  producer_id   uuid not null references public.producers(id) on delete cascade,
  inbox_item_id uuid references public.inbox_items(id) on delete cascade,
  client_id     uuid references public.clients(id) on delete cascade,
  kind          public.action_kind not null,
  /* "הוסף לתקציב: צלם – 12,000 ₪". The sentence the producer reads. */
  title         text not null,
  /* The exact fields the write would use. applyAction reads only this. */
  payload       jsonb not null default '{}'::jsonb,
  /* {before, after}, for the screen. */
  diff_preview  jsonb,
  confidence    numeric(3,2),
  status        public.action_status not null default 'pending',
  decided_by    uuid references public.profiles(id) on delete set null,
  decided_at    timestamptz,
  applied_at    timestamptz,
  /* What the producer did instead, when they edited rather than approved:
     the original payload is kept and this is theirs. Food for the prompt. */
  feedback      jsonb,
  error         text not null default '',
  created_at    timestamptz not null default now(),
  constraint suggested_actions_title_len check (char_length(title) between 1 and 300),
  constraint suggested_actions_error_len check (char_length(error) <= 1000),
  constraint suggested_actions_confidence check (confidence is null or (confidence >= 0 and confidence <= 1))
);
create index if not exists suggested_actions_pending_idx on public.suggested_actions (producer_id, status, created_at desc);
create index if not exists suggested_actions_item_idx on public.suggested_actions (inbox_item_id);

alter table public.suggested_actions enable row level security;
drop policy if exists suggested_actions_producer on public.suggested_actions;
create policy suggested_actions_producer on public.suggested_actions for all
  using (public.owns_producer(producer_id)) with check (public.owns_producer(producer_id));

-- ── what happened to the event ─────────────────────────────────────────────
create table if not exists public.activity_log (
  id                uuid primary key default gen_random_uuid(),
  producer_id       uuid not null references public.producers(id) on delete cascade,
  client_id         uuid references public.clients(id) on delete cascade,
  vendor_id         uuid references public.vendors(id) on delete set null,
  /* email_in / whatsapp_in / meeting / budget_change / task_done / note / ai_action */
  kind              text not null,
  title             text not null,
  body              text not null default '',
  ref_table         text not null default '',
  ref_id            uuid,
  /* producer / couple / vendor / system */
  actor             text not null default 'system',
  /* Off by default. The couple sees a line only when the producer says
     so; the log is the producer's record first. */
  visible_to_couple boolean not null default false,
  created_at        timestamptz not null default now(),
  constraint activity_log_len check (
    char_length(kind) <= 40 and char_length(title) between 1 and 300 and char_length(body) <= 4000
    and char_length(ref_table) <= 60 and char_length(actor) <= 20
  )
);
create index if not exists activity_log_client_idx on public.activity_log (client_id, created_at desc);
create index if not exists activity_log_producer_idx on public.activity_log (producer_id, created_at desc);

alter table public.activity_log enable row level security;
drop policy if exists activity_log_producer on public.activity_log;
create policy activity_log_producer on public.activity_log for all
  using (public.owns_producer(producer_id)) with check (public.owns_producer(producer_id));
drop policy if exists activity_log_couple on public.activity_log;
create policy activity_log_couple on public.activity_log for select
  using (visible_to_couple and client_id is not null and public.can_read_client(client_id));

-- ── what a reading cost ────────────────────────────────────────────────────
create table if not exists public.ai_calls (
  id            uuid primary key default gen_random_uuid(),
  producer_id   uuid references public.producers(id) on delete set null,
  purpose       text not null,
  model         text not null default '',
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  latency_ms    integer not null default 0,
  /* In agorot, from the model's list price at the time of the call. An
     estimate, written down so the month can be added up. */
  cost_agorot   integer not null default 0,
  ok            boolean not null default true,
  error         text not null default '',
  ref_table     text not null default '',
  ref_id        uuid,
  created_at    timestamptz not null default now(),
  constraint ai_calls_len check (char_length(purpose) <= 60 and char_length(model) <= 80 and char_length(error) <= 500 and char_length(ref_table) <= 60)
);
create index if not exists ai_calls_producer_idx on public.ai_calls (producer_id, created_at desc);

alter table public.ai_calls enable row level security;
drop policy if exists ai_calls_producer on public.ai_calls;
create policy ai_calls_producer on public.ai_calls for select
  using (producer_id is not null and public.owns_producer(producer_id));

-- ── where the files go ─────────────────────────────────────────────────────
--  Private. A supplier's quote is a private document and a couple's
--  photograph more so; everything in here is read through signed URLs the
--  app mints for the producer who owns the row.
insert into storage.buckets (id, name, public)
values ('inbox', 'inbox', false)
on conflict (id) do update set public = false;

comment on table public.inbox_items is
  'Everything that arrived for a producer, whole, before anything was decided about it. Producer only.';
comment on table public.suggested_actions is
  'What a reading proposes to write, waiting for the producer. Only applyAction turns one into a row, and only after a yes.';
comment on table public.activity_log is
  'What happened to an event, in order. Written always; shown to the couple one line at a time, on purpose.';
