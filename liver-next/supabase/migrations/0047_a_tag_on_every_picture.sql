-- ============================================================================
--  0047 — a tag on every picture
-- ============================================================================
--  The shared folder took photographs from the first day and showed them as
--  one grid. By the third site visit that grid is sixty pictures with no
--  order: the hall, the florist's samples, a screenshot of somebody else's
--  wedding, a supplier's price list photographed off a desk. Four words sort
--  all of it, and the same four words are what the producer says out loud
--  when asked what a picture is.
--
--  A column rather than a table. A file has one tag or none; a join table
--  would let it have three, and then the question "where is the picture of
--  the hall" has three answers.
-- ============================================================================

alter table public.client_files add column if not exists tag text not null default '';

do $$ begin
  alter table public.client_files add constraint client_files_tag_known
    check (tag in ('', 'venue', 'design', 'inspiration', 'vendors'));
exception when duplicate_object then null; end $$;

comment on column public.client_files.tag is
  'One of venue, design, inspiration, vendors, or empty. The keys are fixed; '
  'the words for them live in src/content/site.ts.';

/* The tag is the second thing worth changing after the fact, next to the
   note. The provenance trigger from 0039 lists the columns it freezes and this
   is not one of them, so the existing update policy already lets it move. */
create index if not exists client_files_tag_idx
  on public.client_files (client_id, tag);
