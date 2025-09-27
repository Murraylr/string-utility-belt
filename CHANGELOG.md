# Changelog

## 1.4.12
- Added secure sandbox runner for custom functions (Web Worker based, 800ms timeout).
- Custom function errors or timeouts no longer crash UI, safely fall back to original input.
- Blocked dangerous APIs (fetch, WebSocket, importScripts, etc) inside sandbox.
