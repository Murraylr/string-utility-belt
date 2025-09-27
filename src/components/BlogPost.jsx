import React, { useEffect, useState } from 'react'
import { mdToHtml } from '@/lib/markdown'
export default function BlogPost({ slug }) {
  const [html, setHtml] = useState('')
  const [meta, setMeta] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    let active = true
    fetch(`/blog/${slug}.md`)
      .then(r => { if (!r.ok) throw new Error('not found'); return r.text() })
      .then(txt => {
        if (!active) return
        const { frontmatter, body } = parseFrontmatter(txt)
        setMeta(frontmatter); setHtml(mdToHtml(body))
        if (frontmatter?.title) document.title = `${frontmatter.title} | String Pipeline Workshop`
        if (frontmatter?.description) {
          let metaDesc = document.querySelector('meta[name="description"]')
          if (!metaDesc) { metaDesc = document.createElement('meta'); metaDesc.setAttribute('name', 'description'); document.head.appendChild(metaDesc) }
          metaDesc.setAttribute('content', frontmatter.description)
        }
      })
      .catch(e => setErr(String(e)))
    return () => { active = false }
  }, [slug])
  return (
    <article className="prose prose-sm sm:prose lg:prose-lg max-w-3xl mx-auto bg-white border rounded-xl p-6 prose-pre:bg-gray-100 prose-pre:p-3">
      {meta && (<header className="mb-4"><h1 className="!mt-0">{meta.title}</h1><p className="text-gray-500">{meta.date}</p></header>)}
      {err ? <div className="text-red-600">Post not found.</div> : <div dangerouslySetInnerHTML={{ __html: html }} />}
    </article>
  )
}
function parseFrontmatter(txt) {
  const m = txt.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!m) return { frontmatter: {}, body: txt }
  const fm = Object.create(null)
  for (const line of m[1].split(/\n/)) {
    const k = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/)
    if (k) fm[k[1]] = k[2]
  }
  return { frontmatter: fm, body: m[2] }
}
