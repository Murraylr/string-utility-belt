import React, { useCallback, useId, useMemo } from 'react'
import { CornerLeftUp, Download, PanelBottom, PanelRight } from 'lucide-react'
import { asText, formatForDisplay, isBytes, valueType } from '@/core/coerce'
import type { Value } from '@/types/utility'
import CopyAsMenu from '@/components/CopyAsMenu'
import DiffView from '@/app/io/DiffView'
import { pickDownload, triggerDownload } from '@/app/io/download'
import OutputView from '@/app/io/OutputView'
import StatsBar from '@/app/io/StatsBar'
import { useTool } from '@/app/ToolContext'
import { sizeBucket, trackInput, trackPipelineEvent, valueSize } from '@/app/analytics/analytics'
import { useIOLayout, useOutputDiff } from './ioLayout'

const TYPE_LABEL = { string: 'text', json: 'json', bytes: 'bytes' } as const

/** Beside the steps the output fits the window; below them it gets a fixed cap. */
const MAX_HEIGHT = { beside: 'calc(100vh - 330px)', below: '560px' } as const

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

/**
 * The pipeline's final value: result or diff view, run status, stats, copy-as, a
 * smart-named download and "use as input".
 */
export default function OutputPanel() {
  const { run, input, setInput, state, liveRun } = useTool()
  const [layout, setLayout] = useIOLayout()
  const [showDiff, setShowDiff] = useOutputDiff()
  const headingId = useId()
  const beside = layout === 'side-by-side'
  const maxHeight = beside ? MAX_HEIGHT.beside : MAX_HEIGHT.below
  // before the first run completes, show the input rather than a flash of nothing
  const value = run.result ? run.result.out : input
  // bytes render from the raw value (hex / lossy text); their debug display string can be huge
  const text = useMemo(() => (isBytes(value) ? '' : formatForDisplay(value)), [value])
  const failedSteps = run.result ? Object.keys(run.result.err).length : 0
  const hasSteps = state.steps.length > 0

  const download = useCallback(() => {
    const plan = pickDownload(value, state.name)
    triggerDownload(plan)
    trackPipelineEvent('output_download', state.steps, { file_type: plan.mime, output_size: sizeBucket(valueSize(value)) })
  }, [value, state.name, state.steps])

  const onCopy = useCallback((format: string) => {
    trackPipelineEvent('output_copy', state.steps, { format, output_size: sizeBucket(valueSize(value)) })
  }, [value, state.steps])

  const useAsInput = () => {
    setInput(value)
    trackInput('output', value)
  }

  const layoutLabel = beside ? 'Show the output below the steps' : 'Show the output beside the steps'
  const LayoutIcon = beside ? PanelBottom : PanelRight

  return (
    <div className="grid gap-3 min-w-0">
      <section aria-labelledby={headingId} className="card min-w-0">
        <div className="flex flex-wrap items-center gap-2 pl-3.5 pr-1.5 min-h-10 border-b">
          <h2 id={headingId} className="m-0 text-[13px] font-semibold">Output</h2>
          <span className="font-mono text-[11px] text-muted">{TYPE_LABEL[valueType(value)]}</span>
          {/* status only: the result itself is not live, re-reading it on every keystroke would drown a screen reader */}
          <span role="status" className={`font-mono text-[11px] pl-1 ${failedSteps && !run.running ? 'text-danger' : 'text-muted'}`}>
            {run.running ? 'running…' : hasSteps && failedSteps ? `${plural(failedSteps, 'step')} failed` : ''}
          </span>
          {!run.running && hasSteps && run.result && !failedSteps && !run.failure && (
            <span className="font-mono text-[11px] text-muted">
              {liveRun ? 'live' : 'ran'} · {run.ms < 1 ? '<1' : Math.round(run.ms)} ms
            </span>
          )}
          {run.result && run.partial && (
            <span className="font-mono text-[10.5px] px-1.5 border border-warn rounded-[4px] text-warn"
              title="Live runs only read the first 64 KB of the input, so copy and download give this partial result too. Run uses the whole input.">
              first 64 KB only
            </span>
          )}
          <div className="flex-1" />
          <div className="segmented" role="group" aria-label="Output view">
            <button type="button" aria-pressed={!showDiff} onClick={() => setShowDiff(false)}>Result</button>
            <button type="button" aria-pressed={showDiff} onClick={() => setShowDiff(true)} title="Compare the output with the input">Diff</button>
          </div>
          <button type="button" className="icon-btn min-w-7 min-h-7 p-1" aria-label={layoutLabel} title={layoutLabel}
            onClick={() => setLayout(beside ? 'stacked' : 'side-by-side')}>
            <LayoutIcon size={15} aria-hidden />
          </button>
        </div>

        {run.failure && (
          <div role="alert" className="px-3.5 py-2 text-[12.5px] text-danger-ink bg-danger-bg border-b border-danger-line">{run.failure}</div>
        )}

        {showDiff
          ? <InputOutputDiff input={input} output={value} maxHeight={maxHeight} />
          : (
            <div role="region" aria-label="Result">
              <OutputView value={value} text={text} label="Result" maxHeight={maxHeight} />
            </div>
          )}

        <div className="flex items-center px-3.5 py-1 min-h-[30px] border-t bg-canvas rounded-b-lg">
          <StatsBar value={value} />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-1.5">
        <CopyAsMenu value={value} label="Copy" onCopy={onCopy} />
        <button type="button" className="btn" onClick={download}>
          <Download size={14} aria-hidden /> Download
        </button>
        <div className="flex-1" />
        <button type="button" className="btn-ghost h-8 px-2.5" onClick={useAsInput} disabled={value === input}
          title="Replace the input with this output">
          <CornerLeftUp size={14} aria-hidden /> Use as input
        </button>
      </div>
    </div>
  )
}

/** Only mounted while the diff is visible, so hidden diffs cost nothing per keystroke. */
function InputOutputDiff({ input, output, maxHeight }: { input: Value; output: Value; maxHeight: string }) {
  const before = useMemo(() => asText(input), [input])
  const after = useMemo(() => asText(output), [output])
  return <DiffView before={before} after={after} maxHeight={maxHeight} />
}
