export function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// only these link schemes render as a real <a href>; anything else (notably
// `javascript:`) falls back to `#` rather than becoming a clickable payload.
// A leading `//` or `/\` is protocol-relative to browsers, i.e. another host.
const SAFE_URL = /^(https?:|mailto:|#|\/(?![/\\]))/i;

function sanitizeUrl(url) {
  return SAFE_URL.test(url) ? url : '#';
}

// NUL never appears in real prose, so it delimits placeholders; any NUL in the
// source is stripped first so the source can't forge one
const hold = (store, prefix, html) => `\u0000${prefix}${store.push(html) - 1}\u0000`;

// CommonMark-ish flanking: a delimiter run must hug its text, so `2 * 3 * 4` stays literal
function emphasis(text) {
  return text
    .replace(/\*\*(?!\s)([^*\n]*?[^\s*])\*\*/g, '<strong>$1</strong>')
    .replace(/\*(?!\s)([^*\n]*?[^\s*])\*/g, '<em>$1</em>');
}

function inline(text) {
  // links are held out once built, so emphasis can neither rewrite an href nor
  // open inside the tag and close outside it. The url comes from already-escaped
  // text and may not contain a placeholder (restored code carries quotes), so
  // once its scheme is checked it's safe inside a quoted attribute.
  const links = [];
  const held = text.replace(/\[([^\]\n]+)\]\(([^)\s\u0000]+)\)/g, (_, label, url) => {
    const href = sanitizeUrl(url);
    // only off-site links open a new tab; in-app routes (`#/…`, `/…`) navigate in place
    // no `noreferrer`: the site's Referrer-Policy already limits other hosts to its origin,
    // which lets the stores and package registries we link to credit the visit to us
    const external = /^https?:/i.test(href) ? ' target="_blank" rel="noopener"' : '';
    return hold(links, 'LINK', `<a class="md-link" href="${href}"${external}>${emphasis(label)}</a>`);
  });
  return emphasis(held).replace(/\u0000LINK(\d+)\u0000/g, (_, i) => links[Number(i)]);
}

const BLOCK_TOKEN = /(\u0000BLOCK\d+\u0000)/;

function renderChunk(chunk) {
  const out = [];
  let para = [];
  const flush = () => {
    if (para.length) out.push(`<p class="md-p">${inline(para.join('\n'))}</p>`);
    para = [];
  };
  for (const line of chunk.trim().split('\n')) {
    // a fenced block is block-level even when written mid-line, so it's split
    // out rather than left to nest inside a <p> or heading
    for (const seg of line.split(BLOCK_TOKEN)) {
      const heading = /^(#{1,3})\s+(.+)$/.exec(seg);
      if (BLOCK_TOKEN.test(seg)) {
        flush();
        out.push(seg);
      } else if (heading) {
        flush();
        const level = heading[1].length;
        out.push(`<h${level} class="md-h${level}">${inline(heading[2].trim())}</h${level}>`);
      } else if (seg.trim()) {
        para.push(seg.trim());
      }
    }
  }
  flush();
  return out;
}

/**
 * Minimal Markdown -> HTML for blog posts. Every character of the source that
 * isn't produced by a markdown construct handled below is HTML-escaped before
 * any regex runs, so raw HTML embedded in prose (e.g. `<img onerror=...>`)
 * renders as inert text instead of becoming a live element — only fenced code,
 * inline code, headings, bold/italic and links produce real tags. Emphasis and
 * links never reach inside code or across paragraphs.
 */
export function mdToHtml(md = '') {
  md = String(md).replace(/\r\n?/g, '\n').replace(/\u0000/g, '');

  // 1. fenced code blocks out first (contents escaped) so their ``` markers
  //    and contents can't be touched by the passes below. An info string on
  //    the opening fence (```js) is a language hint, not code; its charset
  //    can't contain a quote, so it's safe inside the attribute.
  const blocks = [];
  md = md.replace(/```(?:([\w+#.-]*)[^\S\n]*\n)?([\s\S]*?)```/g, (_, lang, code) => {
    const hint = lang ? ` data-lang="${lang}"` : '';
    return hold(blocks, 'BLOCK', `<pre class="md-pre" tabindex="0" aria-label="code"><code class="md-code-block"${hint}>${escapeHtml(code.trim())}</code></pre>`);
  });

  // 2. escape everything that's left — this is what stops raw HTML in prose
  //    from surviving as real tags
  md = escapeHtml(md);

  // 3. inline code, on the escaped text (so `<b>` displays literally), held
  //    out so emphasis/links don't apply inside it
  const codes = [];
  md = md.replace(/`([^`\n]+)`/g, (_, code) => hold(codes, 'CODE', `<code class="md-code">${code}</code>`));

  // 4. block structure: blank lines separate paragraphs; a heading line or a
  //    fenced block stands alone even without blank lines around it
  md = md.split(/\n{2,}/).flatMap(renderChunk).join('\n');

  // 5. restore held-out code
  return md
    .replace(/\u0000CODE(\d+)\u0000/g, (_, i) => codes[Number(i)])
    .replace(/\u0000BLOCK(\d+)\u0000/g, (_, i) => blocks[Number(i)]);
}

/**
 * Splits `---`-delimited frontmatter (simple `key: value` lines; LF or CRLF)
 * from a markdown document. Values wrapped in matching quotes are unwrapped.
 * Keys land on a null-prototype object so `__proto__:` is just a key.
 */
export function parseFrontmatter(txt) {
  const m = String(txt).match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!m) return { frontmatter: {}, body: txt };
  const fm = Object.create(null);
  for (const line of m[1].split(/\r?\n/)) {
    const k = line.match(/^([a-zA-Z0-9_-]+):\s*(.*?)\s*$/);
    if (!k) continue;
    const q = /^(["'])([\s\S]*)\1$/.exec(k[2]);
    fm[k[1]] = q ? q[2] : k[2];
  }
  return { frontmatter: fm, body: m[2] };
}
