# Security Policy

## Supported versions

Only the latest release is supported: the live site at
[stringutilitybelt.com](https://stringutilitybelt.com), the `main` branch, and the latest published
version of each package (`subelt`, `@string-utility-belt/core`, `@string-utility-belt/mcp`, the browser
extension and the VS Code extension).

## Reporting a vulnerability

**Please do not report security vulnerabilities in public issues, discussions or pull requests.**

Report them privately instead, either:

- through GitHub's [private vulnerability reporting](https://github.com/Murraylr/string-utility-belt/security/advisories/new), or
- by email to [contact@stringutilitybelt.com](mailto:contact@stringutilitybelt.com) with "Security" in the subject.

Include what is affected (site, HTTP API, a package or an extension), the steps or a proof of concept
to reproduce it, and the impact you expect. You can expect an acknowledgement within a few days and
updates as the fix progresses. Once a fix has shipped we are happy to credit you in the release notes,
unless you would rather stay anonymous.

## Scope

Areas we are particularly interested in:

- Script execution in the app's origin from a crafted share (`#/p/…`) or embed (`#/embed/…`) link,
  including any way around the quarantine of custom JavaScript steps or the sandbox they run in.
- The HTTP API in [`worker/`](worker/): server-side request forgery through `GET /api/fetch`, or
  bypassing the rate limits and per-request budgets of `POST /api/run`.
- Escaping the child-process isolation of the MCP server, or the browser extension acting on pages or
  data beyond what the user asked for.

Out of scope: denial of service by sheer request volume, automated scanner output without a
demonstrated impact, missing security headers without an exploit, and issues that require an already
compromised device or browser.
