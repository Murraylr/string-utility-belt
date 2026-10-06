STRING UTILITY BELT — CHROME WEB STORE LISTING KIT
Prepared from the repository's extension version 1.3.0.

LISTING COPY

Name: String Utility Belt
Short summary: short-description.txt
Full description: description.txt
The existing manifest summary is unchanged. The new short summary is supplied as an optional replacement for a future extension build.

UPLOAD THESE FILES

Store icon: assets/store-icon-128.png — 128 × 128 PNG with transparent padding; the project's curved S mark occupies 96 × 96.
Screenshot 1: assets/01-decode-base64.png — 1280 × 800
Screenshot 2: assets/02-format-json.png — 1280 × 800
Screenshot 3: assets/03-change-case.png — 1280 × 800
Screenshot 4: assets/04-hash-text.png — 1280 × 800
Screenshot 5: assets/05-customize-menu.png — 1280 × 800
Small promo: assets/small-promo-440x280.png — 440 × 280
Marquee promo: assets/marquee-promo-1400x560.png — 1400 × 560

Screenshots and promotional tiles are 24-bit RGB PNGs without alpha. The icon is RGBA. contact-sheet.png is for review only, not upload. No promotional video is included.

The store kit ZIP is an asset delivery bundle, not an installable extension package. The separately existing subelt-chrome.zip was not changed.

PROJECT REVIEW

The main project is a React/TypeScript string-transformation workspace with 246 utilities and a shared execution engine. It supports visual pipelines, per-step previews, saved and shared workflows, format detection, and multiple input/output tools. The same core also powers a CLI, HTTP API, MCP server, VS Code extension, and Chrome extension.

The Chrome extension is a Manifest V3 package with plain TypeScript popup/options pages and a service worker. Its purpose is to run one transformation at a time on selected text or pasted input. It offers 242 utilities; four utilities requiring DOM, main-thread, or eval capabilities are excluded. Pipeline editing belongs to the companion web app and is identified that way in the description.

The right-click workflow replaces text in supported editable fields or attempts clipboard copy for other selections. The popup retains the latest result and shows failures. The Options page controls menu tools and the destination app URL. Only string, number, boolean, and select parameters receive popup controls; other parameter types retain their defaults.

The listing deliberately avoids blanket claims that data never leaves the device: transformations execute locally, but preferences use Chrome sync and the explicit “Open selection” action puts text in the destination URL. It also describes JWT decoding as inspection, without claiming that decoding verifies authenticity.

Brand choice: graphics use the project's established white curved S on purple. The previous blank-square extension placeholder has been replaced in the listing and in all three source extension icons (16, 48, and 128 pixels). Rebuild the extension package to include these updated icons; the existing subelt-chrome.zip has not been replaced.

VERIFICATION AND PROVENANCE

• Built the extension from the current working tree.
• All 112 extension tests passed across nine test files.
• Launched the actual unpacked extension in isolated Chromium, with real Chrome APIs and no UI mocks.
• Executed Base64 decoding, JSON formatting, title case, and SHA-256; asserted the results before capture.
• Saved a menu configuration through the real Options page.
• Verified 242 offered utilities and no page errors in the captures.
• Kept the popup UI intact; enlarged the user-resizable JSON result box to show all output. Screenshots are scaled inside editorial layouts. Promotional tiles are brand illustrations, not product UI.
• Checked exact PNG dimensions, RGB/RGBA color types, and icon padding, and visually reviewed the final layouts.

capture-verification.json records the executed examples. asset-validation.json records PNG specifications. sources/ contains the real captures and self-contained editable HTML layouts.

Official image guidance checked:
https://developer.chrome.com/docs/webstore/images

REGENERATE

From the repository root, with the existing Node dependencies and Playwright Chromium installed:

node node_modules/vite/bin/vite.js build --config packages/extension/vite.config.ts
node packages/extension/store-listing/generate.mjs

The generator creates and removes its own temporary browser profile. It embeds local Plus Jakarta Sans fonts and the existing app S icon in the layout sources, and updates the source extension icons to match. It does not alter the extension's application code or publish anything. Rebuild the extension after generation to copy the new icons into its dist directory.
