-- Seeding roles requires being root, because the database refuses a role
-- change from anybody else. That guard firing here is itself a good sign.
-- Not SET LOCAL: this file is applied outside a transaction block.
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

-- Two independent businesses and one couple, so the boundary has something to
-- be a boundary between.
-- The producers first. The couple signs up later, below, because that is the
-- order the app creates them in and the order decides what role they get.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111','barakliver@gmail.com'),
  ('22222222-2222-2222-2222-222222222222','keren@keren-weddings.com')
on conflict (id) do nothing;

insert into public.profiles (id, email, full_name, role) values
  ('11111111-1111-1111-1111-111111111111','barakliver@gmail.com','ברק','super_admin'),
  ('22222222-2222-2222-2222-222222222222','keren@keren-weddings.com','קרן','producer')
on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;

insert into public.producers (id, owner_id, brand_name, contact_email, status) values
  ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','ברק ליור','barakliver@gmail.com','approved'),
  ('aaaaaaaa-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','קרן הפקות','keren@keren-weddings.com','approved');

-- Keren's event. Root has never touched it and must not be able to.
insert into public.clients (id, producer_id, display_name, event_date, venue) values
  ('cccccccc-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000002','נועה ואיתי','2026-11-05','אחוזת נועם');

-- Keren invites the bride, and only then does the bride sign up. Doing it the
-- other way round gives her a producer account and a placeholder workspace,
-- which is a different test and not this one.
insert into public.client_authorized_emails (client_id, email) values
  ('cccccccc-0000-0000-0000-000000000001','noa@example.com');

insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333','noa@example.com')
on conflict (id) do nothing;

insert into public.guests_rsvp (client_id, full_name, side) values
  ('cccccccc-0000-0000-0000-000000000001','דוד כהן','partner_a'),
  ('cccccccc-0000-0000-0000-000000000001','רותי לוי','partner_b');

insert into public.budget_items (client_id, category, label, estimate, agreed) values
  ('cccccccc-0000-0000-0000-000000000001','catering','קייטרינג',80000,75000);

insert into public.payments (client_id, title, amount, due_on) values
  ('cccccccc-0000-0000-0000-000000000001','מקדמה',20000,'2026-09-01');

insert into public.contracts (client_id, title, body, status) values
  ('cccccccc-0000-0000-0000-000000000001','הסכם הפקה','התנאים','sent');

insert into public.messages (client_id, author_id, body) values
  ('cccccccc-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','נדבר מחר');

insert into public.crew (client_id, name, role, fee) values
  ('cccccccc-0000-0000-0000-000000000001','דנה','הפקה',2500);

insert into public.event_vendors (client_id, name, category, status) values
  ('cccccccc-0000-0000-0000-000000000001','תאורה כהן','תאורה','booked');

insert into public.leads (producer_id, full_name, email, status, source) values
  ('aaaaaaaa-0000-0000-0000-000000000002','ליד של קרן','x@y.com','new','instagram');

insert into public.tasks (client_id, title, visible_to_client) values
  ('cccccccc-0000-0000-0000-000000000001','משימה פרטית של קרן', false);

reset request.jwt.claim.sub;
