/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Comma-separated ids of unpacked browser-extension builds to try after the store one (see src/app/extension/bridge.ts). */
  readonly VITE_EXTENSION_IDS?: string
}
