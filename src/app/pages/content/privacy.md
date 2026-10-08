---
title: Privacy Policy
description: How String Utility Belt handles data: your text is processed in your browser, and Google Analytics measures visits to the site. Your choices explained.
---

# Privacy Policy

*Last updated: 8 October 2026*

String Utility Belt ("we", "us") runs the website at stringutilitybelt.com and publishes the String Utility Belt browser extension, VS Code extension, command-line tool (`subelt`), MCP server and code library. This policy explains what information is collected when you use the site or these tools, why, and the choices you have. Questions about it can be sent to [contact@stringutilitybelt.com](mailto:contact@stringutilitybelt.com).

## The short version

- The text, files and pipelines you work with are processed **in your browser**. They are not uploaded to our servers, except as described under "Features that contact our server".
- We use **Google Analytics** to understand how the site is used. Outside the European Economic Area, the UK and Switzerland it uses cookies; inside them it runs without cookies.
- The site loads **no advertising scripts**. A sponsor's message, where a page shows one, is part of the page itself: it runs no code, sets no cookies and never sees what you type.
- There are no user accounts, and we do not sell your personal information.
- The browser extension, VS Code extension, command-line tool, MCP server and library run on your own device. They contain no analytics or ads and do not send your text anywhere, except when you choose to open text in the website (see "Browser and editor extensions and developer tools").

## Data that stays on your device

Every transformation runs locally in your browser. To keep your work between visits, the site stores your current pipeline (including the settings and any files you add to its steps), your saved pipelines library, a history of your recent inputs and your preferences (theme, language, favourite and recently used utilities) in your browser's own storage (localStorage, sessionStorage and IndexedDB). This data never leaves your device and we cannot see it. You can delete it at any time by clearing this site's data in your browser settings.

If you install the site as an app, its service worker keeps a copy of the site's own files on your device so that it also works offline.

## Share links

When you create a share link, your pipeline (and your input, if you choose to include it) is compressed into the part of the link after the `#`. Browsers do not send that part of a web address to the server, so we never receive it. Anyone you give the link to can read what it contains, so only include input you are happy to share.

## Features that contact our server

- **Fetching a web address.** When you load input from a URL, your browser first tries to fetch it directly. If the other site does not allow that, the request goes through our fetch proxy, which retrieves the address on your behalf and passes the response back to you. The proxy sees the address you requested and your IP address; it does not keep the content it fetches.
- **The public API.** Developers can send text to our HTTP API to run a pipeline. Requests are processed in memory and are not stored.
- **Text sent to the site in its web address.** When you share text into the installed app from your device's share menu, or use the browser extension's "Open in String Utility Belt", the text is placed in the page address (`?text=…`), so it is sent to our host along with the request for the page, and may appear in the short-lived operational logs described next. The site then processes it in your browser like any other input. Our analytics never report it: only the page path and campaign tags are sent to Google Analytics.

To protect the fetch proxy and the API from abuse, your IP address is used for rate limiting. It is held briefly in memory and is not written to storage. Requests to them, and page requests that carry text in their address, may also appear in short-lived operational logs (for example the requested address, the time and the response status), which we use only to keep the service running and secure, and which are deleted automatically.

The site is hosted by Cloudflare, which processes every request to deliver the site and protect it from attacks. See [Cloudflare's privacy policy](https://www.cloudflare.com/privacypolicy/).

## Browser and editor extensions and developer tools

### Browser extension

The String Utility Belt extension for Chrome, Edge and other browsers runs every transformation inside the extension, on your device.

- **Text it reads.** It reads the text you have selected (or the text field you right-clicked) only when you choose one of its menu items, and only to transform it. It never reads password fields.
- **Where results go.** The result replaces your selection in the page, or is copied to your clipboard when it cannot be inserted.
- **What it stores.** Your favourite utilities and the website address it opens are kept in your browser's extension storage, which your browser may sync between your devices if you have turned on browser sync. Pipelines you save to it (their steps and settings, and the name you give them) are kept only on your device. The last result it could not insert (or the input of a failed run) is kept on your device so the toolbar popup can show it, until it is replaced by the next one. Removing the extension deletes all of this.
- **Saving from the website.** The extension accepts messages from stringutilitybelt.com, and from no other site, so the site's "save to extension" buttons (in the pipeline editor and on recipe pages) can hand it a pipeline or your starred utilities, and can tell whether the extension is installed in order to offer those buttons, or a link to install it. This happens inside your browser: nothing is sent to our server, and the extension does not read the site's pages. The extension's options page can open a saved pipeline in the website: its steps are placed after the `#` in the address, a part browsers do not send to the server.
- **Network.** The extension makes no network requests and contains no analytics, ads or tracking. The one exception is "Open in String Utility Belt", which opens the website in a new tab with your selected text in the address, as described under "Features that contact our server"; from then on the website's own practices in this policy apply.
- **Permissions.** It asks for the context menu (to add its right-click items), storage (for the settings above), access to the active tab and scripting (to read and replace the selection in the page you are using, only when you pick a menu item), and clipboard writing (to copy results).

The extension does not sell or transfer your data to anyone, and uses it for nothing other than the transformation you chose.

### VS Code extension, command-line tool, MCP server and library

These run entirely on your computer, on the text you give them, and make no network requests. They contain no analytics, telemetry or ads. The only thing any of them keeps is the VS Code extension's list of your recently used utilities, stored by VS Code on your computer. The MCP server only receives what the AI application you connect it to sends it, and returns results only to that application.

## Cookies and analytics

### Google Analytics

We use Google Analytics to count visits and see which pages and tools are used, so we know what to improve. It uses cookies (such as `_ga`) to tell visits apart and collects information such as the pages you view, how long you stay, the site that referred you, your browser and device type, and your approximate location. It also records which features you use, for example which utilities you add to a pipeline, how large your input is (as a rough size range), that you copied or downloaded a result, copied a command-line or AI agent snippet, or followed a sponsor's link, or what you typed into a utility search box. It never records the text, files or share links you work with: a shared pipeline is reported only as "a shared pipeline". To tell people from automated traffic, the site notes whether a visit showed real mouse, keyboard or touch input, and remembers that on your device. With Google signals turned on, Google also associates this data with your Google account if you are signed in and have allowed ads personalization, which gives us aggregate reports on visitors' age range, gender and interests; you can stop this in [Google's Ads Settings](https://adssettings.google.com/). We only look at this information in aggregate. Google Analytics keeps it for 14 months, after which only aggregated totals remain. We also export it daily to Google BigQuery, Google's cloud database, in our own Google Cloud project in the United States, so we can analyse it; that copy is deleted after 14 months too. You can prevent Google Analytics from recognising your visits with the [Google Analytics opt-out browser add-on](https://tools.google.com/dlpage/gaoptout).

### Google Fonts

The site's typefaces are loaded from Google Fonts. To download them, your browser sends your IP address and browser details to Google. Google Fonts does not set cookies.

## Your choices and consent

- **In the European Economic Area, the UK and Switzerland**, Google Analytics sets no cookies. Google receives only cookieless measurements (the page, the time, your browser and device type, and an approximate location derived from your IP address), with no identifier that persists between visits. The site shows no consent message, so this does not change.
- **Everywhere**, you can block or delete cookies in your browser settings, or use the opt-out add-on above. The tools keep working without cookies.
- **In some US states**, you may have the right to opt out of the "sale" or "sharing" of personal information for targeted advertising. We do not sell personal information for money. To stop Google using your visits for personalised ads, use [Google's Ads Settings](https://adssettings.google.com/) as described above.

## Your rights

Depending on where you live (for example under the GDPR or the UK GDPR), you may have the right to access, correct or delete personal data about you, to restrict or object to its processing, and to withdraw consent at any time. Because the site has no accounts and keeps your tool data on your own device, we usually hold no personal data that identifies you. For data collected by Google, see [Google's privacy policy](https://policies.google.com/privacy), which also explains how to exercise your rights with Google. You can contact us with any request, and you can complain to your local data protection authority.

We process data on the basis of our legitimate interest in understanding how the site is used (analytics, without cookies where the law requires consent for them) and in running a secure and reliable service (rate limiting and operational logs).

## Children

The site is not directed at children under 13, and we do not knowingly collect personal information from them.

## Changes to this policy

We may update this policy when the site or the law changes. The date at the top shows when it was last revised.

## Contact

Email [contact@stringutilitybelt.com](mailto:contact@stringutilitybelt.com), or see the [contact page](/contact/).
