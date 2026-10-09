STRING UTILITY BELT: CHROME WEB STORE LISTING KIT
Captured from the extension at the version capture-verification.json records, with the website built from the same checkout.

LISTING COPY

Name: String Utility Belt
Short summary: short-description.txt
Full description: description.txt

UPLOAD THESE FILES

Store icon: assets/store-icon-128.png. The extension's own 128 px icon: the keycap mark on a 96 × 96 tile in a 16 px transparent margin.
Screenshot 1: assets/01-build-a-pipeline.png. A pipeline on the website, with a run-on-each step and a preview after every step
Screenshot 2: assets/02-save-whole-pipeline.png. The website's "Save to extension" dialog, after saving the whole pipeline
Screenshot 3: assets/03-right-click-any-selection.png. The right-click menu on a selection, with the saved pipeline in it
Screenshot 4: assets/04-every-step-one-click.png. The toolbar popup running the saved pipeline
Screenshot 5: assets/05-private-by-design.png. The toolbar popup in the dark theme
Small promo: assets/small-promo-440x280.png. 440 × 280
Marquee promo: assets/marquee-promo-1400x560.png. 1400 × 560

Screenshots are 1280 × 800. Screenshots and promotional tiles are 24-bit RGB PNGs without alpha; the icon is RGBA. contact-sheet.png is for review only, not upload. No promotional video is included.

THE STORY

The five screenshots follow one pipeline, "Tidy an email list" (on each line: trim, then lower case; then dedupe lines; then sort lines), from the website to the extension: built with a preview after every step, saved whole with one click, offered on the right-click menu, run from the popup. The fifth shows the extension works on the device, in either theme. These are the things single-purpose text extensions don't do.

DESIGN

The artwork follows the site's design (src/index.css): warm neutral surfaces, one orange accent, hairline borders, Instrument Sans for text and JetBrains Mono for data. The brand mark is the "sub" keycap on an accent tile, drawn by scripts/icons.ts, which also makes the extension's and the website's icons, so the listing, the toolbar and the site all show the same mark.

VERIFICATION AND PROVENANCE

• Builds the website from this checkout with the unpacked extension's id added (VITE_EXTENSION_IDS), and serves it at https://stringutilitybelt.com inside the capture browser, so the extension's "save to extension" bridge answers it exactly as it answers the live site.
• Launches the real unpacked extension in isolated Chromium, with real Chrome APIs and no UI mocks.
• On the website: loads the pipeline, enters a messy email list and asserts the result before capture.
• Saves the pipeline through the website's own dialog and asserts the extension's answer; then finds it in the popup's "Saved pipelines", runs it on the same list and asserts the same result; and finds it on the options page.
• Hashes a string with SHA-256 in the dark-theme popup and asserts the digest.
• Counts the distinct utilities the popup offers (242) and fails on any page error.
• The right-click menu is Chrome's own and can't be captured from a page, so screenshot 3 and the promo tiles draw it, with the exact items the extension created for this setup (its favourites, the saved pipeline, "Open selection in String Utility Belt"), read back from the extension's storage. capture-verification.json lists them.
• The captured pages render in Instrument Sans and JetBrains Mono, the typefaces the site and the extension name first. A browser without them installed shows its system interface font in the extension instead (Segoe UI, San Francisco and the like).
• Screenshot 1 shows the top of the pipeline, fading out below the run-on-each step: the whole timeline is too tall to read at store size.
• Checked exact PNG dimensions and colour types, and reviewed every layout by eye.

capture-verification.json records every executed example and the menu. asset-validation.json records the PNG specifications. sources/ holds the raw captures and the self-contained HTML each asset was rendered from.

Official image guidance:
https://developer.chrome.com/docs/webstore/images

REGENERATE

From the repository root, with the Node dependencies installed and network access (the fonts come from Google Fonts at run time):

npm run build:extension
node packages/extension/store-listing/generate.mjs

The script builds the website itself, into a temporary folder. Set CHROMIUM_PATH to a Chromium binary to use it instead of Playwright's own.
