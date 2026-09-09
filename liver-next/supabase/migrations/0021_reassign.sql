-- ============================================================================
--  0021 — the root admin can hand an event to another producer
-- ============================================================================
--  clients_write reads as though the super admin can do anything, because its
--  USING clause says so. Its WITH CHECK does not:
--
--      using      (can_read_client(id) and is_approved_producer())
--      with check (owns_producer(producer_id) and is_approved_producer())
--
--  owns_producer() has no super-admin clause — deliberately, since it answers
--  "is this yours", and the honest answer for the root account is usually no.
--  So the root admin could read every event and edit the ones already theirs,
--  and the single operation the admin screen exists for, moving an event to
--  somebody else, failed with "new row violates row-level security policy".
--
--  Found by trying it rather than by reading the policy, which had looked
--  right twice.
--
--  The producer's own rule is untouched: they may only put an event under a
--  producer they own, and only while approved. The super admin is added as a
--  separate branch rather than by loosening owns_producer(), which is used in
--  a dozen other policies where "is this yours" is exactly the question.
-- ============================================================================

drop policy if exists clients_write on public.clients;
create policy clients_write on public.clients for all
  using (
    (public.can_read_client(id) and public.is_approved_producer())
    or public.is_super_admin()
  )
  with check (
    (public.owns_producer(producer_id) and public.is_approved_producer())
    or public.is_super_admin()
  );
