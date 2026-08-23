'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Email + password sign-in. The session is written to cookies by the Supabase
 * browser client, and the edge middleware refreshes it from there on.
 */
export default function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setError(
          error.message.toLowerCase().includes('invalid')
            ? 'המייל או הסיסמה אינם נכונים.'
            : error.message,
        );
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError('לא הצלחנו להתחבר. נסו שוב.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <div>
        <label htmlFor="email">אימייל</label>
        <input id="email" type="email" dir="ltr" autoComplete="email" required
          value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label htmlFor="password">סיסמה</label>
        <input id="password" type="password" autoComplete="current-password" required
          value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <div className="alert alert-err" role="alert">{error}</div>}
      <button className="btn btn-gold" type="submit" disabled={busy}>
        {busy ? 'מתחבר…' : 'כניסה'}
      </button>
    </form>
  );
}
