import React, { useEffect, useState } from 'react'
export default function BlogIndex() {
  const [posts, setPosts] = useState([])
  useEffect(() => { fetch('/blog/_manifest.json').then(r=>r.json()).then(setPosts).catch(()=>setPosts([])) }, [])
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Blog</h1>
      <ul className="space-y-4">
        {posts.map(p => (
          <li key={p.slug} className="p-4 rounded-xl bg-white border">
            <a className="text-lg font-medium hover:underline" href={`#/blog/${p.slug}`}>{p.title}</a>
            <div className="text-sm text-gray-500">{p.date}</div>
            {p.description && <p className="text-sm mt-1 text-gray-700">{p.description}</p>}
          </li>
        ))}
        {posts.length===0 && <li className="text-sm text-gray-500">No posts yet.</li>}
      </ul>
    </div>
  )
}
