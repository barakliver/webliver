'use client';

import { useState } from 'react';
import { submitRsvp } from '@/app/actions/workspace';
import type { MealPreference, RsvpPayload } from '@/lib/supabase/database.types';

/**
 * Guest-facing RSVP.
 *
 * Declining is not a dead end: it opens the digital gifting panel with direct
 * PayBox / Bit / card links and a blessing box, which is the point of the flow
 * — a guest who cannot attend still participates.
 */

const MEALS: { key: MealPreference; he: string; icon: string }[] = [
  { key: 'regular', he: 'רגיל', icon: '🍽' },
  { key: 'vegetarian', he: 'צמחוני', icon: '🥗' },
  { key: 'vegan', he: 'טבעוני', icon: '🌱' },
  { key: 'gluten_free', he: 'ללא גלוטן', icon: '🌾' },
  { key: 'kosher', he: 'כשר', icon: '✡️' },
  { key: 'child', he: 'מנת ילדים', icon: '🧒' },
];

type Choice = 'attending' | 'declined' | 'maybe';

export default function RsvpGuestForm({ token, payload }: { token: string; payload: RsvpPayload }) {
  const { guest, event, gifts } = payload;

  const [choice, setChoice] = useState<Choice | null>(
    guest.status === 'pending' ? null : (guest.status as Choice),
  );
  const [partySize, setPartySize] = useState(Math.max(1, guest.party_size || 1));
  const [meal, setMeal] = useState<MealPreference>(guest.meal_preference);
  const [allergies, setAllergies] = useState(guest.allergies ?? '');
  const [blessing, setBlessing] = useState(guest.blessing ?? '');
  const [giftMethod, setGiftMethod] = useState<'paybox' | 'bit' | 'card' | 'none' | null>(
    guest.gift_method ?? null,
  );
  const [wantsGift, setWantsGift] = useState(Boolean(guest.gift_method && guest.gift_method !== 'none'));
  const [saved, setSaved] = useState(Boolean(guest.responded_at));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const giftLinks = [
    { key: 'paybox' as const, he: 'PayBox', url: gifts.paybox, icon: '💸' },
    { key: 'bit' as const, he: 'ביט', url: gifts.bit, icon: '📲' },
    { key: 'card' as const, he: 'כרטיס אשראי', url: gifts.card, icon: '💳' },
  ].filter((link) => Boolean(link.url));

  const showGifts = choice === 'declined' || wantsGift;

  async function save() {
    if (!choice) return;
    setBusy(true);
    setError(null);
    const result = await submitRsvp({
      token,
      status: choice,
      party_size: choice === 'declined' ? 0 : partySize,
      meal_preference: choice === 'declined' ? undefined : meal,
      allergies: allergies.trim() || undefined,
      gift_method: giftMethod ?? undefined,
      blessing: blessing.trim() || undefined,
    });
    setBusy(false);
    if (!result.ok) setError(result.error ?? 'לא הצלחנו לשמור. נסו שוב.');
    else setSaved(true);
  }

  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: '28px 18px 60px' }}>
      <header style={{ textAlign: 'center', marginBottom: 22 }}>
        <p className="muted small" style={{ letterSpacing: '.2em', textTransform: 'uppercase' }}>
          הזמנה אישית
        </p>
        <h1 className="serif" style={{ fontSize: 30, marginTop: 6 }}>
          {event.display_name}
        </h1>
        <p className="muted">
          {event.event_date ? new Date(event.event_date).toLocaleDateString('he-IL', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }) : ''}
          {event.venue_name || event.venue ? ` · ${event.venue_name ?? event.venue}` : ''}
        </p>
        {event.venue_address && <p className="muted small">{event.venue_address}</p>}
      </header>

      <div className="card stack">
        <div>
          <p className="small muted">שלום</p>
          <h2 className="serif" style={{ fontSize: 22 }}>
            {guest.full_name}
          </h2>
        </div>

        {saved && (
          <div className="alert alert-ok" role="status">
            ✓ התשובה נשמרה. תודה!{' '}
            {choice === 'attending' && `נתראה — ${partySize} מקומות שמורים.`}
          </div>
        )}

        <fieldset style={{ border: 'none' }}>
          <legend style={{ fontWeight: 700, marginBottom: 8 }}>האם תגיעו?</legend>
          <div className="row">
            {(
              [
                { key: 'attending', he: '✓ מגיעים', cls: 'btn-gold' },
                { key: 'maybe', he: 'עדיין לא בטוח', cls: 'btn-ghost' },
                { key: 'declined', he: 'לא נוכל להגיע', cls: 'btn-ghost' },
              ] as const
            ).map((option) => (
              <button
                key={option.key}
                type="button"
                className={`btn btn-sm ${choice === option.key ? 'btn-dark' : option.cls}`}
                aria-pressed={choice === option.key}
                onClick={() => {
                  setChoice(option.key);
                  setSaved(false);
                }}
              >
                {option.he}
              </button>
            ))}
          </div>
        </fieldset>

        {choice === 'attending' || choice === 'maybe' ? (
          <>
            <div>
              <label htmlFor="rsvp-size">כמה תגיעו?</label>
              <input
                id="rsvp-size"
                type="number"
                min={1}
                max={20}
                value={partySize}
                onChange={(e) => setPartySize(Number(e.target.value))}
              />
            </div>

            <fieldset style={{ border: 'none' }}>
              <legend style={{ fontWeight: 700, marginBottom: 8 }}>העדפת מנה</legend>
              <div className="row">
                {MEALS.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    className="chip"
                    aria-pressed={meal === m.key}
                    onClick={() => setMeal(m.key)}
                  >
                    {m.icon} {m.he}
                  </button>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="rsvp-allergies">אלרגיות או הערות למטבח (רשות)</label>
              <input
                id="rsvp-allergies"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                maxLength={200}
              />
            </div>

            {giftLinks.length > 0 && !wantsGift && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setWantsGift(true)}
              >
                🎁 רוצים לשלוח מתנה דיגיטלית?
              </button>
            )}
          </>
        ) : null}

        {choice === 'declined' && (
          <div className="alert" style={{ background: '#faf7f0', borderInlineStart: '3px solid var(--gold)' }}>
            חבל שלא תוכלו להגיע — נשמח אם תשאירו ברכה, ואם תרצו, גם מתנה דיגיטלית.
          </div>
        )}

        {showGifts && (
          <div className="stack">
            {gifts.message && <p className="small">{gifts.message}</p>}

            {giftLinks.length > 0 ? (
              <>
                <label>מתנה דיגיטלית</label>
                <div className="row">
                  {giftLinks.map((link) => (
                    <a
                      key={link.key}
                      className={`btn btn-sm ${giftMethod === link.key ? 'btn-dark' : 'btn-ghost'}`}
                      href={link.url ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setGiftMethod(link.key)}
                    >
                      {link.icon} {link.he}
                    </a>
                  ))}
                </div>
                <p className="muted small">
                  ההעברה מתבצעת באפליקציה של הבנק או של PayBox — אנחנו לא מקבלים פרטי אשראי.
                </p>
              </>
            ) : (
              <p className="muted small">הזוג עדיין לא הגדיר אמצעי למתנה דיגיטלית.</p>
            )}

            <div>
              <label htmlFor="rsvp-blessing">ברכה לזוג</label>
              <textarea
                id="rsvp-blessing"
                rows={3}
                maxLength={1000}
                value={blessing}
                onChange={(e) => setBlessing(e.target.value)}
                placeholder="מזל טוב! שיהיה רק אושר…"
              />
            </div>
          </div>
        )}

        {error && (
          <div className="alert alert-err" role="alert">
            {error}
          </div>
        )}

        <button
          type="button"
          className="btn btn-gold"
          onClick={() => void save()}
          disabled={!choice || busy}
        >
          {busy ? 'שומר…' : saved ? 'עדכון התשובה' : 'שליחת התשובה'}
        </button>
      </div>
    </main>
  );
}
