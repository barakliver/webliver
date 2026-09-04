-- ============================================================================
--  0052 — the enquiry survives becoming an event
-- ============================================================================
--  A lead carries the phone number, the address, what the couple wrote, and
--  where they came from. Converting it built an event out of the name, the
--  kind, the date, the guest count and the location — and dropped the rest.
--
--  The comment above that code said "everything already gathered travels
--  across", which was not true and had not been true for as long as the
--  function existed. What it cost is small and constant: the producer converts
--  an enquiry, then goes back to the leads screen to find the phone number of
--  the couple whose event they are now standing in.
--
--  Five columns, and the last of them is the one that matters most. `lead_id`
--  is the join that makes a question answerable that could not be asked
--  before: how many enquiries became events, from which source, and how long
--  it took. Without it the two tables are strangers and the funnel on the
--  insights screen stops at the lead.
--
--  Nothing is destroyed and nothing is moved. The lead keeps its own copy of
--  everything; these are the event's, and the producer edits them there as the
--  facts change without rewriting history on the enquiry.
-- ============================================================================

alter table public.clients add column if not exists contact_email text not null default '';
alter table public.clients add column if not exists contact_phone text not null default '';
alter table public.clients add column if not exists brief         text not null default '';
alter table public.clients add column if not exists source        text not null default '';
alter table public.clients add column if not exists lead_id       uuid;

do $$ begin
  alter table public.clients
    add constraint clients_lead_fk foreign key (lead_id)
    references public.leads(id) on delete set null;
exception when duplicate_object then null; end $$;

/* Lengths that match the columns these are copied from, so a value that fits
   on the lead cannot fail to fit on the event it becomes. */
do $$ begin
  alter table public.clients add constraint clients_contact_email_len check (char_length(contact_email) <= 200);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.clients add constraint clients_contact_phone_len check (char_length(contact_phone) <= 40);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.clients add constraint clients_brief_len check (char_length(brief) <= 4000);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.clients add constraint clients_source_len check (char_length(source) <= 60);
exception when duplicate_object then null; end $$;

comment on column public.clients.contact_email is
  'How to reach the couple, from the enquiry. Not the same as client_users, '
  'which is who may sign in: a couple has a phone number long before either '
  'of them has an account, and the producer needs it on the file either way.';
comment on column public.clients.contact_phone is
  'The number the producer actually calls. Carried from the lead.';
comment on column public.clients.brief is
  'What the couple wrote when they enquired, kept verbatim. It is the only '
  'thing on the file in their own words.';
comment on column public.clients.source is
  'Where the business came from, carried from the lead so the answer survives '
  'the enquiry being marked won.';
comment on column public.clients.lead_id is
  'The enquiry this event grew out of, when there was one. Null for an event '
  'the producer opened directly, which is a real and common case rather than '
  'missing data.';

/* Answering "how many enquiries became events" means scanning clients by
   lead, and the funnel does it per producer per period. */
create index if not exists clients_lead_idx on public.clients(lead_id) where lead_id is not null;

-- ── the ingest functions gain nothing here ──────────────────────────────────
-- The three public lead RPCs are untouched on purpose. These columns live on
-- the event, and an event is never created by a stranger from the site.
