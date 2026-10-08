import React, { useEffect, useState } from 'react'
import { useT } from '@/app/i18n/useT'
import { BLOG_DESCRIPTION, BLOG_TITLE } from '@/app/pages/seo'
import { useDocumentMeta } from '@/app/pages/useDocumentMeta'
import PagePromo from '@/app/sponsors/PagePromo'
import { fetchPosts, type PostMeta } from './blogManifest'

export default function BlogIndex() {
  const { t, formatDate } = useT()
  const [posts, setPosts] = useState<PostMeta[] | null>(null)
  useDocumentMeta(BLOG_TITLE, BLOG_DESCRIPTION)

  useEffect(() => {
    let active = true
    fetchPosts().then(list => { if (active) setPosts(list) })
    return () => { active = false }
  }, [])

  return (
    <div className="grid gap-8 max-w-[860px]" aria-busy={posts ? undefined : true}>
      <header className="grid gap-2">
        <h1 className="page-title">{t('blog.title')}</h1>
        <p className="page-lead">Longer write-ups on the formats and algorithms behind the utilities.</p>
      </header>
      {posts === null ? (
        <p className="muted" role="status">{t('common.loading')}</p>
      ) : posts.length === 0 ? (
        <p className="muted">{t('blog.empty')}</p>
      ) : (
        <ul className="grid">
          {posts.map((p, i) => (
            <React.Fragment key={p.slug}>
              <li className="relative border-t">
                <div className="grid gap-x-7 gap-y-1.5 pt-5 pb-[22px] sm:grid-cols-[140px_minmax(0,1fr)]">
                  <span className="pt-1 font-mono text-[11.5px] text-muted">
                    {typeof p.date === 'string' && <time dateTime={p.date}>{formatDate(p.date, { dateStyle: 'long' })}</time>}
                  </span>
                  <div className="grid gap-1.5 min-w-0">
                    {/* the pre-rendered post's crawlable path; AppShell keeps the click in the app.
                        Its ::after covers the row, so the whole entry is one link target */}
                    <a className="text-lg leading-[25px] font-semibold tracking-[-0.01em] text-balance hover:text-acc after:absolute after:inset-0"
                      href={`/blog/${p.slug}/`}>{p.title}</a>
                    {typeof p.description === 'string' && p.description && (
                      <p className="text-sm leading-[22px] text-muted text-pretty">{p.description}</p>
                    )}
                    {!!p.tags?.length && (
                      <span className="flex flex-wrap gap-1.5 pt-1">
                        {p.tags.map(tag => <span key={tag} className="chip">{tag}</span>)}
                      </span>
                    )}
                  </div>
                </div>
              </li>
              {/* one of our own tools after the newest post; hidden on phones, like the promo itself */}
              {i === 0 && <li className="hidden sm:block pb-5"><PagePromo page={{ kind: 'index' }} slot="inline" /></li>}
            </React.Fragment>
          ))}
        </ul>
      )}
    </div>
  )
}
