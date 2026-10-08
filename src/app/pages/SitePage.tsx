import React, { useEffect, useMemo } from 'react'
import { scrollToFragment, type SitePageSlug } from '@/lib/router'
import { writePref } from '@/app/prefs'
import { INTEGRATIONS_SEEN_PREF } from '@/app/integrations/links'
// Vite `?raw` imports: the same markdown `scripts/seo/build.ts` pre-renders into /<slug>/
import about from './content/about.md?raw'
import privacy from './content/privacy.md?raw'
import contact from './content/contact.md?raw'
import integrations from './content/integrations.md?raw'
import advertise from './content/advertise.md?raw'
import { parseSitePage } from './sitePages'
import { useDocumentMeta } from './useDocumentMeta'
import { pageTitle } from './seo'

const SOURCES: Record<SitePageSlug, string> = { about, privacy, contact, integrations, advertise }

/** About, privacy policy, contact, integrations and advertise: static markdown pages in the site chrome. */
export default function SitePage({ slug }: { slug: SitePageSlug }) {
  const page = useMemo(() => parseSitePage(SOURCES[slug]), [slug])
  useDocumentMeta(pageTitle(page.title), page.description)
  // this page renders after navigation (a lazy chunk), so it opens its own #section
  useEffect(() => { scrollToFragment() }, [page.html])
  // the header's integrations group stops marking itself new once its page is read
  useEffect(() => { if (slug === 'integrations') writePref(INTEGRATIONS_SEEN_PREF, true) }, [slug])

  return (
    // w-full + min-w-0, as for blog posts: keeps a long code span or table inside the grid track;
    // the leading `# heading` would otherwise keep `.md-h1`'s top margin
    <article className="md w-full max-w-3xl mx-auto card p-6 min-w-0 [&>div>:first-child]:mt-0">
      {/* trusted: renderMarkdownDocument escapes every character of the source */}
      <div dangerouslySetInnerHTML={{ __html: page.html }} />
    </article>
  )
}
