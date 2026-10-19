#!/usr/bin/env python3
"""
The Caddy half of the move to beforeidoevent.com.

Two jobs, kept apart because they run at different moments:

    caddy-rebrand.py render <out> <port> --phase 1|2 [--il a.co.il,b.co.il]
    caddy-rebrand.py import <Caddyfile> <include-file>
    caddy-rebrand.py adopt  <Caddyfile> <include-file>

`render` writes one file that holds every site this business answers on. Phase 1
is the additive half: the new names only, written beside whatever already
serves the old ones, so there is no moment when two blocks claim one address.
Phase 2 is the whole map, with the old names turned into redirects.

`import` adds the include line and nothing else, which is all phase 1 needs.

`adopt` is the second half of phase 2. The old names are still claimed by the
blocks that used to serve them, and Caddy refuses a config in which two blocks
claim one address, so those blocks are commented out (never deleted: the file
is the only record of how the previous site was served) and the include is
added. It is idempotent.

Everything is plain text in and plain text out, so the shell script that calls
it can validate the result with `caddy validate` and put the old file back if
that fails.
"""
import re
import sys

NEW_SITE = 'beforeidoevent.com'
NEW_APP = 'app.beforeidoevent.com'
OLD_SITE = 'liverproductions.com'
OLD_APP = 'app.liverproductions.com'

OPEN = '# >>> liver-next managed'
CLOSE = '# <<< liver-next managed'
INCLUDE_NOTE = '# liver-rebrand: every site this business answers on'


def upstream(port: str) -> str:
    # Body limit matches caddy-site.py: a photograph from a phone is larger than
    # Caddy's patience on some versions, and the app enforces its own ceiling.
    return '\n'.join([
        '\trequest_body {',
        '\t\tmax_size 12MB',
        '\t}',
        f'\treverse_proxy 127.0.0.1:{port}',
    ])


def render(port: str, phase: int, il: list[str]) -> str:
    up = upstream(port)
    out = [
        '# Written by scripts/go-rebrand.sh. Run it again and this file is replaced;',
        '# anything worth keeping belongs in the Caddyfile itself, above the import.',
        '',
        '# The business.',
        f'{NEW_SITE}, www.{NEW_SITE} {{',
        '\tencode zstd gzip',
        f'\t@www host www.{NEW_SITE}',
        f'\tredir @www https://{NEW_SITE}{{uri}} permanent',
        up,
        '}',
        '',
        '# The platform: sign in, the console, the couple\'s portal.',
        f'{NEW_APP} {{',
        '\tencode zstd gzip',
        up,
        '}',
    ]
    if phase >= 2:
        out += [
            '',
            '# The old name. Pages follow the redirect; these two do not, and so',
            '# keep answering for real: /api/* is every webhook already pasted into',
            '# an ad console, a WhatsApp provider or a mail provider by somebody else,',
            '# and /feed/* is every calendar somebody subscribed to. A redirect would',
            '# turn the first into a silent loss of leads and the second into a',
            '# calendar that stops updating, and neither tells anyone.',
            f'{OLD_SITE}, www.{OLD_SITE} {{',
            '\t@alive path /api/* /feed/*',
            '\thandle @alive {',
            *['\t' + line for line in up.split('\n')],
            '\t}',
            '\thandle {',
            f'\t\tredir https://{NEW_SITE}{{uri}} permanent',
            '\t}',
            '}',
            '',
            f'{OLD_APP} {{',
            '\t@alive path /api/* /feed/*',
            '\thandle @alive {',
            *['\t' + line for line in up.split('\n')],
            '\t}',
            '\thandle {',
            f'\t\tredir https://{NEW_APP}{{uri}} permanent',
            '\t}',
            '}',
        ]
        if il:
            hosts = []
            for d in il:
                hosts += [d, f'www.{d}']
            out += [
                '',
                '# The Israeli names, which only ever pointed at a parked page.',
                f'{", ".join(hosts)} {{',
                f'\tredir https://{NEW_SITE}{{uri}} permanent',
                '}',
            ]
    return '\n'.join(out) + '\n'


def strip_block(src: str, pattern: re.Pattern) -> str:
    """Comment out each top-level block whose address line matches, braces and all."""
    out, depth, inside = [], 0, False
    for line in src.split('\n'):
        if not inside and depth == 0 and not line.lstrip().startswith('#') and pattern.search(line):
            inside = True
            depth = line.count('{') - line.count('}')
            out.append('# [liver-rebrand] ' + line)
            if depth <= 0:
                inside = False
            continue
        if inside:
            depth += line.count('{') - line.count('}')
            out.append('# [liver-rebrand] ' + line)
            if depth <= 0:
                inside = False
            continue
        out.append(line)
    return '\n'.join(out)


def add_import(src: str, include_path: str) -> str:
    line = f'import {include_path}'
    if line in src:
        return src
    return src.rstrip() + f'\n\n{INCLUDE_NOTE}\n{line}\n'


def adopt(src: str, include_path: str) -> str:
    # The block caddy-site.py wrote for liverproductions.com, markers and all.
    if OPEN in src:
        src = re.sub(
            re.escape(OPEN) + r'.*?' + re.escape(CLOSE),
            '# [liver-rebrand] the managed block for ' + OLD_SITE + ' now lives in ' + include_path,
            src, flags=re.S,
        )
    # Anything still claiming an old name outright, in a form nobody wrote by
    # script. Anchored on whole hostnames so "liverproductions.com.old" is not
    # mistaken for it.
    for host in (OLD_SITE, 'www.' + OLD_SITE, OLD_APP):
        pat = re.compile(r'(^|[\s,])' + re.escape(host) + r'([\s,{]|$)')
        src = strip_block(src, pat)
    return add_import(src, include_path)


def main(argv: list[str]) -> int:
    if len(argv) < 2 or argv[1] not in ('render', 'import', 'adopt'):
        print(__doc__.strip(), file=sys.stderr)
        return 2

    if argv[1] == 'render':
        if len(argv) < 5:
            print(__doc__.strip(), file=sys.stderr)
            return 2
        out, port = argv[2], argv[3]
        phase = 2 if '--phase' in argv and argv[argv.index('--phase') + 1] == '2' else 1
        il = []
        if '--il' in argv:
            il = [d for d in argv[argv.index('--il') + 1].split(',') if d]
        with open(out, 'w', encoding='utf-8') as fh:
            fh.write(render(port, phase, il))
        return 0

    path, include = argv[2], argv[3]
    with open(path, encoding='utf-8') as fh:
        src = fh.read()
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(add_import(src, include) if argv[1] == 'import' else adopt(src, include))
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv))
