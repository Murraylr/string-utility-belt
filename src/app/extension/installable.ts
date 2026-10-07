/** The slice of `navigator` that says which browser this is. */
interface UaNavigator { userAgentData?: { mobile?: boolean } }

/**
 * The browser can install the extension from the Chrome Web Store: a desktop Chromium
 * browser (Chrome, Edge, Brave, Opera…). Only Chromium exposes `navigator.userAgentData`,
 * and its `mobile` flag rules out Chrome on Android, which has no extensions. Firefox and
 * Safari answer false, so they are never offered a store they cannot install from.
 */
export function canInstallExtension(nav: UaNavigator | undefined = globalThis.navigator as UaNavigator | undefined): boolean {
  return nav?.userAgentData?.mobile === false
}
