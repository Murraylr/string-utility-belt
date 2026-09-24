import { useTool } from '@/app/ToolContext'
import { usePref } from '@/app/prefs'
import LargeInputBanner from './LargeInputBanner'

const WHERE_LABEL: Record<string, string> = { main: 'main thread', worker: 'worker', chunked: 'chunked' }

/** `.btn` has no pressed look of its own; without this the active mode is only in the a11y tree. */
const TOGGLE = 'btn aria-pressed:bg-primary-600 aria-pressed:border-primary-600 aria-pressed:text-white aria-pressed:hover:bg-primary-700'

/** Compact toolbar group for the engine: live/manual mode, a manual Run button, the
 * "preview first 64 KB" toggle, and a status chip for where/how long the last run took. */
export default function EngineControls() {
  const { liveRun, setLiveRun, run } = useTool()
  const [previewLimit, setPreviewLimit] = usePref('previewLimit', false)
  // Run always runs the full input, so it is useful in live mode too whenever the
  // live result is only a prefix, or live runs are paused by the size guard
  const runUseful = !liveRun || run.partial || !!run.largeInput?.paused

  return (
    <div className="flex flex-wrap items-center gap-3" role="group" aria-label="engine controls">
      <div className="inline-flex items-center gap-1" role="group" aria-label="run mode">
        <button type="button" className={TOGGLE} aria-pressed={liveRun} onClick={() => setLiveRun(true)}>Live</button>
        <button type="button" className={TOGGLE} aria-pressed={!liveRun} onClick={() => setLiveRun(false)}>Manual</button>
      </div>
      <button
        type="button"
        className="btn"
        disabled={!runUseful}
        title="Run the pipeline on the full input now (Ctrl+Enter)"
        onClick={run.runNow}
      >
        Run
      </button>
      <label className="text-sm flex items-center gap-2">
        <input type="checkbox" checked={previewLimit} onChange={e => setPreviewLimit(e.target.checked)} />
        preview first 64 KB
      </label>
      {run.where && (
        <span className="chip" title={`ran on the ${WHERE_LABEL[run.where] ?? run.where} in ${run.ms.toFixed(0)}ms`}>
          {WHERE_LABEL[run.where] ?? run.where}{run.partial ? ' · partial' : ''} · {run.ms.toFixed(0)}ms
        </span>
      )}
      <LargeInputBanner />
    </div>
  )
}
