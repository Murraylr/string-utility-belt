import { useTool } from '@/app/ToolContext'

/**
 * Also shown while an untrusted main-thread-only pipeline is held (`ToolApi.runHeld`).
 * Shown while the size guard is holding back live runs (see `useRunner`'s
 * `largeInput`): either paused outright, or — with "preview first 64 KB" on —
 * live-previewing only a prefix. Either way, Run gives the full result.
 * The live region itself is always mounted (visually hidden when idle): text
 * injected together with a brand-new live region is not reliably announced.
 */
export default function LargeInputBanner() {
  const { run, runHeld } = useTool()
  const large = run.largeInput
  const show = runHeld || (!!large && (large.paused || run.partial))
  return (
    <div
      role="status"
      className={show ? 'card flex flex-wrap items-center justify-between gap-3 px-3 py-2' : 'sr-only'}
    >
      {runHeld && (
        <>
          <span>
            This shared pipeline has a step that runs on the page itself, not in the background worker —
            it waits for you to review it before it runs.
          </span>
          <button type="button" className="btn" onClick={run.runNow}>Run</button>
        </>
      )}
      {!runHeld && show && large && (
        <>
          <span>
            Large input ({(large.size / (1024 * 1024)).toFixed(1)} MB) —{' '}
            {large.paused ? 'live preview paused' : 'live preview shows the first 64 KB'}
          </span>
          <button type="button" className="btn" onClick={run.runNow}>Run full input</button>
        </>
      )}
    </div>
  )
}
