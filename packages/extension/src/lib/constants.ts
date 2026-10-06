import { EXTENSION_UNSUPPORTED_ENV } from '../../../../src/core/extensionBridge'

/** Utilities offered on the context menu until the user customizes the list in options. */
export const DEFAULT_MENU_UTILITIES: readonly string[] = [
  'base64_decode',
  'base64_encode',
  'url_decode',
  'url_encode',
  'jwt_decode',
  'json_pretty',
  'case',
  'trim',
  'unescape_html',
  'sha3',
]

/** Where "Open selection in String Utility Belt" opens; the app reads `?text=`. */
export const DEFAULT_BASE_URL = 'https://stringutilitybelt.com'

/** Utility capabilities the extension refuses: no DOM in the service worker, no main thread, no eval. */
export const UNSAFE_ENV: ReadonlySet<string> = EXTENSION_UNSUPPORTED_ENV

export const MENU_ROOT_ID = 'subelt-root'
export const MENU_SEPARATOR_ID = 'subelt-separator'
export const MENU_OPEN_ID = 'subelt-open-in-app'
export const MENU_PIPELINES_SEPARATOR_ID = 'subelt-pipelines-separator'
export const APPLY_PREFIX = 'subelt-apply:'
export const RUN_PREFIX = 'subelt-run:'
