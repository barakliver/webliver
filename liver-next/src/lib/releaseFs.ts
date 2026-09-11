import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { optional } from '@/lib/env';
import { parseAgentState, type ReleaseState } from '@/lib/release';

/**
 * The agent's state directory on the droplet, read as it stands.
 *
 * `LIVER_AGENT_STATE` names it where it is not the default; on a laptop the
 * directory does not exist and the card says so rather than pretending.
 * Reading never throws past here: a console that will not open because a
 * log file was unreadable is the wrong trade.
 */
export async function readReleaseState(): Promise<ReleaseState> {
  const dir = optional('LIVER_AGENT_STATE', '/var/lib/liver-agent');
  const running = process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev';

  const exists = await stat(dir).then((s) => s.isDirectory()).catch(() => false);
  if (!exists) return parseAgentState(null, running);

  const read = (name: string) => readFile(join(dir, name), 'utf8').catch(() => null);
  const [deployed, previous, gaveUp, tried, log] = await Promise.all([
    read('deployed'), read('previous'), read('gave-up'), read('tried'), read('agent.log'),
  ]);
  /* The log grows for as long as the machine lives. Only its tail is wanted,
     and the parser keeps the last lines, so the whole file is not sent on. */
  const tail = log ? log.slice(-8000) : null;
  return parseAgentState({ deployed, previous, gaveUp, tried, log: tail }, running);
}
