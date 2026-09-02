'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { findInvite } from '@/app/actions/guestSite';

/**
 * The reply box on the guests' page.
 *
 * A guest arrives from a group message with no link of their own. They type
 * the number the invitation was sent to, and the page takes them to the
 * personal reply that already exists for them - the same screen the couple's
 * individual link opens. Nothing is created here; it is a lookup, and every
 * failure names what to do next rather than describing what went wrong.
 */
export function FindInvite({ token, c }: {
  token: string;
  c: { phone: string; find: string; finding: string; notFound: string; tooMany: string; bad: string };
}) {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    start(async () => {
      const r = await findInvite(token, phone);
      if (r.ok) { router.push(`/rsvp/${r.token}`); return; }
      setError(r.reason === 'tooMany' ? c.tooMany : r.reason === 'bad' ? c.bad : c.notFound);
    });
  };

  return (
    <form onSubmit={submit} noValidate>
      <label className="label" htmlFor="guest-phone">{c.phone}</label>
      <div className="flex flex-wrap gap-2">
        <input
          id="guest-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="field min-w-[200px] flex-1"
          placeholder="050-000-0000"
        />
        <button type="submit" className="btn-primary" disabled={pending || phone.trim().length < 7}>
          <Search size={16} strokeWidth={1.5} aria-hidden />
          {pending ? c.finding : c.find}
        </button>
      </div>
      {error && <p role="alert" className="mt-3 text-[14px] text-bad">{error}</p>}
    </form>
  );
}
