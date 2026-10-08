import { Play } from 'lucide-react'
import { useTool } from '@/app/ToolContext'
import { usePref } from '@/app/prefs'
import LargeInputBanner from './LargeInputBanner'

/** The pressed mode is raised by `.segmented`; Live also lights its dot. */
const MODE = 'flex items-center gap-1.5 aria-pressed:text-fg'

/** Compact toolbar group for the engine: the "first 64 KB" live-preview limit, live/manual
 * mode and a Run button. Where and how long the last run took is shown on the output panel. */
export default function EngineControls() {
  const { liveRun, setLiveRun, run } = useTool()
  const [previewLimit, setPreviewLimit] = usePref('previewLimit', false)
  // Run always runs the full input, so it is useful in live mode too whenever the
  // live result is only a prefix, or live runs are paused by the size guard
  const runUseful = !liveRun || run.partial || !!run.largeInput?.paused

  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="engine controls">
      <label className="btn-ghost cursor-pointer" title="Run live on the first 64 KB only. Run always uses the whole input.">
        <input type="checkbox" checked={previewLimit} onChange={e => setPreviewLimit(e.target.checked)} />
        First 64 KB
      </label>
      <div className="segmented ml-1" role="group" aria-label="run mode">
        <button type="button" className={MODE} aria-pressed={liveRun} onClick={() => setLiveRun(true)}>
          <span aria-hidden="true" className={`size-1.5 rounded-full ${liveRun ? 'bg-acc' : 'bg-line-2'}`} />
          Live
        </button>
        <button type="button" className={MODE} aria-pressed={!liveRun} onClick={() => setLiveRun(false)}>Manual</button>
      </div>
      <button
        type="button"
        className="btn h-7 px-2.5 text-[12.5px] ml-0.5"
        disabled={!runUseful}
        title="Run the whole input now (Ctrl+Enter)"
        onClick={run.runNow}
      >
        <Play size={12} aria-hidden="true" />
        Run
      </button>
      {/* the banner takes a row of its own; while idle it is only a hidden live region */}
      <div className="basis-full has-[>.sr-only]:basis-auto">
        <LargeInputBanner />
      </div>
    </div>
  )
}
