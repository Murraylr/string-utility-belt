import React, { useEffect, useState } from 'react'
import { parseFrontmatter } from '@/lib/markdown'
import { useT } from '@/app/i18n/useT'
import AdSlot from '@/app/ads/AdSlot'
import { renderMarkdownDocument } from '@/app/pages/guide'
import { pageTitle } from '@/app/pages/seo'

type BlogPostProps = { slug: string }
type Frontmatter = Record<string, string>
type Loaded =
  | { slug: string; status: 'ok'; meta: Frontmatter; html: string }
  | { slug: string; status: 'missing' }

/** Posts open with `# <title>`, which the header already renders — don't show it twice. */
function dropRepeatedTitle(body: string, title: string | undefined): string {
  const first = /^\s*#[ \t]+(.+?)[ \t]*(?:\r?\n|$)/.exec(body)
  return title && first && first[1] === title ? body.slice(first[0].length) : body
}

// exact match only: `md-code-block` (fenced blocks; already scrollable via its `.md-pre`
// ancestor) must not pick this up — only bare inline `` `code` `` spans. Unlike a fenced
// block, an inline span sits inside ordinary wrapping text, where a long unbroken token
// (a file path, an identifier) would otherwise force this narrow article wider than the
// viewport.
const withWrappableInlineCode = (html: string) => html.replace(/class="md-code"/g, 'class="md-code wrap-break-word"')

export default function BlogPost({ slug }: BlogPostProps) {
  const { t, formatDate } = useT()
  // tagged with its slug so a stale result (or error) from the previous post
  // is never shown while the next one loads
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const post = loaded?.slug === slug ? loaded : null

  useEffect(() => {
    let active = true
    fetch(`/blog/${slug}.md`)
      .then(r => {
        // a dev server / SPA fallback answers a missing .md with index.html
        const type = r.headers?.get?.('content-type') ?? ''
        if (!r.ok || type.includes('text/html')) throw new Error('not found')
        return r.text()
      })
      .then(txt => {
        if (!active) return
        const { frontmatter, body } = parseFrontmatter(txt) as { frontmatter: Frontmatter; body: string }
        // lists and tables as in the guides; the same renderer pre-renders /blog/<slug>/
        const html = withWrappableInlineCode(renderMarkdownDocument(dropRepeatedTitle(body, frontmatter.title)))
        setLoaded({ slug, status: 'ok', meta: frontmatter, html })
        if (frontmatter.title) document.title = pageTitle(frontmatter.title)
        if (frontmatter.description) {
          let metaDesc = document.querySelector('meta[name="description"]')
          if (!metaDesc) { metaDesc = document.createElement('meta'); metaDesc.setAttribute('name', 'description'); document.head.appendChild(metaDesc) }
          metaDesc.setAttribute('content', frontmatter.description)
        }
      })
      .catch(() => { if (active) setLoaded({ slug, status: 'missing' }) })
    return () => { active = false }
  }, [slug])

  const meta = post?.status === 'ok' ? post.meta : null
  return (
    <>
      {/* w-full + min-w-0: `max-w-3xl mx-auto` alone leaves this grid item's width "auto",
          which — with a non-wrapping code block inside (.md-pre already scrolls itself) —
          grid sizes via shrink-to-fit up to the block's min-content width, blowing the article
          (and the page) wider than the viewport instead of clipping to the grid track */}
      <article className="md w-full max-w-3xl mx-auto card p-6 min-w-0" aria-busy={post ? undefined : true}>
        {!post && <p className="muted" role="status">{t('common.loading')}</p>}
        {post?.status === 'missing' && <p className="text-danger" role="alert">{t('blog.notFound')}</p>}
        {meta && (
          <header className="mb-4">
            {meta.title && <h1 className="mt-0! text-2xl font-semibold">{meta.title}</h1>}
            {meta.date && <p className="muted"><time dateTime={meta.date}>{formatDate(meta.date, { dateStyle: 'long' })}</time></p>}
            {meta.updated && meta.updated !== meta.date && (
              <p className="muted text-sm">Updated <time dateTime={meta.updated}>{formatDate(meta.updated, { dateStyle: 'long' })}</time></p>
            )}
          </header>
        )}
        {post?.status === 'ok' && <div dangerouslySetInnerHTML={{ __html: post.html }} />}
      </article>
      {/* after the article, once it has loaded; keyed so each post gets its own ad request */}
      {post?.status === 'ok' && <AdSlot key={slug} placement="blog-post" className="w-full max-w-3xl mx-auto" />}
    </>
  )
}
