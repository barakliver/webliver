'use client';

import { useEffect } from 'react';

/**
 * Deletes the message after it has been seen.
 *
 * Without this the same sentence follows somebody to the next three screens,
 * because a cookie outlives the render that showed it and a server component
 * is not allowed to delete one. The cookie carries UI copy and nothing else,
 * which is what makes it safe to hand the browser the job.
 *
 * The thirty second expiry on the cookie itself is the floor under this: if
 * scripts are off, or this never runs, the message ages out on its own rather
 * than becoming permanent.
 */
export function FlashClear({ name }: { name: string }) {
  useEffect(() => {
    /* Secure, because the cookie it is clearing carries the __Host- prefix
       and a browser will not match a deletion that drops it. */
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax; Secure`;
  }, [name]);
  return null;
}
