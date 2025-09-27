import React from 'react'
export default function BlogPost({ slug }: { slug: string }) {
  return (
    <article className="card p-6">
      <h1 className="text-xl font-semibold mb-2">Post: {slug}</h1>
      <p className="text-sm text-gray-500">Content coming soon.</p>
    </article>
  )
}
