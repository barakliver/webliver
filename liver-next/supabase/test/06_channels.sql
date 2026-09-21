-- ============================================================================
--  A lead arrives through a channel, and lands in exactly one workspace
-- ============================================================================
--  This is the boundary the whole of 0099 exists to draw, so it is asserted
--  here rather than trusted. Before it, every webhook delivery was attributed
--  to `public_site_producer()` — root's workspace — whoever it was meant for.
--
--  Four things have to hold, and each of them was a way the old door failed:
--
--    a delivery through Keren's token lands on Keren's producer, not root's
--    it is stamped with the channel's source rather than the sender's
--    a token nobody minted stores nothing at all
--    a switched-off channel stops receiving, and root still cannot read the
--    row that says so
--
--  Run as root deliberately. Root is the platform owner and the one account
--  with something to gain from the boundary leaking; a test that proves an
--  ordinary stranger cannot read Keren's channels proves the easy half.
-- ============================================================================
\set ON_ERROR_STOP on

-- Keren opens two channels. Done as Keren, through the function a producer
-- actually presses, so the token generation and the tenant stamp are the ones
-- the screen uses rather than an insert written for the test.
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select public.new_lead_channel('אינסטגרם של קרן', 'instagram');
select public.new_lead_channel('קמפיין שנסגר', 'google_ads');
update public.lead_channels set enabled = false where label = 'קמפיין שנסגר';

-- Read out here, while Keren is the one asking. The webhook is handed the
-- token by the producer who copied it off their own screen; anon cannot read
-- the row it came from, which is the point and is asserted below.
select token as live_token from public.lead_channels where label = 'אינסטגרם של קרן' \gset
select token as off_token  from public.lead_channels where label = 'קמפיין שנסגר'   \gset

-- Parked in a setting rather than passed in directly. psql substitutes its own
-- variables into plain SQL and not into a dollar-quoted body, so the block
-- below that has to catch a refusal cannot read :'off_token' at all.
select set_config('liver.test_off_token', :'off_token', false);

-- The workspace the channel belongs to, read from the channel rather than
-- written down here. A seeded uuid would make this test a statement about the
-- seed; what it has to assert is that the lead lands wherever the channel
-- says, and never in root's.
select producer_id as chan_producer from public.lead_channels where label = 'אינסטגרם של קרן' \gset

reset role;
reset request.jwt.claim.sub;

-- Now the webhook's side of the wire: anon, holding nothing but a token.
set role anon;

select public.ingest_lead_via_channel(
  :'live_token',
  'דנה מהאינסטגרם', '0501234567', '', 'wedding', null, null,
  'ראיתי את הסטורי', 'ig-lead-1', 'תל אביב'
);

-- The same delivery again, as Meta would retry it. One lead, counted once.
select public.ingest_lead_via_channel(
  :'live_token',
  'דנה מהאינסטגרם', '0501234567', '', 'wedding', null, null,
  'ראיתי את הסטורי', 'ig-lead-1', 'תל אביב'
);

-- Anon holds a token and still cannot read the table it names.
select count(*)::int as anon_sees_channels from public.lead_channels \gset

-- A token nobody minted. The function refuses rather than storing anywhere,
-- and the refusal is caught here so the file can carry on to its verdict.
do $$
begin
  perform public.ingest_lead_via_channel(
    'deadbeefdeadbeefdeadbeefdeadbeef', 'לא אמור להישמר', '0500000000'
  );
  raise exception 'a token nobody minted was accepted';
exception
  when insufficient_privilege then null;
end $$;

-- And the channel Keren switched off.
do $$
begin
  perform public.ingest_lead_via_channel(
    current_setting('liver.test_off_token'), 'מקמפיין מושבת', '0500000001'
  );
  raise exception 'a switched-off channel accepted a delivery';
exception
  when insufficient_privilege then null;
end $$;

reset role;

-- Root reads the verdict. The counts below are root's own view of the world,
-- which is the point: the lead must be Keren's and root must not be able to
-- see the channel it came through.
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select count(*)::int as root_sees_channels from public.lead_channels \gset
reset role;
reset request.jwt.claim.sub;

select case
  when (select producer_id from public.leads where full_name = 'דנה מהאינסטגרם')
         = :'chan_producer'::uuid
   and (select producer_id from public.leads where full_name = 'דנה מהאינסטגרם')
         is distinct from public.public_site_producer()
   and (select source from public.leads where full_name = 'דנה מהאינסטגרם') = 'instagram'
   and (select count(*) from public.leads where full_name = 'לא אמור להישמר') = 0
   and (select count(*) from public.leads where full_name = 'מקמפיין מושבת') = 0
   and (select count(*) from public.leads where full_name = 'דנה מהאינסטגרם') = 1
   and (select lead_count from public.lead_channels where label = 'אינסטגרם של קרן') = 1
   and :'root_sees_channels'::int = 0
   and :'anon_sees_channels'::int = 0
  then 'PASS — a delivery lands on the channel''s own producer, is stamped with its source, is counted once across a retry, and neither root nor anon reads the channel'
  else 'FAIL — '
       || coalesce((select producer_id::text from public.leads where full_name = 'דנה מהאינסטגרם'), 'no lead')
       || ' source:' || coalesce((select source from public.leads where full_name = 'דנה מהאינסטגרם'), '-')
       || ' junk:'   || (select count(*) from public.leads where full_name in ('לא אמור להישמר','מקמפיין מושבת'))
       || ' root:'   || :'root_sees_channels'
       || ' anon:'   || :'anon_sees_channels'
       || ' tally:'  || coalesce((select lead_count::text from public.lead_channels where label = 'אינסטגרם של קרן'), '-')
       || ' wanted:' || :'chan_producer'
       || ' root_ws:' || coalesce(public.public_site_producer()::text, '-')
  end as result;
