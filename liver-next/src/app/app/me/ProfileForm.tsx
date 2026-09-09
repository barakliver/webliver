'use client';

import { useActionState, useRef, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { Camera, Trash2, Check } from 'lucide-react';
import { appCopy } from '@/content/site';
import { supabaseBrowser } from '@/lib/supabase/client';
import { saveProfile, setAvatar, type ProfileResult } from '@/app/actions/profile';
import { Avatar } from '@/components/app/Avatar';

const MAX_BYTES = 5 * 1024 * 1024;
const c = appCopy.profile;

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? c.saving : c.save}
    </button>
  );
}

export function ProfileForm({
  userId, name, email, avatarUrl,
}: {
  userId: string; name: string; email: string; avatarUrl: string | null;
}) {
  const [state, action] = useActionState<ProfileResult | null, FormData>(saveProfile, null);

  /* Shown immediately from a local object URL so the new picture appears the
     moment it is chosen, rather than after a round trip the person cannot see
     the progress of. */
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';           // picking the same file twice must still fire
    if (!file) return;

    if (!file.type.startsWith('image/')) return setError(c.notImage);
    if (file.size > MAX_BYTES) return setError(c.tooBig);
    setError(null);

    const local = URL.createObjectURL(file);
    setPreview(local);

    startTransition(async () => {
      const sb = supabaseBrowser();
      /* The folder is the account id, which is what the storage policy checks.
         The filename carries a timestamp so a replacement never serves the
         previous picture out of a CDN cache. */
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().slice(0, 5);
      const path = `${userId}/${Date.now()}.${ext}`;

      const { error: upErr } = await sb.storage
        .from('avatars')
        .upload(path, file, { cacheControl: '31536000', upsert: false });

      if (upErr) {
        setError(c.uploadFailed);
        setPreview(avatarUrl);
        URL.revokeObjectURL(local);
        return;
      }

      const { data } = sb.storage.from('avatars').getPublicUrl(path);
      const res = await setAvatar(data.publicUrl);
      if (!res.ok) { setError(res.error ?? c.uploadFailed); setPreview(avatarUrl); }
      URL.revokeObjectURL(local);
    });
  }

  function onRemove() {
    setPreview(null);
    setError(null);
    startTransition(async () => { await setAvatar(null); });
  }

  return (
    <div className="grid gap-8 sm:grid-cols-[auto_1fr] sm:gap-10">
      <section className="flex flex-col items-center gap-3">
        <Avatar name={name || email} src={preview} size={112} />

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={onPick}
          className="sr-only"
          id="avatar-file"
        />
        <label htmlFor="avatar-file" className="btn-ghost cursor-pointer text-[14px]">
          <Camera size={16} strokeWidth={1.9} aria-hidden />
          {preview ? c.replace : c.choose}
        </label>

        {preview && (
          <button type="button" onClick={onRemove} className="btn-quiet text-[13.5px]" disabled={busy}>
            <Trash2 size={15} strokeWidth={1.9} aria-hidden />
            {c.remove}
          </button>
        )}

        <p className="text-center text-[12.5px] text-ink-mute">{c.hint}</p>
        {busy && <p className="text-[13px] text-ink-soft">{c.saving}</p>}
        {error && <p role="alert" className="chip-bad">{error}</p>}
      </section>

      <form action={action} className="grid content-start gap-4">
        <div>
          <label htmlFor="full_name" className="label">{c.name}</label>
          <input
            id="full_name"
            name="full_name"
            defaultValue={name}
            required
            minLength={2}
            maxLength={80}
            className="field"
            autoComplete="name"
          />
        </div>

        <div>
          <label htmlFor="email" className="label">אימייל</label>
          <input id="email" value={email} readOnly disabled className="field opacity-60" />
          <p className="mt-1.5 text-[12.5px] text-ink-mute">
            הכניסה מבוססת על הכתובת הזו, ולכן היא לא ניתנת לשינוי כאן.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <SaveButton />
          {state?.ok && (
            <span className="chip-ok"><Check size={14} strokeWidth={2.2} aria-hidden />{c.saved}</span>
          )}
          {state?.error && <span role="alert" className="chip-bad">{state.error}</span>}
        </div>
      </form>
    </div>
  );
}
