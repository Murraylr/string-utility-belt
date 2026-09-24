/**
 * The pipeline editor's state and every edit it supports, as a pure reducer.
 * Undo/redo lives here too: each undoable action snapshots `steps` first.
 *
 * All step-addressed actions find their target by id anywhere in the tree, so the
 * same actions work for top-level steps, steps inside branch lanes and macro bodies.
 */
import type { BranchStep, MacroStep, MergeSpec, PipelineStep } from '@/types/utility'
import {
  cloneWithNewIds, findStep, isBranchStep, isMacroStep, isUtilityStep, stepId, updateStep,
} from '@/core/steps'
import { CODE_UTILITIES } from '@/app/share/trust'

export const HISTORY_LIMIT = 100
/** Param edits to the same step within this window collapse into one undo entry. */
export const COALESCE_MS = 800

/** Where to insert: a top-level position, or inside a branch lane / macro body. */
export interface Target {
  /** Insert after this step (same sequence). Omitted: append to the sequence. */
  afterId?: string
  /** Container step (branch or macro). Omitted: the top level. */
  parentId?: string
  /** Branch lane index when `parentId` is a branch. Default 0. */
  lane?: number
}

export interface PipelineState {
  steps: PipelineStep[]
  /** Name shown in the toolbar; set when loaded from / saved to the library. */
  name?: string
  /** Library entry this pipeline was loaded from or saved as. */
  libraryId?: string
  past: PipelineStep[][]
  future: PipelineStep[][]
  /** Last coalescable edit: `SET_PARAMS:<id>` and when it happened. */
  lastEdit?: { key: string; at: number }
}

export type PipelineAction =
  | { type: 'ADD_STEP'; utilityId: string; params?: Record<string, unknown>; target?: Target; id?: string }
  | { type: 'INSERT_STEPS'; steps: PipelineStep[]; target?: Target }
  | { type: 'REMOVE_STEP'; id: string }
  | { type: 'MOVE_STEP'; id: string; direction: 'up' | 'down' }
  /** Reorder one sequence to the given id order (drag and drop). */
  | { type: 'REORDER'; ids: string[]; parentId?: string; lane?: number }
  | { type: 'DUPLICATE_STEP'; id: string }
  | { type: 'TOGGLE_STEP'; id: string; enabled: boolean }
  /** Enable `id`, disable every other step in its sequence. */
  | { type: 'SOLO_STEP'; id: string }
  | { type: 'SET_ALL_ENABLED'; enabled: boolean }
  | { type: 'SET_PARAMS'; id: string; params: Record<string, unknown>; at?: number }
  | { type: 'CHANGE_UTILITY'; id: string; utilityId: string; params: Record<string, unknown> }
  /** Shallow patch of step fields: label, condition, onError, merge, name, … */
  | { type: 'UPDATE_STEP'; id: string; patch: Record<string, unknown> }
  | { type: 'ADD_BRANCH'; target?: Target; lanes?: number; merge?: MergeSpec }
  | { type: 'ADD_LANE'; id: string }
  | { type: 'REMOVE_LANE'; id: string; lane: number }
  /** Wrap consecutive steps of one sequence in a macro or a single-lane branch. */
  | { type: 'WRAP'; ids: string[]; as: 'macro' | 'branch'; name?: string }
  /** Replace a macro or branch by its contents (a branch keeps lane 0). */
  | { type: 'UNWRAP'; id: string }
  | { type: 'LOAD'; steps: PipelineStep[]; name?: string; libraryId?: string }
  | { type: 'SET_META'; name?: string; libraryId?: string }
  | { type: 'CLEAR' }
  | { type: 'UNDO' }
  | { type: 'REDO' }

export const initialPipelineState = (steps: PipelineStep[] = [], name?: string, libraryId?: string): PipelineState =>
  ({ steps, name, libraryId, past: [], future: [] })

// --- sequence helpers ---------------------------------------------------------

/** The sequence containing `id`, and a function that rebuilds the tree with it replaced. */
function locate(steps: PipelineStep[], id: string):
  { seq: PipelineStep[]; replace: (next: PipelineStep[]) => PipelineStep[] } | null {
  if (steps.some(s => s.id === id)) return { seq: steps, replace: next => next }
  for (const s of steps) {
    if (isBranchStep(s)) {
      for (let lane = 0; lane < s.branches.length; lane++) {
        const inner = locate(s.branches[lane], id)
        if (inner) {
          return {
            seq: inner.seq,
            replace: next => updateStep(steps, s.id, b => {
              const br = b as BranchStep
              const branches = br.branches.map((l, i) => (i === lane ? inner.replace(next) : l))
              return { ...br, branches }
            }),
          }
        }
      }
    } else if (isMacroStep(s)) {
      const inner = locate(s.steps, id)
      if (inner) {
        return { seq: inner.seq, replace: next => updateStep(steps, s.id, m => ({ ...(m as MacroStep), steps: inner.replace(next) })) }
      }
    }
  }
  return null
}

/** Get and replace the sequence a Target points into. */
function container(steps: PipelineStep[], t: Target | undefined):
  { seq: PipelineStep[]; replace: (next: PipelineStep[]) => PipelineStep[] } | null {
  if (!t?.parentId) return { seq: steps, replace: next => next }
  const parent = findStep(steps, t.parentId)
  if (!parent) return null
  if (isBranchStep(parent)) {
    const lane = Math.max(0, Math.min(t.lane ?? 0, parent.branches.length - 1))
    return {
      seq: parent.branches[lane] ?? [],
      replace: next => updateStep(steps, parent.id, b => {
        const br = b as BranchStep
        return { ...br, branches: br.branches.map((l, i) => (i === lane ? next : l)) }
      }),
    }
  }
  if (isMacroStep(parent)) {
    return { seq: parent.steps, replace: next => updateStep(steps, parent.id, m => ({ ...(m as MacroStep), steps: next })) }
  }
  return null
}

function insertAt(steps: PipelineStep[], items: PipelineStep[], target?: Target): PipelineStep[] {
  const c = container(steps, target)
  if (!c) return steps
  const seq = [...c.seq]
  const at = target?.afterId ? seq.findIndex(s => s.id === target.afterId) : -1
  if (at >= 0) seq.splice(at + 1, 0, ...items); else seq.push(...items)
  return c.replace(seq)
}

/**
 * Bulk enable/disable. Enabling never switches on a code-running step (custom JS):
 * those arrive quarantined from share links and imports, and must be enabled one
 * at a time, on purpose, after the user has read the code.
 */
const setEnabledDeep = (steps: PipelineStep[], enabled: boolean): PipelineStep[] =>
  steps.map(s => {
    const keep = enabled && isUtilityStep(s) && CODE_UTILITIES.has(s.utilityId)
    const base = keep ? s : { ...s, enabled }
    if (isBranchStep(base)) return { ...base, branches: base.branches.map(b => setEnabledDeep(b, enabled)) }
    if (isMacroStep(base)) return { ...base, steps: setEnabledDeep(base.steps, enabled) }
    return base
  })

// --- reducer -------------------------------------------------------------------

/** Applies an edit to `steps`; returns the same array when nothing changed. */
function edit(steps: PipelineStep[], a: PipelineAction): PipelineStep[] {
  switch (a.type) {
    case 'ADD_STEP':
      return insertAt(steps, [{ id: a.id ?? stepId(), utilityId: a.utilityId, enabled: true, params: a.params ?? {} }], a.target)
    case 'INSERT_STEPS':
      return a.steps.length ? insertAt(steps, a.steps.map(cloneWithNewIds), a.target) : steps
    case 'REMOVE_STEP':
      return updateStep(steps, a.id, () => null)
    case 'MOVE_STEP': {
      const loc = locate(steps, a.id)
      if (!loc) return steps
      const seq = [...loc.seq]
      const i = seq.findIndex(s => s.id === a.id)
      const j = a.direction === 'up' ? i - 1 : i + 1
      if (j < 0 || j >= seq.length) return steps
      ;[seq[i], seq[j]] = [seq[j], seq[i]]
      return loc.replace(seq)
    }
    case 'REORDER': {
      const c = container(steps, { parentId: a.parentId, lane: a.lane })
      if (!c) return steps
      const byId = new Map(c.seq.map(s => [s.id, s]))
      // only a permutation of the same ids is a valid reorder
      if (a.ids.length !== c.seq.length || !a.ids.every(id => byId.has(id))) return steps
      if (a.ids.every((id, i) => c.seq[i].id === id)) return steps
      return c.replace(a.ids.map(id => byId.get(id)!))
    }
    case 'DUPLICATE_STEP': {
      return updateStep(steps, a.id, s => [s, cloneWithNewIds(s)])
    }
    case 'TOGGLE_STEP':
      return updateStep(steps, a.id, s => (s.enabled === a.enabled ? s : { ...s, enabled: a.enabled }))
    case 'SOLO_STEP': {
      const loc = locate(steps, a.id)
      if (!loc) return steps
      return loc.replace(loc.seq.map(s => ({ ...s, enabled: s.id === a.id })))
    }
    case 'SET_ALL_ENABLED':
      return setEnabledDeep(steps, a.enabled)
    case 'SET_PARAMS':
      return updateStep(steps, a.id, s => (isUtilityStep(s) ? { ...s, params: a.params } : s))
    case 'CHANGE_UTILITY':
      return updateStep(steps, a.id, s => (isUtilityStep(s) ? { ...s, utilityId: a.utilityId, params: a.params } : s))
    case 'UPDATE_STEP':
      return updateStep(steps, a.id, s => {
        const next: Record<string, unknown> = { ...s, ...a.patch, id: s.id }
        for (const [k, v] of Object.entries(a.patch)) if (v === undefined) delete next[k]
        return next as unknown as PipelineStep
      })
    case 'ADD_BRANCH': {
      const lanes = Math.max(1, a.lanes ?? 2)
      const branch: BranchStep = {
        id: stepId('branch'), type: 'branch', enabled: true,
        branches: Array.from({ length: lanes }, () => []), merge: a.merge ?? { mode: 'concat', separator: '\n' },
      }
      return insertAt(steps, [branch], a.target)
    }
    case 'ADD_LANE':
      return updateStep(steps, a.id, s => (isBranchStep(s) ? { ...s, branches: [...s.branches, []] } : s))
    case 'REMOVE_LANE':
      return updateStep(steps, a.id, s => (isBranchStep(s) && s.branches.length > 1
        ? { ...s, branches: s.branches.filter((_, i) => i !== a.lane) } : s))
    case 'WRAP': {
      if (!a.ids.length) return steps
      const loc = locate(steps, a.ids[0])
      if (!loc) return steps
      const idx = a.ids.map(id => loc.seq.findIndex(s => s.id === id)).sort((x, y) => x - y)
      // must be a contiguous run inside one sequence
      if (idx.some(i => i < 0) || idx.some((v, k) => k > 0 && v !== idx[k - 1] + 1)) return steps
      const picked = loc.seq.slice(idx[0], idx[idx.length - 1] + 1)
      const wrapper: PipelineStep = a.as === 'macro'
        ? { id: stepId('macro'), type: 'macro', enabled: true, name: a.name || 'macro', steps: picked }
        : { id: stepId('branch'), type: 'branch', enabled: true, branches: [picked], merge: { mode: 'concat', separator: '\n' } }
      const seq = [...loc.seq]
      seq.splice(idx[0], picked.length, wrapper)
      return loc.replace(seq)
    }
    case 'UNWRAP':
      return updateStep(steps, a.id, s => (isMacroStep(s) ? s.steps : isBranchStep(s) ? (s.branches[0] ?? []) : s))
    case 'LOAD':
      return a.steps
    case 'CLEAR':
      return steps.length ? [] : steps
    default:
      return steps
  }
}

export function pipelineReducer(state: PipelineState, action: PipelineAction): PipelineState {
  switch (action.type) {
    case 'UNDO': {
      if (!state.past.length) return state
      const prev = state.past[state.past.length - 1]
      return { ...state, steps: prev, past: state.past.slice(0, -1), future: [state.steps, ...state.future], lastEdit: undefined }
    }
    case 'REDO': {
      if (!state.future.length) return state
      const [next, ...rest] = state.future
      return { ...state, steps: next, past: [...state.past, state.steps].slice(-HISTORY_LIMIT), future: rest, lastEdit: undefined }
    }
    case 'SET_META':
      return { ...state, name: action.name, libraryId: action.libraryId }
    default: {
      const steps = edit(state.steps, action)
      const meta = action.type === 'LOAD'
        ? { name: action.name, libraryId: action.libraryId }
        : action.type === 'CLEAR' ? { name: undefined, libraryId: undefined } : {}
      if (steps === state.steps) return Object.keys(meta).length ? { ...state, ...meta } : state
      // successive param edits of one step are one undo entry
      const key = action.type === 'SET_PARAMS' ? `SET_PARAMS:${action.id}` : undefined
      const at = action.type === 'SET_PARAMS' ? action.at ?? Date.now() : 0
      const coalesce = !!key && state.lastEdit?.key === key && at - state.lastEdit.at < COALESCE_MS
      return {
        ...state,
        ...meta,
        steps,
        past: coalesce ? state.past : [...state.past, state.steps].slice(-HISTORY_LIMIT),
        future: [],
        lastEdit: key ? { key, at } : undefined,
      }
    }
  }
}
