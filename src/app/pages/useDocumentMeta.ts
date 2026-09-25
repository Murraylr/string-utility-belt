import { useEffect } from 'react'

/**
 * Sets the tab title and meta description while mounted; restores the previous
 * ones after. Google indexes the rendered page, so pass the same strings the
 * pre-render (`scripts/seo/build.ts`) writes into that page's `<head>`.
 */
export function useDocumentMeta(title: string, description?: string) {
  useEffect(() => {
    const prevTitle = document.title
    document.title = title
    if (description === undefined) return () => { document.title = prevTitle }
    let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const created = !tag
    if (!tag) {
      tag = document.createElement('meta')
      tag.setAttribute('name', 'description')
      document.head.appendChild(tag)
    }
    const prevContent = tag.getAttribute('content')
    tag.setAttribute('content', description)
    return () => {
      document.title = prevTitle
      if (created) tag.remove()
      else if (prevContent === null) tag.removeAttribute('content')
      else tag.setAttribute('content', prevContent)
    }
  }, [title, description])
}
