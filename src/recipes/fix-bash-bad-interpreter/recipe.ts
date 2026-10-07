import type { Recipe } from '../types'
import { step } from '../define'

/** Every Unicode space separator (category Zs) except the plain space: NBSP, en/em/thin spaces, narrow NBSP, … */
const UNICODE_SPACES = String.raw`[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]`

const recipe: Recipe = {
  slug: 'fix-bash-bad-interpreter',
  name: 'Fix ^M bad interpreter errors in a shell script',
  summary:
    "Paste a script that fails with ^M: bad interpreter or $'\\r': command not found and get it back with LF line endings, no BOM or zero-width characters, plain spaces in place of no-break ones and no trailing whitespace.",
  category: 'DevOps & Config',
  primaryQuery: 'bad interpreter: no such file or directory',
  published: '2026-10-07',
  related: ['clean-chatgpt-text', 'spring-boot-yaml-to-env-vars'],
  steps: [
    step('hidden', 'remove_invisible', { mode: 'remove' },
      'Deletes the byte order mark that editors write before #! when saving as "UTF-8 with BOM", and zero-width spaces copied from web pages. With a BOM first, the kernel sees no shebang; a zero-width space silently becomes part of a word.',
      { label: 'remove BOM and zero-width characters' }),
    step('spaces', 'replace', { pattern: UNICODE_SPACES, replacement: ' ', regex: true, flags: 'g' },
      "Turns no-break and other Unicode spaces into plain spaces. Bash treats only spaces and tabs as blanks between words, so two NBSPs of indentation from a wiki make bash look for a command named $'\\302\\240\\302\\240echo' instead of echo.",
      { label: 'Unicode spaces to plain spaces' }),
    step('eol', 'normalize_line_endings', { mode: 'lf', finalNewline: 'add' },
      "Converts Windows CRLF line endings to LF. With CRLF the shebang asks for bash\\r, which does not exist, and every line's last word carries a \\r: pipefail\\r is not an option, blank lines run $'\\r' as a command. A missing final newline is added."),
    step('trim', 'trim_lines', { side: 'end', characters: '' },
      'Removes spaces and tabs after the last visible character of each line. A backslash continues a line only when nothing follows it: with a space after it, the backslash escapes that space, the command ends there and the next line runs as a command of its own.',
      { label: 'trim trailing whitespace' }),
  ],
  samples: [
    {
      id: 'wiki-deploy-script',
      title: 'Deploy script from a wiki',
      input:
        '\ufeff#!/usr/bin/env bash\r\n' +
        'set -euo pipefail\r\n' +
        '\r\n' +
        '# deploy.sh — edited on Windows, copied from the team wiki\r\n' +
        'APP="billing-api"\t\r\n' +
        'TAG="${1:-latest}"\r\n' +
        '\r\n' +
        'if [ -z "${1:-}" ]; then\r\n' +
        '\u00a0\u00a0echo "no tag given, deploying latest"\r\n' +
        'fi\r\n' +
        '\r\n' +
        'kubectl set image "deployment/$APP" "$APP=registry.example.com/$APP:$TAG" -n prod\r\n' +
        'kubectl rollout status "deployment/$APP" \\  \r\n' +
        '  -n prod --timeout=120s\u200b',
      output:
        '#!/usr/bin/env bash\n' +
        'set -euo pipefail\n' +
        '\n' +
        '# deploy.sh — edited on Windows, copied from the team wiki\n' +
        'APP="billing-api"\n' +
        'TAG="${1:-latest}"\n' +
        '\n' +
        'if [ -z "${1:-}" ]; then\n' +
        '  echo "no tag given, deploying latest"\n' +
        'fi\n' +
        '\n' +
        'kubectl set image "deployment/$APP" "$APP=registry.example.com/$APP:$TAG" -n prod\n' +
        'kubectl rollout status "deployment/$APP" \\\n' +
        '  -n prod --timeout=120s\n',
    },
    {
      id: 'docker-entrypoint',
      title: 'Docker entrypoint checked out with CRLF',
      input:
        '#!/bin/sh\r\n' +
        'set -e\r\n' +
        '\r\n' +
        'if [ "$1" = "migrate" ]; then\r\n' +
        '  exec python manage.py migrate --noinput\r\n' +
        'fi\r\n' +
        '\r\n' +
        'exec "$@"\r\n',
      output:
        '#!/bin/sh\n' +
        'set -e\n' +
        '\n' +
        'if [ "$1" = "migrate" ]; then\n' +
        '  exec python manage.py migrate --noinput\n' +
        'fi\n' +
        '\n' +
        'exec "$@"\n',
    },
    {
      id: 'runbook-one-liner',
      title: 'One-liner with a no-break space',
      input:
        '#!/bin/bash\n' +
        "# status codes in the nginx access log, from the on-call runbook\n" +
        "awk '{print $9}' /var/log/nginx/access.log |\u00a0sort | uniq -c | sort -rn\n",
      output:
        '#!/bin/bash\n' +
        "# status codes in the nginx access log, from the on-call runbook\n" +
        "awk '{print $9}' /var/log/nginx/access.log | sort | uniq -c | sort -rn\n",
    },
  ],
}
export default recipe
