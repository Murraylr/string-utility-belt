import { useEffect, useState } from 'react'
import { guideUrl, parseGuide, renderGuideHtml, type Guide } from './guide'

export type GuideState =
  | { id: string; status: 'loading' }
  | { id: string; status: 'ok'; guide: Guide; html: string }
  | { id: string; status: 'missing' }

/** Fetches and renders `/guides/<id>.md`; a missing guide (or a SPA-fallback HTML answer) is `missing`. */
export function useUtilityGuide(id: string): GuideState {
  const [state, setState] = useState<GuideState>({ id, status: 'loading' })

  useEffect(() => {
    let active = true
    fetch(guideUrl(id, import.meta.env.BASE_URL || '/'))
      .then(r => {
        // a dev server / SPA fallback answers a missing .md with index.html
        const type = r.headers?.get?.('content-type') ?? ''
        if (!r.ok || type.includes('text/html')) throw new Error('not found')
        return r.text()
      })
      .then(source => {
        if (!active) return
        const guide = parseGuide(source)
        setState({ id, status: 'ok', guide, html: renderGuideHtml(guide) })
      })
      .catch(() => { if (active) setState({ id, status: 'missing' }) })
    return () => { active = false }
  }, [id])

  // a result for the previous id is never shown while the next one loads
  return state.id === id ? state : { id, status: 'loading' }
}
