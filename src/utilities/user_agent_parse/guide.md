---
title: User Agent Parser: Browser, OS and Bot Detector Online
description: Parse a user-agent string into browser, engine, OS, device and CPU details online, and flag bots, crawlers and command-line clients.
---
## What is a user-agent string?

Every HTTP request from a browser, app or script carries a `User-Agent` header describing what sent it, something like `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ... Chrome/117.0.0.0 Safari/537.36`. The format is a historical accident (every browser claims to be "Mozilla" for backward compatibility), so reading one by eye is unreliable. This tool parses a user-agent string into structured fields (browser, rendering engine, operating system, device and CPU) and flags whether it looks like a bot, crawler or scripted client rather than a real browser.

## How it works

Paste a user-agent string and get back browser name and version, engine, OS, device type, and CPU architecture:

```example
title: desktop Chrome on Windows
input: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36
output:
{
  "browser": {
    "name": "Chrome",
    "version": "117.0.0.0",
    "major": "117",
    "type": null
  },
  "engine": {
    "name": "Blink",
    "version": "117.0.0.0"
  },
  "os": {
    "name": "Windows",
    "version": "10"
  },
  "device": {
    "type": "desktop",
    "vendor": null,
    "model": null
  },
  "cpu": {
    "architecture": "amd64"
  },
  "isBot": false
}
```

`device.type` isn't reported by the underlying parser for ordinary desktop browsers, so this tool fills in `"desktop"` itself whenever a real browser and OS were both identified and the string doesn't otherwise look automated. Mobile, tablet, smart TV and other device types are left exactly as detected.

Known crawlers and bots are recognized directly, with `browser.type` naming the category:

```example
title: a crawler
input: Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)
output:
{
  "browser": {
    "name": "Googlebot",
    "version": "2.1",
    "major": "2",
    "type": "crawler"
  },
  "engine": {
    "name": null,
    "version": null
  },
  "os": {
    "name": null,
    "version": null
  },
  "device": {
    "type": null,
    "vendor": null,
    "model": null
  },
  "cpu": {
    "architecture": null
  },
  "isBot": true
}
```

Command-line HTTP clients are recognized the same way. `isBot` is `true` for tools like `curl`, `wget`, `python-requests` and headless browsers, not just search engine crawlers, since they represent scripted traffic rather than a person browsing:

```example
title: a command-line client is flagged as a bot too
input: curl/8.4.0
output:
{
  "browser": {
    "name": "curl",
    "version": "8.4.0",
    "major": "8",
    "type": "cli"
  },
  "engine": {
    "name": null,
    "version": null
  },
  "os": {
    "name": null,
    "version": null
  },
  "device": {
    "type": null,
    "vendor": null,
    "model": null
  },
  "cpu": {
    "architecture": null
  },
  "isBot": true
}
```

An empty or unrecognized string never throws. Every field simply comes back `null` (with `isBot: false`):

```example
title: empty input returns every field as null
input:
output:
{
  "browser": {
    "name": null,
    "version": null,
    "major": null,
    "type": null
  },
  "engine": {
    "name": null,
    "version": null
  },
  "os": {
    "name": null,
    "version": null
  },
  "device": {
    "type": null,
    "vendor": null,
    "model": null
  },
  "cpu": {
    "architecture": null
  },
  "isBot": false
}
```

## Fields returned

- **browser**: `name`, `version`, `major` (the version's leading number), and `type`: `crawler`, `cli`, `fetcher` or `library` for automated clients, `inapp`, `email` or `mediaplayer` for browsers embedded in other apps (the Facebook app's in-app browser reports `inapp`), or `null` for an ordinary browser.
- **engine**: the rendering engine `name` (`Blink`, `Gecko`, `WebKit`, …) and its `version`.
- **os**: operating system `name` and `version`.
- **device**: `type` (`mobile`, `tablet`, `smarttv`, `console`, `wearable`, `embedded`, `xr`, `desktop`, or `null`), plus `vendor` and `model` when the string identifies specific hardware (phones and tablets usually do; desktops don't).
- **cpu**: `architecture` (`amd64`, `arm64`, …) when the string exposes it.
- **isBot**: `true` for any recognized crawler, scraper, headless browser, or command-line/HTTP-library client.

This utility takes no parameters. Every result comes from the input string alone.

## Common uses

- Server-side or log-analysis analytics that need to break traffic down by browser, OS or device without a client-side script.
- Filtering bots and scripted clients out of analytics or rate-limiting logic.
- Feature-detecting on the server (serving a different asset to old browsers, for instance) before any client-side JavaScript runs.
- Debugging a support ticket by decoding the exact browser and OS combination a user reported.

## Tips and pitfalls

- A user-agent string is entirely client-supplied and trivially spoofable. Treat `isBot` and the parsed browser/OS as a signal for analytics and UX decisions, never as a security control.
- Chromium-based browsers now send a reduced user-agent string on purpose: minor versions are zeroed (`Chrome/117.0.0.0`), Android reports `Android 10; K` with no device model, and OS versions are frozen. Windows 11 still says `Windows NT 10.0`, so a result of Windows 10 may really be Windows 11. The finer detail moved to User-Agent Client Hints (`Sec-CH-UA-*` request headers), which this tool does not read, so a generic-looking result may reflect the browser rather than a parsing gap.
- A device name that merely contains the letters "bot" (phones from the Cubot brand, for example) is deliberately not flagged as a crawler. The bot heuristics look for word boundaries and known client signatures, not a bare substring match.
- User-Agent is just another HTTP header: to pull it out of a captured request's raw header block first, use [http headers to json](/util/http_headers_parse/).
