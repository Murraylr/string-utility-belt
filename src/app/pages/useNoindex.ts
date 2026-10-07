import { useEffect } from 'react'

/**
 * Keeps the current page out of search indexes while mounted. For "not found"
 * states: the host answers unknown paths with index.html and a 200 (an SPA
 * fallback), so without this every mistyped URL would be indexed as a copy of
 * another page.
 */
export function useNoindex(): void {
  useEffect(() => {
    let tag = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
    const created = !tag
    if (!tag) {
      tag = document.createElement('meta')
      tag.name = 'robots'
      document.head.appendChild(tag)
    }
    const prev = tag.content
    tag.content = 'noindex'
    return () => { if (created) tag.remove(); else tag.content = prev }
  }, [])
}
