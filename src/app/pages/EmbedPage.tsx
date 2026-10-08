import React, { useMemo } from 'react'
import { ExternalLink } from 'lucide-react'
import { formatForDisplay } from '@/core/coerce'
import { countSteps, isBranchStep, isEachStep, isMacroStep, isUtilityStep } from '@/core/steps'
import { itemNoun } from '@/core/split'
import { decodeShare } from '@/core/serialize'
import type { PipelineDoc, PipelineStep } from '@/types/utility'
import { ToolProvider, useTool } from '@/app/ToolContext'
import { registry } from '@/app/registry'
import { quarantineUntrusted } from '@/app/share/trust'

function stepLabel(step: PipelineStep): string {
  if (isUtilityStep(step)) return step.label || registry.get(step.utilityId)?.name || step.utilityId
  if (isBranchStep(step)) return step.label || `branch (${step.branches.length} lanes)`
  if (isMacroStep(step)) return step.label || step.name
  if (isEachStep(step)) {
    const n = countSteps(step.steps)
    return step.label || `run on each ${itemNoun(step.split.mode, 1)} (${n} ${n === 1 ? 'step' : 'steps'})`
  }
  return 'step'
}

function EmbedInner({ payload, quarantined, name }: { payload: string; quarantined: number; name?: string }) {
  const { input, setInput, state, run, runHeld } = useTool()
  const openUrl = `${location.origin}${location.pathname}#/p/${payload}`
  const firstError = run.failure ?? (run.result ? Object.values(run.result.err)[0] : undefined)

  return (
    // the embed renders without the site chrome, so it supplies its own landmark and heading
    <main className="p-3 grid gap-3 text-[13px] text-fg bg-canvas">
      <h1 className="sr-only">{name ? `${name}: ` : ''}shared String Utility Belt pipeline</h1>
      <div className="grid gap-1.5">
        <label className="text-[13px] font-semibold" htmlFor="embed-input">Input</label>
        <textarea
          id="embed-input"
          className="field min-h-20 resize-y font-mono text-[12.5px] leading-5"
          placeholder="Type or paste your text here"
          value={typeof input === 'string' ? input : ''}
          onChange={e => setInput(e.target.value)}
        />
      </div>

      {state.steps.length > 0 && (
        <div className="grid gap-1.5">
          <div className="text-[13px] font-semibold" id="embed-steps-label">Steps</div>
          <ol role="list" className="m-0 p-0 list-none flex flex-wrap gap-1.5" aria-labelledby="embed-steps-label">
            {state.steps.map((s, i) => (
              <li
                key={s.id}
                className={`inline-flex items-center gap-1.5 h-[26px] px-2 border rounded-md bg-surface text-[12.5px] ${s.enabled === false ? 'text-muted line-through' : ''}`}
              >
                <span className="font-mono text-[11px] text-muted" aria-hidden>{i + 1}</span>
                {stepLabel(s)}{s.enabled === false && <span className="sr-only"> (disabled)</span>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {quarantined > 0 && (
        <p className="m-0 text-xs text-warn">
          This pipeline contains custom code, so those steps are disabled here. Open it in String Utility Belt to review them.
        </p>
      )}

      <div className="grid gap-1.5">
        <div className="text-[13px] font-semibold" id="embed-result-label">Result</div>
        <pre
          role="region"
          aria-labelledby="embed-result-label"
          aria-busy={run.running}
          className="m-0 min-h-10 max-h-64 overflow-auto px-2.5 py-2 border rounded-md bg-surface-2 font-mono text-[12.5px] leading-5 whitespace-pre-wrap wrap-anywhere"
        >{run.result ? formatForDisplay(run.result.out) : run.running ? 'Running…' : ''}</pre>
        {firstError && <div role="alert" className="text-xs text-danger-ink">{firstError}</div>}
        {runHeld && (
          <div role="status" className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted">This pipeline has to run on the page itself, so it waits for you.</span>
            <button type="button" className="btn-inv h-7 px-2.5 text-[12.5px]" onClick={run.runNow}>Run</button>
          </div>
        )}
      </div>

      <a className="btn justify-self-start" href={openUrl} target="_blank" rel="noopener noreferrer">
        Open in String Utility Belt <ExternalLink size={13} aria-hidden />
      </a>
    </main>
  )
}

/** Minimal, iframe-friendly view of a shared pipeline (`#/embed/<payload>`). */
export default function EmbedPage({ payload }: { payload: string }) {
  const decoded = useMemo<{ doc?: PipelineDoc; quarantined: number; error?: string }>(() => {
    try {
      const doc = decodeShare(payload)
      const { steps, quarantined } = quarantineUntrusted(doc.steps)
      return { doc: { ...doc, steps }, quarantined: quarantined.length }
    } catch (e: any) {
      return { error: e?.message || String(e), quarantined: 0 }
    }
  }, [payload])

  if (decoded.error) {
    return (
      <main className="p-3 bg-canvas">
        <h1 className="sr-only">shared String Utility Belt pipeline</h1>
        <div role="alert" className="px-3 py-2.5 border border-danger-line rounded-md bg-danger-bg text-[13px] text-danger-ink">{decoded.error}</div>
      </main>
    )
  }
  const doc = decoded.doc!
  // persist={false}: the embed runs on someone else's page and must never overwrite the
  // viewer's own saved pipeline. `key` restarts the tool when the host swaps the payload.
  return (
    <ToolProvider key={payload} persist={false} untrusted initialSteps={doc.steps} initialName={doc.name} initialInput={doc.input ?? ''}>
      <EmbedInner payload={payload} quarantined={decoded.quarantined} name={doc.name} />
    </ToolProvider>
  )
}
