-- ============================================================================
--  0036 — a new event could not be read back, so it could not be created
-- ============================================================================
--  The symptom: "אין לך הרשאה לפעולה הזאת" on opening an event, for the
--  account that owns the workspace, whose producer is approved, and whose
--  every condition in clients_write evaluates true. Asked directly, in the
--  same request and under the same session, the database agreed:
--
--      uid=48505dc7-…  owns=true  approved=true  root=true
--
--  Which means the row passed the write policy. The refusal was on the way
--  back out.
--
--  The app inserts and asks for the new id in one statement, so PostgreSQL
--  runs `insert into clients (…) returning id`. A RETURNING clause makes the
--  table's SELECT policy apply to the row being inserted, and clients_read was
--
--      using (public.can_read_client(id))
--
--  which answers by looking the row up in public.clients. That function is
--  STABLE, so it sees the snapshot taken when the statement began — a snapshot
--  from before the row existed. It looks for the new event, does not find it,
--  and says no. Postgres then raises the USING-expression form of 42501, whose
--  message is a row level security violation like any other.
--
--  So the policy was asking "may this account read a row with this id", when
--  the only question a new row can answer is "may this account read a row with
--  these columns". The fix is to ask that instead: the producer_id is right
--  there on the row, and owns_producer() reads public.producers, a table the
--  statement is not inserting into.
--
--  Why it worked before and stopped: until 0030, can_read_client() opened with
--  `is_super_admin() or …`, which short-circuited to true for the root account
--  and never reached the lookup. Removing the master key was correct and
--  stands. It simply also removed the only reason this ever returned true.
--
--  Replaces two policies and adds one function. No data is touched, and it is
--  safe to run more than once.
-- ============================================================================


-- The half of can_read_client() that is about the couple, on its own, so both
-- the row-based and the column-based policy can use the same words for it.
create or replace function public.is_authorized_on_client(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.client_authorized_emails e
      join public.profiles p on p.id = auth.uid()
     where e.client_id = cid
       and (e.email = lower(p.email) or e.profile_id = p.id)
  )
$$;

comment on function public.is_authorized_on_client(uuid) is
  'Whether the signed-in account is one of the addresses invited to this '
  'workspace. Reads client_authorized_emails, never public.clients, so it is '
  'safe to evaluate against a row that is still being inserted.';


-- ── the read, stated in the row''s own columns ──────────────────────────────
--  producer_id is on the row. A couple''s invitation is not, so that branch
--  still needs the id — but a couple never inserts a workspace, so it is never
--  reached with a row the snapshot cannot see.
drop policy if exists clients_read on public.clients;
create policy clients_read on public.clients for select
  using (
    public.owns_producer(producer_id)
    or public.is_authorized_on_client(id)
  );

--  Restated the same way. The write side already tested owns_producer() in its
--  WITH CHECK; using it on both sides removes the lookup from the UPDATE and
--  DELETE paths too, and says plainly what was already true: a couple is not an
--  approved producer, so this policy was never about them.
drop policy if exists clients_write on public.clients;
create policy clients_write on public.clients for all
  using      (public.owns_producer(producer_id) and public.is_approved_producer())
  with check (public.owns_producer(producer_id) and public.is_approved_producer());


-- ── and the shared helper, kept as one truth ────────────────────────────────
--  Every other workspace table calls this with a client_id whose row already
--  exists, where the lookup is correct and necessary. Rewritten in terms of the
--  two pieces above so the rule cannot drift between here and the policy on
--  public.clients.
create or replace function public.can_read_client(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.owns_producer(public.producer_of_client(cid))
      or public.is_authorized_on_client(cid)
$$;
