import React, { useEffect, useState } from 'react'
import { useT } from '@/app/i18n/useT'
import { BLOG_DESCRIPTION, BLOG_TITLE } from '@/app/pages/seo'
import { useDocumentMeta } from '@/app/pages/useDocumentMeta'

type PostMeta = { slug: string; title: string; date?: string; description?: string }

/** Keeps only well-formed manifest entries, so a bad manifest can't crash the page. */
function toPosts(data: unknown): PostMeta[] {
  if (!Array.isArray(data)) return []
  return data.filter((p): p is PostMeta =>
    !!p && typeof p === 'object' && typeof p.slug === 'string' && !!p.slug && typeof p.title === 'string')
}

export default function BlogIndex() {
  const { t, formatDate } = useT()
  const [posts, setPosts] = useState<PostMeta[] | null>(null)
  useDocumentMeta(BLOG_TITLE, BLOG_DESCRIPTION)

  useEffect(() => {
    let active = true
    fetch('/blog/_manifest.json')
      .then(r => r.json())
      .then(data => { if (active) setPosts(toPosts(data)) })
      .catch(() => { if (active) setPosts([]) })
    return () => { active = false }
  }, [])

  return (
    <div className="max-w-3xl mx-auto" aria-busy={posts ? undefined : true}>
      <h1 className="text-2xl font-semibold mb-4">{t('blog.title')}</h1>
      {posts === null ? (
        <p className="muted" role="status">{t('common.loading')}</p>
      ) : posts.length === 0 ? (
        <p className="muted">{t('blog.empty')}</p>
      ) : (
        <ul className="space-y-4">
          {posts.map(p => (
            <li key={p.slug} className="card p-4">
              {/* the pre-rendered post's crawlable path; AppShell keeps the click in the app */}
              <a className="text-lg font-medium hover:underline" href={`/blog/${p.slug}/`}>{p.title}</a>
              {typeof p.date === 'string' && (
                <div className="muted"><time dateTime={p.date}>{formatDate(p.date, { dateStyle: 'long' })}</time></div>
              )}
              {typeof p.description === 'string' && p.description && <p className="text-sm mt-1 text-fg/80">{p.description}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
