-- ============================================================================
--  0068 — the producer writes the questions
-- ============================================================================
--  The four meetings in 0042 are Barak's four. They are compiled in, which
--  means a producer who runs their first call differently, or who runs a fifth
--  meeting nobody here thought of, has no form for it and writes it up in
--  WhatsApp — which is the conversation the meeting log exists to end.
--
--  So: a table of a producer's own meeting templates. Name, when it happens,
--  and the questions, in sections, in the order they come up in the room. The
--  shape of `sections` is exactly the shape the compiled-in ones have, so the
--  drawer that renders one renders the other and nothing on the screen knows
--  which kind it got.
--
--  A log written from one of these keeps a pointer to it. The template is
--  archived rather than deleted once a log points at it, because the answers
--  are keyed by the template's question ids and a log whose questions are
--  gone is a list of numbers with no labels. Fenced on the line after it is
--  created, the rule this schema learned in 0061.
-- ============================================================================

create table if not exists public.meeting_templates (
  id          uuid primary key default gen_random_uuid(),
  producer_id uuid not null references public.producers(id) on delete cascade,
  name        text not null,
  /* When it happens, said the way a producer says it: 'לפני שסוגרים',
     'חודש לפני'. Free text, shown under the button. */
  when_text   text not null default '',
  /* Days from the wedding, negative before. Null means it is not on the
     timeline at all, which is right for a first call. */
  offset_days integer,
  blurb       text not null default '',
  /* [{ "title": "…", "fields": [{ "id": "q1", "label": "…", "kind": "text",
     "options": [...], "hint": "…" }] }]. Same shape as content/meetings.ts;
     the application cleans it on the way in and on the way out. */
  sections    jsonb not null default '[]'::jsonb,
  sort_order  integer not null default 0,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.meeting_templates enable row level security;

do $$ begin
  alter table public.meeting_templates add constraint meeting_templates_name_len
    check (char_length(btrim(name)) between 1 and 120);
  alter table public.meeting_templates add constraint meeting_templates_when_len
    check (char_length(when_text) <= 120);
  alter table public.meeting_templates add constraint meeting_templates_blurb_len
    check (char_length(blurb) <= 400);
  alter table public.meeting_templates add constraint meeting_templates_sections
    check (jsonb_typeof(sections) = 'array' and jsonb_array_length(sections) <= 40);
  alter table public.meeting_templates add constraint meeting_templates_offset
    check (offset_days is null or (offset_days between -1825 and 1825));
exception when duplicate_object then null; end $$;

create index if not exists meeting_templates_producer_idx
  on public.meeting_templates (producer_id, sort_order, created_at);

/* The producer's own, and nobody else's. Same policy the workflow templates
   have: reading needs ownership, writing needs an approved producer too. */
drop policy if exists meeting_templates_all on public.meeting_templates;
create policy meeting_templates_all on public.meeting_templates for all
  using      (public.owns_producer(producer_id))
  with check (public.owns_producer(producer_id) and public.is_approved_producer());

grant all on public.meeting_templates to authenticated, service_role;

/* updated_at is written by the database, the way the logs' is. The function
   already exists from 0042 and does exactly this one thing. */
drop trigger if exists meeting_templates_stamped on public.meeting_templates;
create trigger meeting_templates_stamped before insert or update on public.meeting_templates
  for each row execute function public.stamp_meeting_log();

-- ── a log remembers which questions it answered ────────────────────────────
alter table public.meeting_logs
  add column if not exists template_id uuid references public.meeting_templates(id) on delete set null;

create index if not exists meeting_logs_template_idx
  on public.meeting_logs (template_id) where template_id is not null;

/* Two kinds join the four: 'intro' is the first call, compiled in like the
   others; 'custom' is a log written from a producer's own template, and the
   pointer above says which. Dropping and recreating the check touches no
   row: every kind already stored is still on the list. */
alter table public.meeting_logs drop constraint if exists meeting_kind;
alter table public.meeting_logs add constraint meeting_kind
  check (kind in ('production', 'tasting', 'venue', 'design', 'intro', 'custom', 'other'));

-- ── comments ───────────────────────────────────────────────────────────────
comment on table public.meeting_templates is
  'A producer''s own meeting forms: the questions they ask, in sections, in '
  'the order they come up. Archived rather than deleted once a log points at '
  'one, because the log''s answers are keyed by these questions.';

comment on column public.meeting_logs.template_id is
  'For kind=custom, the producer template this log was written from. Null for '
  'the compiled-in kinds.';
