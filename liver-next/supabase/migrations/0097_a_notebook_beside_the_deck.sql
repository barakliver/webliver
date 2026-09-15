-- ============================================================================
--  0097 — a notebook beside the deck
-- ============================================================================
--  0096 shipped the game saying, in its own rules screen, "המשחק לא שומר כלום"
--  and then telling the couple to write things down somewhere else. That is a
--  gap dressed up as a principle: half the deck is a real decision about the
--  evening — the hall, the catering, whether there is a dress code — and a
--  couple who agrees on twenty of them across an evening and has nowhere to
--  put the answers has had a nice conversation and kept none of it.
--
--  So: one note per card, per person. Not a free diary, on purpose. A note
--  that belongs to a card is a note that still means something in March, and
--  it puts a hard ceiling on the table: seventy-four cards times two sides is
--  a hundred and forty-eight rows per wedding and there is no way to write the
--  hundred and forty-ninth. An anonymous endpoint with an unbounded table
--  behind it is a different kind of object.
--
--  **The table has row level security on and not one policy.** That is the
--  whole access design and it is deliberate. No producer reads these, the
--  platform owner does not read these, and nothing reaches them except the
--  three security-definer functions below, each of which demands the game's
--  own token. These are two people writing to themselves in the middle of
--  planning a wedding; "the producer can see what you wrote" is not a feature
--  anybody asked for and is the kind of thing that is discovered rather than
--  announced. If he ever wants a couple's answers in their file, that is a
--  thing the couple presses a button to send, and it is a different migration.
--
--  The token is the credential, as it is for the game itself and for the
--  guests' page in 0045. A shut game answers nobody, so closing the game also
--  closes the notebook — which is right, and is why every function re-checks
--  `game_on` rather than trusting that the caller got the token honestly.
-- ============================================================================


-- ── the notes ───────────────────────────────────────────────────────────────
--  Constraints inline rather than as later ALTERs: this table is created
--  empty, so there is nothing for them to be `not valid` against, and a
--  constraint written into the CREATE cannot be re-validated against live rows
--  on a later replay of this file.
create table if not exists public.game_notes (
  client_id  uuid        not null references public.clients(id) on delete cascade,
  side       text        not null check (side in ('a', 'b')),
  card_id    integer     not null check (card_id between 1 and 500),
  body       text        not null check (char_length(body) <= 600),
  updated_at timestamptz not null default now(),
  primary key (client_id, side, card_id)
);

comment on table public.game_notes is
  'What a couple wrote to themselves while playing. Read and written only '
  'through the three token functions below; no policy grants access to anyone.';

alter table public.game_notes enable row level security;

/* Stated rather than implied. A reader coming to this table later will look
   for the policy that is missing and should find this instead. */
comment on column public.game_notes.side is
  'Which of the two players wrote it. A note is never shown to the other side.';


-- ── the door: one wedding's open game, by its token ─────────────────────────
--  Every function below narrows through this, so the rule about a shut game
--  is written once.
create or replace function public.game_client(p_token text)
returns uuid
language sql stable security definer set search_path = public as $$
  select c.id
    from public.clients c
   where c.game_token = p_token
     and c.game_on
     and c.archived_at is null
   limit 1
$$;


-- ── reading your own notes ──────────────────────────────────────────────────
--  One side's notes and never the other's. The two of them are sitting in the
--  same room and can read each other's screens all they like; what this stops
--  is one person's device quietly holding the other's answers.
create or replace function public.game_notes_of(p_token text, p_side text)
returns table (card_id integer, body text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select n.card_id, n.body, n.updated_at
    from public.game_notes n
   where n.client_id = public.game_client(p_token)
     and n.side = p_side
   order by n.card_id
$$;


-- ── writing one ─────────────────────────────────────────────────────────────
--  An upsert keyed on the card, so a person editing the same note twenty times
--  leaves one row. An empty body deletes rather than storing a blank, because
--  clearing the box is how somebody says "never mind" and a blank note in the
--  notebook list is a bug the couple has to tidy up by hand.
--
--  Returns the number of rows the notebook now holds, so the screen can say
--  whether the write landed without reading the whole thing back.
create or replace function public.game_note_write(
  p_token text, p_side text, p_card integer, p_body text
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  cid  uuid := public.game_client(p_token);
  text_in text := btrim(coalesce(p_body, ''));
begin
  if cid is null then
    raise exception 'this game is not open' using errcode = 'no_data_found';
  end if;
  if p_side not in ('a', 'b') then
    raise exception 'unknown side' using errcode = 'check_violation';
  end if;

  if text_in = '' then
    delete from public.game_notes
     where client_id = cid and side = p_side and card_id = p_card;
  else
    insert into public.game_notes (client_id, side, card_id, body, updated_at)
    values (cid, p_side, p_card, left(text_in, 600), now())
    on conflict (client_id, side, card_id)
      do update set body = excluded.body, updated_at = now();
  end if;

  return (select count(*)::int from public.game_notes
           where client_id = cid and side = p_side);
end $$;

comment on function public.game_note_write(text, text, integer, text) is
  'Upsert keyed on the card, so the table can never hold more than one row '
  'per card per side. Clearing the box deletes the note rather than storing '
  'an empty one.';
