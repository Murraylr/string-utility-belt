import type { UtilityMeta } from '../../src/core/registry'
import type { ParamSpec, UtilityExample } from '../../src/types/utility'
import { escapeHtml } from './html'
import type { BlogPostMeta } from './blog'

const typesOf = (t: string | string[]): string => (Array.isArray(t) ? t.join(' | ') : t)

function boundsOrOptions(spec: ParamSpec): string {
  switch (spec.kind) {
    case 'number':
    case 'range': {
      const parts: string[] = []
      if (spec.min !== undefined || spec.max !== undefined) parts.push(`${spec.min ?? '−∞'}–${spec.max ?? '∞'}`)
      if (spec.kind === 'number' && spec.step !== undefined) parts.push(`step ${spec.step}`)
      if (spec.kind === 'number' && spec.integer) parts.push('integer')
      return parts.join(', ') || '—'
    }
    case 'select':
    case 'multiselect':
      return spec.options.join(', ')
    case 'string':
      return spec.maxLength ? `max ${spec.maxLength} chars` : '—'
    default:
      return '—'
  }
}

const defaultOf = (spec: ParamSpec): string => {
  if (!('default' in spec) || spec.default === undefined) return '—'
  const d = (spec as { default?: unknown }).default
  return typeof d === 'string' ? d || '(empty)' : JSON.stringify(d)
}

/**
 * Static, crawlable snapshot of a utility doc page: name, description, params
 * and examples as plain semantic HTML. React replaces this element on mount
 * (`UtilityDocPage`); search engines and link previews see this markup.
 */
export function renderUtilityContent(meta: UtilityMeta, examples: UtilityExample[]): string {
  const params = Object.entries(meta.params)
  const paramsHtml = params.length === 0 ? '' : `
    <section>
      <h2>Parameters</h2>
      <table>
        <thead><tr><th>name</th><th>kind</th><th>default</th><th>bounds / options</th><th>description</th></tr></thead>
        <tbody>
          ${params.map(([name, spec]) => `
          <tr>
            <td>${escapeHtml(name)}</td>
            <td>${escapeHtml(spec.kind)}</td>
            <td>${escapeHtml(defaultOf(spec))}</td>
            <td>${escapeHtml(boundsOrOptions(spec))}</td>
            <td>${escapeHtml(spec.description ?? '—')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </section>`

  const examplesHtml = examples.length === 0 ? '' : `
    <section>
      <h2>Examples</h2>
      ${examples.map(ex => `
      <div>
        ${ex.title ? `<h3>${escapeHtml(ex.title)}</h3>` : ''}
        <p>input${ex.inputEncoding && ex.inputEncoding !== 'text' ? ` (${escapeHtml(ex.inputEncoding)})` : ''}</p>
        <pre>${escapeHtml(ex.input)}</pre>
        ${ex.params && Object.keys(ex.params).length > 0 ? `<p>params</p><pre>${escapeHtml(JSON.stringify(ex.params))}</pre>` : ''}
        <p>output</p>
        <pre>${escapeHtml(ex.output ?? '(non-deterministic)')}</pre>
      </div>`).join('')}
    </section>`

  return `
  <article>
    <header>
      <h1>${escapeHtml(meta.name)}</h1>
      <p>${escapeHtml(meta.category)}</p>
      <p>${escapeHtml(meta.description)}</p>
      <p>accepts <code>${escapeHtml(typesOf(meta.accepts))}</code> → produces <code>${escapeHtml(typesOf(meta.produces))}</code></p>
    </header>
    ${paramsHtml}
    ${examplesHtml}
    <p><a href="/utilities/">Browse all utilities</a></p>
  </article>`
}

/** Static snapshot of `UtilitiesIndexPage`: every utility grouped by category. */
export function renderUtilitiesIndexContent(manifest: UtilityMeta[]): string {
  const categories = [...new Set(manifest.map(m => m.category))]
  const groups = categories.map(cat => {
    const items = manifest.filter(m => m.category === cat)
    return `
    <section>
      <h2>${escapeHtml(cat)} (${items.length})</h2>
      <ul>
        ${items.map(u => `<li><a href="/util/${escapeHtml(u.id)}/">${escapeHtml(u.name)}</a> — ${escapeHtml(u.description)}</li>`).join('')}
      </ul>
    </section>`
  }).join('')
  return `
  <div>
    <h1>All utilities</h1>
    <p>${manifest.length} utilities</p>
    ${groups}
  </div>`
}

/** Static snapshot of `BlogIndex`. */
export function renderBlogIndexContent(posts: BlogPostMeta[]): string {
  if (posts.length === 0) return '<div><h1>Blog</h1><p>No posts yet.</p></div>'
  const items = posts.map(p => `
    <li>
      <a href="/blog/${escapeHtml(p.slug)}/">${escapeHtml(p.title)}</a>
      ${p.date ? `<time datetime="${escapeHtml(p.date)}">${escapeHtml(p.date)}</time>` : ''}
      ${p.description ? `<p>${escapeHtml(p.description)}</p>` : ''}
    </li>`).join('')
  return `<div><h1>Blog</h1><ul>${items}</ul></div>`
}

/** Static snapshot of `BlogPost`: pre-rendered markdown body (already HTML-escaped by `mdToHtml`). */
export function renderBlogPostContent(meta: { title?: string; date?: string }, bodyHtml: string): string {
  return `
  <article>
    <header>
      ${meta.title ? `<h1>${escapeHtml(meta.title)}</h1>` : ''}
      ${meta.date ? `<time datetime="${escapeHtml(meta.date)}">${escapeHtml(meta.date)}</time>` : ''}
    </header>
    <div>${bodyHtml}</div>
  </article>`
}

/**
 * Static snapshot of `ChangelogPage`: pre-rendered markdown (already escaped by
 * `renderChangelogHtml`), whose own `# Changelog` is the page heading.
 */
export function renderChangelogContent(bodyHtml: string): string {
  return `<article>${bodyHtml}</article>`
}
