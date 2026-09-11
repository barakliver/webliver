-- ============================================================================
--  0080 — a blank page, for writing on during the meeting
-- ============================================================================
--  He used the platform in a real meeting for the first time and asked for the
--  one thing it did not have: a page you open and write on. Everything here
--  asked a question first. Which kind of meeting is this, then twenty fields
--  in the order the conversation usually goes — which is worth a great deal
--  when the conversation goes that way, and is a wall when somebody is sitting
--  opposite you talking.
--
--  A blank page is not a new kind of thing. It is a meeting log with no
--  questions: the body goes in the same `summary` the templated ones write
--  their record into, so it is kept by the same version trigger, fenced by the
--  same policies, shared with the couple by the same switch, and listed
--  beside the rest. One kind added to the check, and nothing else in the
--  schema changes.
--
--  Nothing here touches a row.
-- ============================================================================

alter table public.meeting_logs drop constraint if exists meeting_kind;
alter table public.meeting_logs add constraint meeting_kind
  check (kind in ('production', 'tasting', 'venue', 'design', 'intro', 'custom', 'note', 'other'));

comment on column public.meeting_logs.kind is
  'Which questions this log answered. ''custom'' points at one of the '
  'producer''s own templates through template_id; ''note'' answered none at '
  'all and is a page somebody wrote on during the meeting, body and all in '
  'summary.';
