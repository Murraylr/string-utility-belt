import React, { useMemo } from 'react'
import { formatForDisplay } from '@/core/coerce'
import { isBranchStep, isMacroStep, isUtilityStep } from '@/core/steps'
import { decodeShare } from '@/core/serialize'
import type { PipelineDoc, PipelineStep } from '@/types/utility'
import { ToolProvider, useTool } from '@/app/ToolContext'
import { registry } from '@/app/registry'
import { quarantineUntrusted } from '@/app/share/trust'

function stepLabel(step: PipelineStep): string {
  if (isUtilityStep(step)) return step.label || registry.get(step.utilityId)?.name || step.utilityId
  if (isBranchStep(step)) return step.label || `branch (${step.branches.length} lanes)`
  if (isMacroStep(step)) return step.label || step.name
  return 'step'
}

function EmbedInner({ payload, quarantined, name }: { payload: string; quarantined: number; name?: string }) {
  const { input, setInput, state, run, runHeld } = useTool()
  const openUrl = `${location.origin}${location.pathname}#/p/${payload}`
  const firstError = run.failure ?? (run.result ? Object.values(run.result.err)[0] : undefined)

  return (
    // the embed renders without the site chrome, so it supplies its own landmark and heading
    <main className="p-3 text-sm grid gap-3 text-fg">
      <h1 className="sr-only">{name ? `${name} — ` : ''}shared String Utility Belt pipeline</h1>
      <div className="grid gap-1">
        <label className="muted" htmlFor="embed-input">input</label>
        <textarea
          id="embed-input"
          className="field mono text-sm min-h-[80px]"
          placeholder="type or paste your text here…"
          value={typeof input === 'string' ? input : ''}
          onChange={e => setInput(e.target.value)}
        />
      </div>

      {state.steps.length > 0 && (
        <div>
          <div className="muted mb-1" id="embed-steps-label">steps</div>
          <ol className="grid gap-0.5 list-decimal list-inside" aria-labelledby="embed-steps-label">
            {state.steps.map(s => (
              <li key={s.id} className={s.enabled === false ? 'text-muted line-through' : undefined}>
                {stepLabel(s)}{s.enabled === false && <span className="sr-only"> (disabled)</span>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {quarantined > 0 && (
        <div className="text-xs text-warn">
          This pipeline contains custom code; those steps are disabled here. Open it in String Utility Belt to review them.
        </div>
      )}

      <div className="grid gap-1">
        <div className="muted" id="embed-result-label">result</div>
        <pre
          role="region"
          aria-labelledby="embed-result-label"
          aria-busy={run.running}
          className="border rounded-xl p-2 bg-surface-2 mono text-xs whitespace-pre-wrap [overflow-wrap:anywhere] max-h-64 overflow-auto"
        >{run.result ? formatForDisplay(run.result.out) : run.running ? 'running…' : ''}</pre>
        {firstError && <div role="alert" className="text-xs text-danger">{firstError}</div>}
        {runHeld && (
          <div role="status" className="flex flex-wrap items-center gap-2 text-xs">
            <span className="muted">This pipeline has to run on the page itself, so it waits for you.</span>
            <button type="button" className="btn" onClick={run.runNow}>Run</button>
          </div>
        )}
      </div>

      <a className="btn justify-self-start" href={openUrl} target="_blank" rel="noopener noreferrer">
        Open in String Utility Belt
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
      <main className="p-3">
        <h1 className="sr-only">shared String Utility Belt pipeline</h1>
        <div role="alert" className="text-sm text-danger">{decoded.error}</div>
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
