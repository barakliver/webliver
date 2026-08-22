'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import {
  addMoodboardImage,
  deleteMoodboardImage,
  updateMoodboardImage,
} from '@/app/actions/workspace';
import { useRealtimeRows } from '@/lib/hooks/useRealtimeRows';
import type { MoodCategory, MoodboardRow } from '@/lib/supabase/database.types';

/**
 * Bride Mode — the visual moodboard vault.
 *
 * A masonry board the couple fills from their phone and the producer reads on
 * a desktop, kept in step by Supabase Realtime.
 */

const CATEGORIES: { key: MoodCategory; he: string; icon: string }[] = [
  { key: 'chuppah', he: 'חופה', icon: '💒' },
  { key: 'floral', he: 'עיצוב פרחוני', icon: '🌸' },
  { key: 'table', he: 'הגשה ושולחנות', icon: '🍽' },
  { key: 'lighting', he: 'תאורה', icon: '💡' },
  { key: 'attire', he: 'לוק וסטיילינג', icon: '👗' },
  { key: 'other', he: 'אחר', icon: '✨' },
];

const CATEGORY_LABEL = new Map(CATEGORIES.map((c) => [c.key, c]));

interface Props {
  clientId: string;
  initialItems: MoodboardRow[];
  /** The producer's view is read-only — the couple curates their own board. */
  readOnly?: boolean;
}

export default function BrideMode({ clientId, initialItems, readOnly = false }: Props) {
  const { rows, status, setRows } = useRealtimeRows({
    table: 'moodboards',
    clientId,
    initial: initialItems,
    sort: (a, b) => b.position - a.position,
  });

  const [filter, setFilter] = useState<MoodCategory | 'all'>('all');
  const [category, setCategory] = useState<MoodCategory>('chuppah');
  const [caption, setCaption] = useState('');
  const [tagText, setTagText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.category === filter)),
    [rows, filter],
  );

  const counts = useMemo(() => {
    const map = new Map<MoodCategory, number>();
    for (const row of rows) map.set(row.category, (map.get(row.category) ?? 0) + 1);
    return map;
  }, [rows]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      for (const file of Array.from(files).slice(0, 10)) {
        if (!file.type.startsWith('image/')) {
          setError('אפשר להעלות תמונות בלבד.');
          continue;
        }
        const dataUrl = await readAsDataUrl(file);
        const result = await addMoodboardImage({
          clientId,
          category,
          caption: caption.trim() || undefined,
          tags: tagText
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 8),
          dataUrl,
          fileName: file.name,
        });
        if (!result.ok) {
          setError(result.error ?? 'ההעלאה נכשלה.');
          break;
        }
        // Realtime will echo this back; inserting now keeps the UI instant.
        if (result.data) {
          setRows((current) =>
            current.some((r) => r.id === result.data!.id) ? current : [result.data!, ...current],
          );
        }
      }
      setCaption('');
      setTagText('');
      if (fileRef.current) fileRef.current.value = '';
    } catch {
      setError('לא הצלחנו לקרוא את הקובץ.');
    } finally {
      setBusy(false);
    }
  }

  function handleDelete(id: string) {
    const snapshot = rows;
    setRows((current) => current.filter((r) => r.id !== id));
    startTransition(async () => {
      const result = await deleteMoodboardImage({ clientId, id });
      if (!result.ok) {
        setRows(snapshot);
        setError(result.error ?? 'המחיקה נכשלה.');
      }
    });
  }

  function handleRecategorize(id: string, next: MoodCategory) {
    setRows((current) => current.map((r) => (r.id === id ? { ...r, category: next } : r)));
    startTransition(async () => {
      const result = await updateMoodboardImage({ clientId, id, category: next });
      if (!result.ok) setError(result.error ?? 'העדכון נכשל.');
    });
  }

  return (
    <section className="stack" aria-labelledby="bride-mode-title">
      <div className="spread">
        <div>
          <h2 id="bride-mode-title" style={{ fontSize: 22 }}>
            🖼 מודבורד ההשראה
          </h2>
          <p className="muted small">
            העלו תמונות השראה לפי קטגוריה — הן מופיעות מיד אצל המפיק.
          </p>
        </div>
        <ConnectionBadge status={status} />
      </div>

      <div className="row" role="group" aria-label="סינון לפי קטגוריה">
        <button
          type="button"
          className="chip"
          aria-pressed={filter === 'all'}
          onClick={() => setFilter('all')}
        >
          הכל <span className="muted">{rows.length}</span>
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            className="chip"
            aria-pressed={filter === c.key}
            onClick={() => setFilter(c.key)}
          >
            {c.icon} {c.he} <span className="muted">{counts.get(c.key) ?? 0}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="alert alert-err" role="alert">
          {error}
        </div>
      )}

      {!readOnly && (
        <div className="card stack">
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
            <div>
              <label htmlFor="mood-category">קטגוריה</label>
              <select
                id="mood-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as MoodCategory)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.icon} {c.he}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="mood-caption">כיתוב (רשות)</label>
              <input
                id="mood-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={280}
                placeholder="מה אהבתם כאן?"
              />
            </div>
            <div>
              <label htmlFor="mood-tags">תגיות, מופרדות בפסיק</label>
              <input
                id="mood-tags"
                value={tagText}
                onChange={(e) => setTagText(e.target.value)}
                placeholder="רומנטי, לבן, נרות"
              />
            </div>
          </div>

          <div className="row">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              disabled={busy}
              aria-label="בחירת תמונות"
              onChange={(e) => void handleFiles(e.target.files)}
            />
            {busy && <span className="muted small">מעלה…</span>}
          </div>
          <p className="muted small">עד 10 תמונות בכל פעם, 8MB לתמונה.</p>
        </div>
      )}

      {readOnly && (
        <p className="muted small">תצוגה בלבד — הזוג מנהל את המודבורד מהפורטל שלו.</p>
      )}

      {visible.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 34 }}>
          <div style={{ fontSize: 34 }} aria-hidden>
            ✧
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            {rows.length === 0 ? 'עדיין אין תמונות במודבורד.' : 'אין תמונות בקטגוריה הזו.'}
          </p>
        </div>
      ) : (
        <ul
          className="grid"
          style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', listStyle: 'none' }}
        >
          {visible.map((item) => {
            const meta = CATEGORY_LABEL.get(item.category);
            return (
              <li
                key={item.id}
                className="card"
                style={{ padding: 0, overflow: 'hidden', position: 'relative' }}
              >
                <div style={{ position: 'relative', aspectRatio: '1 / 1', background: '#f1ece2' }}>
                  <Image
                    src={item.image_url}
                    alt={item.caption ?? meta?.he ?? 'תמונת השראה'}
                    fill
                    sizes="(max-width: 700px) 45vw, 200px"
                    style={{ objectFit: 'cover' }}
                    unoptimized
                  />
                  <span
                    className="badge"
                    style={{ position: 'absolute', insetInlineStart: 6, top: 6, background: 'rgba(255,255,255,.9)' }}
                  >
                    {meta?.icon} {meta?.he}
                  </span>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      disabled={pending}
                      aria-label={`הסרת ${item.caption ?? 'תמונה'}`}
                      style={{
                        position: 'absolute',
                        insetInlineEnd: 6,
                        top: 6,
                        width: 26,
                        height: 26,
                        borderRadius: 999,
                        border: 'none',
                        background: 'rgba(0,0,0,.55)',
                        color: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div style={{ padding: '8px 10px' }}>
                  {item.caption && <p className="small">{item.caption}</p>}
                  {item.tags.length > 0 && (
                    <p className="muted small">{item.tags.map((t) => `#${t}`).join(' ')}</p>
                  )}
                  {!readOnly && (
                    <select
                      aria-label="שינוי קטגוריה"
                      value={item.category}
                      onChange={(e) => handleRecategorize(item.id, e.target.value as MoodCategory)}
                      style={{ marginTop: 6, fontSize: 12, padding: '5px 8px' }}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.he}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function ConnectionBadge({ status }: { status: 'connecting' | 'live' | 'error' }) {
  const map = {
    live: { cls: 'badge badge-live', text: '● מסונכרן' },
    connecting: { cls: 'badge badge-wait', text: '○ מתחבר…' },
    error: { cls: 'badge badge-off', text: '● לא מסונכרן' },
  } as const;
  const { cls, text } = map[status];
  return (
    <span className={cls} role="status">
      {text}
    </span>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });
}
