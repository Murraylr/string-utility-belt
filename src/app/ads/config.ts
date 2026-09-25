/** The AdSense publisher id — keep in step with `index.html` and `public/ads.txt`. */
export const ADSENSE_CLIENT = 'ca-pub-2227752612794222'

/** Where manual ad units may appear: content pages only, never the pipeline editor or an embed. */
export type AdPlacement = 'doc-page' | 'blog-post' | 'utilities-index'

/**
 * Display ad unit ids ("data-ad-slot") by placement, from AdSense → Ads → By ad
 * unit → Display ads (responsive). A placement without an id renders nothing;
 * Auto ads, if enabled in AdSense, work either way.
 */
export const AD_SLOTS: Record<AdPlacement, string | undefined> = {
  'doc-page': undefined,
  'blog-post': undefined,
  'utilities-index': undefined,
}
