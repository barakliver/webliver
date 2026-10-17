'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { BellRing, BellOff, Check, Moon } from 'lucide-react';
import { useCopy } from '@/components/app/CopyProvider';
import { fill } from '@/lib/copyText';
import { saveNotifyPrefs, savePushSubscription, removePushSubscription, type NotifyResult } from '@/app/actions/notify';

/**
 * Where a producer says how they want to be told.
 *
 * Two halves. The push switch asks the browser for permission and hands the
 * subscription to the server; it is the one control on this screen that
 * cannot be a plain form, because the subscription is minted by the
 * browser. Everything else is a form: the WhatsApp number the alerts go to,
 * and the hours nothing rings.
 *
 * `publicKey` is null when the server has no VAPID keys, and the switch is
 * then a sentence rather than a control: a switch for a thing the server
 * cannot do teaches somebody that switches on this screen do nothing.
 */

export type AlertPrefs = {
  whatsapp_number: string;
  push_enabled: boolean;
  quiet_start: string | null;
  quiet_end: string | null;
};

/** The VAPID public key as the browser wants it: a plain ArrayBuffer. */
function toKey(base64: string): ArrayBuffer {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i += 1) view[i] = raw.charCodeAt(i);
  return buf;
}

function Save() {
  const c = useCopy().alerts;
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-primary" disabled={pending}>{pending ? c.saving : c.save}</button>;
}

function PushSwitch({ publicKey, phones }: { publicKey: string | null; phones: number }) {
  const c = useCopy().alerts.push;
  const [state, setState] = useState<'unknown' | 'unsupported' | 'blocked' | 'off' | 'on'>('unknown');
  const [busy, start] = useTransition();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') { setState('blocked'); return; }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? 'on' : 'off'))
      .catch(() => setState('off'));
  }, []);

  const turnOn = () => start(async () => {
    setError('');
    if (!publicKey) return;
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setState(perm === 'denied' ? 'blocked' : 'off'); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) });
      const form = new FormData();
      form.set('subscription', JSON.stringify(sub.toJSON()));
      form.set('user_agent', navigator.userAgent);
      const r = await savePushSubscription(form);
      if (!r.ok) { setError(r.error); await sub.unsubscribe(); return; }
      setState('on');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  });

  const turnOff = () => start(async () => {
    setError('');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const form = new FormData();
        form.set('endpoint', sub.endpoint);
        await removePushSubscription(form);
        await sub.unsubscribe();
      }
      setState('off');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  });

  const Icon = state === 'on' ? BellRing : BellOff;
  const line =
    !publicKey ? c.notConfigured
    : state === 'unsupported' ? c.unsupported
    : state === 'blocked' ? c.blocked
    : state === 'on' ? c.on
    : c.off;

  return (
    <div className="flex items-start gap-3">
      <span className={`grid size-10 shrink-0 place-items-center rounded-full ${state === 'on' ? 'bg-ok-wash text-ok' : 'bg-surface-200 text-ink-mute'}`}>
        <Icon size={19} strokeWidth={1.5} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-lead font-medium text-ink">{c.title}</p>
        <p className="text-body text-ink-soft">{line}</p>
        {phones > 0 && <p className="mt-1 text-meta text-ink-mute">{phones === 1 ? c.onePhone : fill(c.phones, { n: phones })}</p>}
        {error && <p className="mt-1 text-meta text-bad" role="alert">{error}</p>}
        {publicKey && (state === 'off' || state === 'on') && (
          <button type="button" onClick={state === 'on' ? turnOff : turnOn} disabled={busy}
            className={`mt-2 ${state === 'on' ? 'btn-ghost' : 'btn-primary'} text-body disabled:opacity-60`}>
            {state === 'on' ? c.turnOff : c.turnOn}
          </button>
        )}
      </div>
    </div>
  );
}

export function AlertSettings({ prefs, publicKey, phones }: {
  prefs: AlertPrefs; publicKey: string | null; phones: number;
}) {
  const c = useCopy().alerts;
  const [state, action] = useActionState<NotifyResult | null, FormData>(saveNotifyPrefs, null);
  const [quiet, setQuiet] = useState(Boolean(prefs.quiet_start && prefs.quiet_end));

  return (
    <section className="card space-y-6" aria-labelledby="alert-settings">
      <div>
        <h2 id="alert-settings" className="head-panel">{c.title}</h2>
        <p className="text-body text-ink-soft">{c.sub}</p>
      </div>

      <PushSwitch publicKey={publicKey} phones={phones} />

      <hr className="hairline" />

      <form action={action} className="space-y-5">
        <div>
          <label htmlFor="alerts-wa" className="block text-body font-medium text-ink">{c.whatsapp.label}</label>
          <input id="alerts-wa" name="whatsapp_number" type="tel" inputMode="tel" autoComplete="tel"
            defaultValue={prefs.whatsapp_number} className="field mt-1 max-w-xs" dir="ltr" />
          <p className="mt-1 text-meta text-ink-mute">{c.whatsapp.hint}</p>
        </div>

        <input type="hidden" name="push_enabled" value={prefs.push_enabled ? 'on' : 'off'} />

        <div>
          <label className="flex items-center gap-2 text-body font-medium text-ink">
            <input type="checkbox" name="quiet" checked={quiet} onChange={(e) => setQuiet(e.target.checked)} className="size-4" />
            <Moon size={15} strokeWidth={1.5} aria-hidden className="text-ink-mute" />
            {c.quiet.title}
          </label>
          <p className="mt-1 text-meta text-ink-mute">{c.quiet.sub}</p>
          {quiet && (
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <label className="text-meta text-ink-soft">
                {c.quiet.from}
                <input name="quiet_start" type="time" defaultValue={prefs.quiet_start ?? '23:00'} className="field mt-1 block w-32" dir="ltr" />
              </label>
              <label className="text-meta text-ink-soft">
                {c.quiet.to}
                <input name="quiet_end" type="time" defaultValue={prefs.quiet_end ?? '07:30'} className="field mt-1 block w-32" dir="ltr" />
              </label>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Save />
          {state?.ok && <span className="inline-flex items-center gap-1 text-body text-ok"><Check size={15} aria-hidden />{c.saved}</span>}
          {state && !state.ok && <span className="text-body text-bad" role="alert">{state.error}</span>}
        </div>
      </form>
    </section>
  );
}
