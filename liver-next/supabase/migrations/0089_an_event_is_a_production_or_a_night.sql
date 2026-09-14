-- ============================================================================
--  0089 — an event is a production, or a night
-- ============================================================================
--  Two couples on the same list are not buying the same thing. One takes the
--  whole production — a year of suppliers, budget, meetings and decisions. The
--  other takes the evening itself: somebody who runs the night they have
--  already planned. The work, the money and the conversation are different,
--  and until now the list drew them identically, so the only way to know which
--  was which was to remember.
--
--  One column, because that is what it is: a property of the engagement, not
--  of the couple and not of the account. `account_kind` already answers a
--  different question — whether somebody has a producer at all — and reusing
--  it here would have made "a couple who plans alone" and "a couple whose
--  wedding I am running for one night" the same row.
--
--  Every event that exists today is a production: that is what the business
--  has been selling, and the default says so rather than leaving a column of
--  nulls for somebody to interpret later.
--
--  NOT VALID by the rule that cost three releases yesterday. Here the default
--  fills every existing row in the same statement, so nothing can violate it
--  and the validation below succeeds — but the rule is not "when it might
--  fail", it is "always", because the one time it is skipped is the time the
--  data turns out to be older than the rule.
--
--  Nothing here touches a row.
-- ============================================================================

alter table public.clients
  add column if not exists service text not null default 'production';

alter table public.clients drop constraint if exists clients_service;
alter table public.clients add constraint clients_service
  check (service in ('production', 'management')) not valid;

do $$
begin
  alter table public.clients validate constraint clients_service;
exception when check_violation then
  raise notice 'clients.service applies to new rows; some existing rows are outside the list and were left as they are.';
end $$;

create index if not exists clients_service_idx on public.clients (service);

comment on column public.clients.service is
  'production = the whole thing, a year of it. management = the evening itself, for a couple who planned their own. A property of the engagement, not of the account: account_kind answers whether somebody has a producer at all, which is a different question.';
