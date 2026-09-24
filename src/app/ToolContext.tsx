/* eslint-disable react-refresh/only-export-components --
   the provider, its hooks and the input hand-off are one module on purpose (40+ importers);
   the only cost is a full reload instead of a hot swap when this file changes in dev */
/**
 * Shared state of the pipeline tool: the pipeline (reducer + undo history), the
 * input, and the latest run. Feature components read and dispatch through
 * `useTool()` instead of threading props through the page.
 */
import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { PipelineStep, Value } from '@/types/utility'
import { initialPipelineState, pipelineReducer, type PipelineAction, type PipelineState } from './store/pipeline'
import { useRunner, type RunState } from './engine/useRunner'
import { loadState, saveState } from '@/lib/persist'
import { usePref } from './prefs'
import { canRunInWorker } from '@/core/registry'
import { isBranchStep, isMacroStep } from '@/core/steps'
import { registry } from './registry'

export interface ToolApi {
  state: PipelineState
  dispatch: React.Dispatch<PipelineAction>
  input: Value
  setInput: (v: Value) => void
  run: RunState & { runNow: () => void }
  showPreviews: boolean
  setShowPreviews: (v: boolean) => void
  /** Live: re-run on every change. Manual: only via run.runNow(). */
  liveRun: boolean
  setLiveRun: (v: boolean) => void
  canUndo: boolean
  canRedo: boolean
  /**
   * An untrusted pipeline (share link, embed) that can only run on the main thread is
   * held back from auto-running until the user clicks Run: a hostile regex or input
   * there would freeze the tab the moment the link opens (in the worker it can't).
   */
  runHeld: boolean
}

const ToolCtx = createContext<ToolApi | null>(null)

const HANDOFF_KEY = 'sub:handoff-input'

/**
 * Carry text input across a route change that remounts the editor (a shared link's
 * "Open in editor"). One-shot: the next editor that starts without an explicit
 * input takes it and clears it.
 */
export function handOffInput(text: string): void {
  try { sessionStorage.setItem(HANDOFF_KEY, text) } catch { /* storage disabled: input is simply not carried */ }
}

function takeHandedOffInput(): string | undefined {
  try {
    const v = sessionStorage.getItem(HANDOFF_KEY)
    if (v !== null) sessionStorage.removeItem(HANDOFF_KEY)
    return v ?? undefined
  } catch { return undefined }
}

export function useTool(): ToolApi {
  const ctx = useContext(ToolCtx)
  if (!ctx) throw new Error('useTool() must be used inside <ToolProvider>')
  return ctx
}

/** Like useTool, but null outside a provider (for components also used elsewhere). */
export const useOptionalTool = () => useContext(ToolCtx)

export interface ToolProviderProps {
  children: React.ReactNode
  /** Start from these steps instead of the saved pipeline (share links, embeds). */
  initialSteps?: PipelineStep[]
  initialName?: string
  initialInput?: Value
  /** Write edits back to localStorage. Off for embeds and read-only views. */
  persist?: boolean
  /** The steps came from someone else (share link, embed): see `ToolApi.runHeld`. */
  untrusted?: boolean
}

/** Steps that will actually run: a disabled (e.g. quarantined) step never forces the main thread. */
const enabledOnly = (steps: PipelineStep[]): PipelineStep[] =>
  steps.filter(s => s.enabled !== false).map(s =>
    isBranchStep(s) ? { ...s, branches: s.branches.map(enabledOnly) }
      : isMacroStep(s) ? { ...s, steps: enabledOnly(s.steps) }
        : s)

const workerOnly = (steps: PipelineStep[]) => canRunInWorker(enabledOnly(steps), id => registry.get(id))

export function ToolProvider({ children, initialSteps, initialName, initialInput, persist = true, untrusted = false }: ToolProviderProps) {
  const [saved] = useState(() => loadState())
  const [state, dispatch] = useReducer(pipelineReducer, undefined, () =>
    initialSteps
      ? initialPipelineState(initialSteps, initialName)
      : initialPipelineState(saved.steps, saved.name, saved.libraryId))
  const [input, setInput] = useState<Value>(() => initialInput ?? takeHandedOffInput() ?? '')
  const [showPreviews, setShowPreviews] = useState(saved.showPreviews)
  const [liveRun, setLiveRun] = usePref('liveRun', true)

  // released for good by the first explicit Run; lapses while the steps can use the worker
  const [holding, setHolding] = useState(() => untrusted && !!initialSteps && !workerOnly(initialSteps))
  const runHeld = useMemo(() => holding && !workerOnly(state.steps), [holding, state.steps])

  const runner = useRunner(input, state.steps, { previews: showPreviews, live: liveRun && !runHeld })
  const runnerRunNow = runner.runNow
  const run = useMemo(() => ({
    ...runner,
    runNow: () => { setHolding(false); runnerRunNow() },
  }), [runner, runnerRunNow])

  // Persist the working pipeline on real edits only. The first render is a baseline,
  // never a save: opening a share link must not overwrite the user's saved pipeline
  // until they actually change the shared one.
  const lastSaved = useRef<string | null>(null)
  useEffect(() => {
    if (!persist) return
    const snapshot = JSON.stringify([state.steps, showPreviews, state.name, state.libraryId])
    if (lastSaved.current === null || snapshot === lastSaved.current) { lastSaved.current = snapshot; return }
    lastSaved.current = snapshot
    saveState({ steps: state.steps, showPreviews, name: state.name, libraryId: state.libraryId })
  }, [persist, state.steps, showPreviews, state.name, state.libraryId])

  const api = useMemo<ToolApi>(() => ({
    state, dispatch, input, setInput, run,
    showPreviews, setShowPreviews, liveRun, setLiveRun,
    canUndo: state.past.length > 0, canRedo: state.future.length > 0, runHeld,
  }), [state, input, run, showPreviews, liveRun, setLiveRun, runHeld])

  return <ToolCtx.Provider value={api}>{children}</ToolCtx.Provider>
}
