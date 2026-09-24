import React, { useMemo } from 'react'
import { GitCompare, PanelsTopLeft } from 'lucide-react'
import { asText } from '@/core/coerce'
import type { Value } from '@/types/utility'
import { usePref } from '@/app/prefs'
import DiffView from '@/app/io/DiffView'
import { useTool } from '@/app/ToolContext'
import InputPanel from './InputPanel'
import OutputPanel from './OutputPanel'

type IOLayout = 'stacked' | 'side-by-side'

/** Arrangement of the input and result panels: stacked, or side-by-side with an optional diff. */
export default function IOSection() {
  const { input, run } = useTool()
  const [layout, setLayout] = usePref<IOLayout>('ioLayout', 'stacked')
  const [showDiff, setShowDiff] = usePref('ioDiff', false)
  const sideBySide = layout === 'side-by-side'

  return (
    <div className="card p-4 grid gap-3">
      <div className="flex items-center justify-end gap-2">
        {sideBySide && (
          <button
            type="button"
            className="btn"
            aria-pressed={showDiff}
            onClick={() => setShowDiff(v => !v)}
          >
            <GitCompare size={16} /> diff
          </button>
        )}
        <button
          type="button"
          className="btn"
          aria-pressed={sideBySide}
          onClick={() => setLayout(l => (l === 'side-by-side' ? 'stacked' : 'side-by-side'))}
        >
          <PanelsTopLeft size={16} /> side-by-side
        </button>
      </div>

      {/* one container for both layouts, so switching never remounts the panels (and loses their state) */}
      <div className={`grid gap-4 ${sideBySide ? 'md:grid-cols-2' : ''}`}>
        <InputPanel />
        <OutputPanel />
      </div>

      {sideBySide && showDiff && <InputOutputDiff input={input} output={run.result ? run.result.out : input} />}
    </div>
  )
}

/** Only mounted while the diff is visible, so hidden diffs cost nothing per keystroke. */
function InputOutputDiff({ input, output }: { input: Value; output: Value }) {
  const before = useMemo(() => asText(input), [input])
  const after = useMemo(() => asText(output), [output])
  return <DiffView before={before} after={after} />
}
