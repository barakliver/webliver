/**
 * What the release agent wrote down, read back as one shape.
 *
 * The agent on the droplet keeps a few small files: the commit that is live,
 * the one before it, a commit it has given up on, how many goes the current
 * one has had, and a log. Until today those files were read by nobody. Every
 * release for five days failed its screen check and was rolled back, twice
 * each, and the only place that said so was a log on a machine nobody was
 * looking at — the email path needs a key that was never set.
 *
 * This is the pure half: given the files' contents, say what happened. The
 * reading is in `releaseFs`, so the design harness can draw every state of
 * the card from fixtures without importing the filesystem.
 */

export type ReleaseResult = 'ok' | 'rolled-back' | 'broken' | 'failed' | 'unknown';

export type ReleaseState = {
  /** The agent's state directory exists on this machine. False on a laptop. */
  found: boolean;
  /** The build this process was compiled from, short. `dev` in development. */
  running: string;
  /** The commit the agent says is live, full. */
  live: string | null;
  previous: string | null;
  /** A commit that failed twice and will not be tried again until it changes. */
  gaveUp: string | null;
  tried: { tag: string; n: number } | null;
  /** What the last run ended in, read from the last lines of the log. */
  result: ReleaseResult;
  /** When the last log line was written, ISO, or null. */
  at: string | null;
  /** The last lines of the log, with anything that looks like a secret gone. */
  lines: string[];
};

export type AgentFiles = {
  deployed?: string | null;
  previous?: string | null;
  gaveUp?: string | null;
  tried?: string | null;
  log?: string | null;
};

/** Seven characters, which is what the log and git both show. */
export function shortSha(sha: string | null | undefined): string {
  return (sha ?? '').trim().slice(0, 7);
}

/**
 * The log is the agent's own `say` lines and, between them, whatever psql and
 * pg_dump printed. Neither should carry a connection string, and neither is
 * trusted to: the rule in this project is that a diagnostic which reads the
 * environment filters connection strings out of its own output.
 */
export function redact(line: string): string {
  return line
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[connection string]')
    .replace(/\bBearer\s+\S+/g, 'Bearer [hidden]')
    /* `API_KEY=`, `password:` and the like, however they are prefixed. */
    .replace(/(key|token|secret|password)\s*[=:]\s*\S+/gi, '$1=[hidden]');
}

const STAMP = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)\s+/;

function resultOf(lines: string[]): ReleaseResult {
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    if (/deployed and every screen draws something/.test(l)) return 'ok';
    if (/rolled back to/.test(l)) return 'rolled-back';
    if (/needs a person/.test(l)) return 'broken';
    if (/\bFAIL\b/.test(l)) return 'failed';
  }
  return 'unknown';
}

export function parseAgentState(files: AgentFiles | null, running: string, keep = 12): ReleaseState {
  const none: ReleaseState = {
    found: false, running, live: null, previous: null, gaveUp: null, tried: null,
    result: 'unknown', at: null, lines: [],
  };
  if (!files) return none;

  const clean = (s: string | null | undefined) => {
    const t = (s ?? '').trim();
    return t ? t : null;
  };

  const all = (files.log ?? '').split('\n').map((l) => l.trimEnd()).filter(Boolean);
  const lines = all.slice(-keep).map(redact);

  let tried: ReleaseState['tried'] = null;
  const t = clean(files.tried);
  if (t) {
    const [tag, n] = t.split(/\s+/);
    if (tag) tried = { tag, n: Number(n) || 1 };
  }

  const lastStamped = [...all].reverse().find((l) => STAMP.test(l));
  const at = lastStamped ? (lastStamped.match(STAMP)?.[1] ?? null) : null;

  return {
    found: true,
    running,
    live: clean(files.deployed),
    previous: clean(files.previous),
    gaveUp: clean(files.gaveUp),
    tried,
    result: resultOf(all),
    at,
    lines,
  };
}

/** Is the process serving the commit the agent believes is live? Unknown
 *  in development and wherever the agent has not written anything yet. */
export function servesLive(s: ReleaseState): boolean | null {
  if (!s.found || !s.live || s.running === 'dev') return null;
  return s.live.startsWith(s.running) || s.running.startsWith(shortSha(s.live));
}
