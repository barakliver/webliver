-- ============================================================================
--  whoami() — who the database thinks is asking
-- ============================================================================
--  Opening an event failed with "new row violates row-level security policy",
--  and the screen said "אין לך הרשאה לפעולה הזאת". Every condition in that
--  policy was true for the account: it owned the producer, the producer was
--  approved, the profile was super_admin. Checked by impersonating the user
--  in SQL, all three returned true.
--
--  The write still failed, because `auth.uid()` was null in that request. The
--  session had gone stale, reads were being carried by the middleware's
--  refresh on navigation, and the action's write was not.
--
--  A policy cannot tell those two apart, and neither could the app: "you are
--  not allowed" and "the database does not know who you are" arrive as the
--  same error code. This is how the app asks.
--
--  Deliberately NOT security definer. The whole value is that it answers as
--  the caller; a definer function would report the owner and always be
--  useful-looking and always wrong.
-- ============================================================================

create or replace function public.whoami() returns uuid
language sql stable as $$
  select auth.uid()
$$;

comment on function public.whoami() is
  'The caller''s uid as row level security sees it, or null when the session '
  'did not reach the database. Used to tell a stale session apart from a '
  'genuine refusal, which arrive as the same error.';

grant execute on function public.whoami() to anon, authenticated;
