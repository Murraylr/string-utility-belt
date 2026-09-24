/**
 * PWA integration surface — see repo root README/CLAUDE.md §12.1. Wire up with:
 *   - `main.tsx`: call `registerSW()` once, alongside `ReactDOM.createRoot(...)`.
 *   - `AppShell.tsx`: render `<UpdateBanner />` and `<InstallButton />` (e.g. in the header),
 *     and feed `useShareTarget()` into `<ToolProvider initialInput={...}>`.
 */
export { registerSW, onUpdateAvailable, applyUpdate } from './registerSW'
export type { RegisterSWOptions, UpdateListener } from './registerSW'
export { default as UpdateBanner } from './UpdateBanner'
export { default as InstallButton } from './InstallButton'
export { useShareTarget } from './useShareTarget'
