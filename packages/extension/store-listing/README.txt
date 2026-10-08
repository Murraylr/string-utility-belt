STRING UTILITY BELT: CHROME WEB STORE LISTING KIT
Captured from the extension at version 1.5.0 (the redesigned popup and options page).

LISTING COPY

Name: String Utility Belt
Short summary: short-description.txt
Full description: description.txt

UPLOAD THESE FILES

Store icon: assets/store-icon-128.png. 128 × 128 PNG with transparent padding; the extension's own toolbar icon occupies 96 × 96.
Screenshot 1: assets/01-decode-base64.png. 1280 × 800, popup, light theme
Screenshot 2: assets/02-format-json.png. 1280 × 800, popup, light theme
Screenshot 3: assets/03-change-case.png. 1280 × 800, popup, light theme
Screenshot 4: assets/04-hash-text.png. 1280 × 800, popup, dark theme
Screenshot 5: assets/05-customize-menu.png. 1280 × 800, options page with favourites and a saved pipeline
Small promo: assets/small-promo-440x280.png. 440 × 280
Marquee promo: assets/marquee-promo-1400x560.png. 1400 × 560

Screenshots and promotional tiles are 24-bit RGB PNGs without alpha. The icon is RGBA. contact-sheet.png is for review only, not upload. No promotional video is included.

DESIGN

The artwork follows the site's design (src/index.css): warm neutral surfaces, one orange accent, hairline borders, the "sub" keycap mark, Instrument Sans for text and JetBrains Mono for data. Screenshot 4 is in the dark theme to show the extension follows the system setting. The promotional tiles are brand illustrations, not product UI; their sample values are real (eyJ1c2VyIjoiYWRhIn0= decodes to {"user":"ada"}, aGVsbG8= to hello).

The store icon stays the extension's toolbar icon (public/icons/icon-512.png, the curved S), because the listing's icon must match what the installed extension shows. Changing the brand mark means new icons in packages/extension/icons and public/icons, and an extension release; this kit does not touch them.

VERIFICATION AND PROVENANCE

• Built the extension from the repository (npm run build:extension) and launched the real unpacked build in isolated Chromium, with real Chrome APIs and no UI mocks.
• Ran Base64 decoding, JSON formatting, title case and SHA-256 in the popup and asserted each result before capture.
• On the options page, trimmed the favourites to four with their Remove buttons and saved, then added a pipeline from a share link, as a user would, and asserted it was listed.
• Counted 242 distinct utilities offered in the popup and no page errors.
• The captured pages render in Instrument Sans and JetBrains Mono, the typefaces the extension names first. A browser without them installed shows its system interface font instead (Segoe UI, San Francisco and the like).
• The only change to the UI is enlarging the user-resizable JSON result box so all of the output shows.
• Checked exact PNG dimensions and colour types, and reviewed every layout by eye.

capture-verification.json records the executed examples. asset-validation.json records the PNG specifications. sources/ holds the raw captures and the self-contained HTML each asset was rendered from.

Official image guidance:
https://developer.chrome.com/docs/webstore/images

REGENERATE

From the repository root, with the Node dependencies installed and network access (the fonts come from Google Fonts at run time):

npm run build:extension
node packages/extension/store-listing/generate.mjs

Set CHROMIUM_PATH to a Chromium binary to use it instead of Playwright's own.
