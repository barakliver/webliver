-- ============================================================================
--  0111 — the conference counts itself while people arrive
-- ============================================================================
--  The conference screen was read at the moment it was opened, and the whole
--  use of it on the day is to watch a number go up. So the two tables behind
--  it go out over the socket, the way every other live screen's do.
--
--  Realtime still applies row level security per listener, and both tables are
--  readable by the root address alone, so this hands nobody a row they could
--  not already read: a producer or a stranger listening hears nothing.
--
--  And the ceiling becomes exact. campaign_open() counts the people already in
--  and contact_upsert() writes one more, and between the two a second arrival
--  can count the same number: with fifty people scanning at once the ceiling
--  of three hundred could be three hundred and four. The write now takes a lock
--  that is one per campaign, counts again under it, and refuses past the
--  ceiling, so the number printed on the stand is a number that holds. A
--  returning person is still just updated, and is not turned away by it.
--
--  Nothing here touches a row.
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array['contacts', 'signup_campaigns'] loop
    execute format('alter table public.%I replica identity full', t);
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
exception when undefined_object then
  /* No realtime publication on this database, so nothing to add them to. */
  null;
end $$;


-- ── one at a time per campaign, and counted again under the lock ────────────
create or replace function public.contact_upsert(
  p_campaign uuid, p_name text, p_phone text, p_email text,
  p_terms_version text, p_broadcast boolean, p_profile uuid
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name  text := btrim(coalesce(p_name, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_id    uuid;
  v_had   boolean;
  v_max   integer;
begin
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'נא למלא שם';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 200 then
    raise exception 'כתובת המייל לא תקינה';
  end if;
  if char_length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 7 or char_length(v_phone) > 30 then
    raise exception 'נא למלא מספר טלפון';
  end if;
  if char_length(btrim(coalesce(p_terms_version, ''))) = 0 then
    raise exception 'יש לאשר את תנאי השימוש';
  end if;

  /* Released at the end of the transaction. One campaign's arrivals queue
     behind each other for the few milliseconds a write takes; another
     campaign's do not. */
  perform pg_advisory_xact_lock(hashtext('contacts:' || p_campaign::text));

  select id, broadcast_consent into v_id, v_had
    from public.contacts
   where campaign_id = p_campaign and lower(email) = v_email;

  if v_id is null then
    select max_signups into v_max from public.signup_campaigns where id = p_campaign;
    if v_max is null or (select count(*) from public.contacts where campaign_id = p_campaign) >= v_max then
      raise exception 'that link is not active';
    end if;

    insert into public.contacts
      (campaign_id, name, phone, email, terms_version, broadcast_consent,
       broadcast_consent_at, unsubscribe_token, profile_id)
    values
      (p_campaign, v_name, v_phone, v_email, left(btrim(p_terms_version), 40), coalesce(p_broadcast, false),
       case when p_broadcast then now() end,
       case when p_broadcast then encode(gen_random_bytes(24), 'hex') end,
       p_profile)
    returning id into v_id;
    return v_id;
  end if;

  update public.contacts set
    name = v_name,
    phone = v_phone,
    terms_accepted_at = now(),
    terms_version = left(btrim(p_terms_version), 40),
    profile_id = coalesce(p_profile, profile_id),
    updated_at = now(),
    broadcast_consent = coalesce(p_broadcast, false),
    broadcast_consent_at = case
      when coalesce(p_broadcast, false) and not v_had then now()
      else broadcast_consent_at end,
    broadcast_revoked_at = case
      when coalesce(p_broadcast, false) then null
      when v_had then now()
      else broadcast_revoked_at end,
    unsubscribe_token = case
      when coalesce(p_broadcast, false) then coalesce(unsubscribe_token, encode(gen_random_bytes(24), 'hex'))
      else null end
  where id = v_id;
  return v_id;
end $$;
revoke all on function public.contact_upsert(uuid, text, text, text, text, boolean, uuid) from public, anon, authenticated;
