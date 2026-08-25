#!/usr/bin/env python3
"""
Put one site block into a Caddyfile, and leave everything else alone.

Its own file rather than a heredoc inside the shell script. The first version
was embedded, and the escaping had to survive a bash heredoc, a Python string
that generated the script, and a second heredoc inside the result. One `\n`
lost a backslash on the way through and the script died at parse time on the
server, four layers from where the mistake was made. A file has one layer.

    caddy-site.py <caddyfile> <domain> <port> [--www]

Everything it writes lives between two markers, so running it again replaces
its own block and never touches a line somebody added by hand. An existing
block for the same host is commented out rather than deleted: the file is the
only record of how the previous site was served.
"""
import re
import sys

OPEN = '# >>> liver-next managed'
CLOSE = '# <<< liver-next managed'


def block(domain: str, port: str, www: bool) -> str:
    hosts = f'{domain}, www.{domain}' if www else domain
    return '\n'.join([
        OPEN,
        f'{hosts} {{',
        f'\treverse_proxy 127.0.0.1:{port}',
        '\trequest_body {',
        '\t\tmax_size 12MB',
        '\t}',
        '}',
        CLOSE,
    ])


def comment_out(src: str, domain: str) -> str:
    """Comment out the existing top-level block for this host, braces and all."""
    pattern = re.compile(r'(^|[\s,])' + re.escape(domain) + r'([\s,{]|$)')
    out, depth, inside = [], 0, False

    for line in src.split('\n'):
        if not inside and depth == 0 and pattern.search(line) and not line.lstrip().startswith('#'):
            inside = True
            depth = line.count('{') - line.count('}')
            out.append('# ' + line)
            if depth <= 0:
                inside = False
            continue
        if inside:
            depth += line.count('{') - line.count('}')
            out.append('# ' + line)
            if depth <= 0:
                inside = False
            continue
        out.append(line)

    return '\n'.join(out)


def main() -> int:
    if len(sys.argv) < 4:
        print(__doc__.strip(), file=sys.stderr)
        return 2

    path, domain, port = sys.argv[1], sys.argv[2], sys.argv[3]
    www = '--www' in sys.argv[4:]

    with open(path, encoding='utf-8') as fh:
        src = fh.read()

    new = block(domain, port, www)

    if OPEN in src:
        src = re.sub(re.escape(OPEN) + r'.*?' + re.escape(CLOSE), lambda _: new, src, flags=re.S)
    else:
        src = comment_out(src, domain).rstrip() + '\n\n' + new + '\n'

    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(src)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
