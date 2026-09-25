import React, { useCallback, useId, useMemo } from 'react'
import { Download } from 'lucide-react'
import { formatForDisplay, isBytes } from '@/core/coerce'
import CopyAsMenu from '@/components/CopyAsMenu'
import { pickDownload, triggerDownload } from '@/app/io/download'
import OutputView from '@/app/io/OutputView'
import StatsBar from '@/app/io/StatsBar'
import { useTool } from '@/app/ToolContext'
import { sizeBucket, trackPipelineEvent, valueSize } from '@/app/analytics/analytics'

/** The pipeline's final value: highlighted/hex view, stats, copy-as and a smart-named download. */
export default function OutputPanel() {
  const { run, input, state } = useTool()
  const labelId = useId()
  // before the first run completes, show the input rather than a flash of nothing
  const value = run.result ? run.result.out : input
  // bytes render from the raw value (hex / lossy text); their debug display string can be huge
  const text = useMemo(() => (isBytes(value) ? '' : formatForDisplay(value)), [value])

  const download = useCallback(() => {
    const plan = pickDownload(value, state.name)
    triggerDownload(plan)
    trackPipelineEvent('output_download', state.steps, { file_type: plan.mime, output_size: sizeBucket(valueSize(value)) })
  }, [value, state.name, state.steps])

  const onCopy = useCallback((format: string) => {
    trackPipelineEvent('output_copy', state.steps, { format, output_size: sizeBucket(valueSize(value)) })
  }, [value, state.steps])

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <span className="muted" id={labelId}>result</span>
        {/* status only — the result itself is not live: re-reading it on every keystroke would drown a screen reader */}
        <span className="text-xs text-muted" role="status">{run.running ? 'running…' : ''}</span>
        {run.failure && <span className="text-xs text-danger" role="alert">{run.failure}</span>}
        {run.result && run.partial && (
          <span className="chip text-warn">partial result — from the first 64 KB of the input</span>
        )}
      </div>
      <div role="region" aria-labelledby={labelId}>
        <OutputView value={value} text={text} label="result" />
      </div>
      <StatsBar value={value} />
      <div className="flex gap-2 mt-2">
        <CopyAsMenu value={value} label="copy" onCopy={onCopy} />
        <button type="button" className="btn" onClick={download}>
          <Download size={16} /> download
        </button>
      </div>
    </div>
  )
}
