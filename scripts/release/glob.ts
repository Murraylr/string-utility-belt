/**
 * The small glob dialect the release path rules use, compiled to an anchored
 * RegExp over repo-relative, forward-slash paths:
 *
 * - `**` + `/` matches zero or more whole directories; a trailing `**` matches everything below
 * - `*` matches within one path segment, `?` one character of a segment
 * - `{a,b}` matches either alternative (alternatives may use the wildcards above, not nest braces)
 */
export function globToRegExp(glob: string): RegExp {
  return new RegExp(`^${toSource(glob)}$`)
}

/** True when `path` matches any of `globs`. */
export function matchesAny(path: string, globs: readonly RegExp[]): boolean {
  return globs.some(re => re.test(path))
}

function toSource(glob: string): string {
  let out = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*') {
      if (glob[i + 1] === '*') {
        if (glob[i + 2] === '/') { out += '(?:[^/]*/)*'; i += 2 } else { out += '.*'; i += 1 }
      } else {
        out += '[^/]*'
      }
    } else if (c === '?') {
      out += '[^/]'
    } else if (c === '{') {
      const end = glob.indexOf('}', i)
      const body = end < 0 ? '' : glob.slice(i + 1, end)
      if (end < 0 || body.includes('{')) throw new Error(`unsupported braces in glob "${glob}"`)
      out += `(?:${body.split(',').map(toSource).join('|')})`
      i = end
    } else if (c === '}') {
      throw new Error(`unbalanced "}" in glob "${glob}"`)
    } else {
      out += c.replace(/[.+^$()|[\]\\]/g, '\\$&')
    }
  }
  return out
}
