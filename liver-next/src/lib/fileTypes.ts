/**
 * What the shared folder accepts, and how big.
 *
 * Deliberately a plain module rather than living beside the server action that
 * enforces it: a `'use server'` file may only export async functions, and both
 * sides of this feature need the same list. The browser reads it to refuse a
 * file before spending a minute uploading it; the server reads it because a
 * check that only runs in a browser is not a check.
 */

export const MAX_FILE_BYTES = 50 * 1024 * 1024;

/* Everything a couple actually hands over: photographs, the invitation, the
   guest list their mother typed, a plan from the venue, a short clip of a
   first dance they want copied. Executables and scripts are not on the list,
   and a shared folder that accepts one is a shared folder that eventually
   serves one. */
const ALLOWED = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif', 'image/avif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv',
  'video/mp4', 'video/quicktime',
  'audio/mpeg', 'audio/mp4', 'audio/wav',
]);

export const fileAllowed = (mime: string): boolean => ALLOWED.has(mime);

/* A browser that does not recognise a type sends an empty string. The
   extension is the only thing left to go on, and refusing outright would block
   a plain .csv exported on a Mac — which is exactly the file a guest list
   arrives as. */
const BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  heic: 'image/heic', heif: 'image/heif', gif: 'image/gif', avif: 'image/avif',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain', csv: 'text/csv',
  mp4: 'video/mp4', mov: 'video/quicktime',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav',
};

export const guessMime = (name: string): string =>
  BY_EXT[(name.split('.').pop() || '').toLowerCase()] ?? '';

/** Sizes as people say them. `KB` under a megabyte, one decimal above it, and
 *  never `0.0 MB` for a file that plainly exists. */
export function humanSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
