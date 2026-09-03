/**
 * Reading a newline-delimited JSON stream in the browser.
 *
 * Shared by every chat widget that talks to a streaming route. A chunk
 * boundary lands in the middle of a line often enough that parsing whatever
 * arrived would throw on perfectly good output, so lines are split and the
 * tail is kept for the next read.
 */
export async function readNdjson(
  res: Response,
  onEvent: (event: Record<string, unknown>) => void,
): Promise<void> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    const lines = pending.split('\n');
    pending = lines.pop() ?? '';
    for (const raw of lines) {
      if (!raw.trim()) continue;
      try { onEvent(JSON.parse(raw)); } catch { /* a torn line; the next read has the rest */ }
    }
  }
  if (pending.trim()) {
    try { onEvent(JSON.parse(pending)); } catch { /* nothing usable at the end */ }
  }
}

/** Whether a response is the streaming kind, rather than one JSON object. */
export const isNdjson = (res: Response) =>
  !!res.body && (res.headers.get('content-type') ?? '').includes('ndjson');
