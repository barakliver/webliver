-- ============================================================================
--  0053 — the flags are for people who signed in
-- ============================================================================
--  The comment above this policy has always said "everyone signed in reads
--  them". The policy said `using (true)` with no role, which is everyone,
--  full stop: a stranger holding the publishable key — and that key is in
--  every browser that has ever loaded the site — could read the list of
--  modules and which kind of couple may open each one.
--
--  That is configuration rather than anybody's wedding, so this is a tidy
--  rather than an incident. It is worth doing anyway, for the reason the
--  mismatch existed at all: nobody had a way to see it. `check-rls.mjs` reads
--  every policy in this directory and refuses one open to strangers on a table
--  that is not on a short list of deliberately public ones, and this is the
--  single thing it found across thirty-eight tables and a hundred policies.
--
--  Nothing reads these outside the root console, which is server-side, so the
--  narrower rule changes no behaviour. The intent and the code now agree,
--  which is the part that keeps being the difference between a system that is
--  safe and a system that is only believed to be.
-- ============================================================================

drop policy if exists feature_flags_read on public.feature_flags;
create policy feature_flags_read on public.feature_flags
  for select to authenticated using (true);

comment on table public.feature_flags is
  'Which modules each kind of couple may open. A missing row means open to '
  'everyone: a feature must be switched off deliberately, never by having been '
  'forgotten here. Readable by anybody signed in, which is what the policy '
  'always said it was and, until 0053, not what it did.';
