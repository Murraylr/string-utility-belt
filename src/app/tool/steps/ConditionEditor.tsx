/**
 * Editor for a step's `Condition` (§8.6): when it should run, and whether the
 * result is negated. Purely controlled — the caller decides how (or whether) to
 * dispatch `onChange`'s result.
 */
import React, { useId, useMemo, useState } from 'react'
import type { Condition, ValueType } from '@/types/utility'
import { typeLabel } from './status'

export interface ConditionEditorProps {
  condition?: Condition
  /** `undefined` means "always run" (the default — no condition stored on the step). */
  onChange: (condition: Condition | undefined) => void
}

type Kind = 'always' | Condition['kind']

const KIND_OPTIONS: Array<{ value: Kind; label: string }> = [
  { value: 'always', label: 'always' },
  { value: 'nonEmpty', label: 'when the input isn’t empty' },
  { value: 'regex', label: 'when the input matches a regex' },
  { value: 'type', label: 'when the input type is…' },
]

const TYPE_OPTIONS: ValueType[] = ['string', 'bytes', 'json']

/**
 * `null` when the runner will accept this pattern + flags, else RegExp's own message.
 * Mirrors the runner's flag handling: `g`/`y` are dropped and repeats collapsed.
 */
function regexError(pattern: string, flags: string): { message: string; field: 'pattern' | 'flags' } | null {
  const runnerFlags = [...new Set(flags.replace(/[gy]/g, ''))].join('')
  try {
    void new RegExp('', runnerFlags)
  } catch (e) {
    return { message: (e as Error)?.message || 'invalid flags', field: 'flags' }
  }
  try {
    void new RegExp(pattern, runnerFlags)
    return null
  } catch (e) {
    return { message: (e as Error)?.message || 'invalid regex', field: 'pattern' }
  }
}

export default function ConditionEditor({ condition, onChange }: ConditionEditorProps) {
  const errorId = useId()
  const kind: Kind = condition?.kind ?? 'always'
  const negate = condition?.negate ?? false
  const pattern = condition?.kind === 'regex' ? condition.pattern : ''
  const flags = condition?.kind === 'regex' ? condition.flags ?? '' : ''
  const type: ValueType = condition?.kind === 'type' ? condition.type : 'string'

  // Pattern and flags edit a local draft committed once (blur or Enter): one undo entry
  // per edit, and the pipeline never runs (and errors on) a half-typed regex. The draft
  // resyncs when the stored value changes from elsewhere (undo, another editor).
  const [draft, setDraft] = useState({ pattern, flags })
  const [synced, setSynced] = useState({ pattern, flags })
  if (synced.pattern !== pattern || synced.flags !== flags) {
    setSynced({ pattern, flags })
    setDraft({ pattern, flags })
  }
  const commitRegex = () => {
    if (draft.pattern !== pattern || draft.flags !== flags) onChange({ kind: 'regex', pattern: draft.pattern, flags: draft.flags, negate })
  }
  const draftKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commitRegex() }
    if (e.key === 'Escape') { e.preventDefault(); setDraft({ pattern, flags }) }
  }

  const error = useMemo(() => (kind === 'regex' ? regexError(draft.pattern, draft.flags) : null), [kind, draft])

  const setKind = (next: string) => {
    if (next === 'always') { onChange(undefined); return }
    if (next === 'nonEmpty') { onChange({ kind: 'nonEmpty', negate }); return }
    if (next === 'regex') { onChange({ kind: 'regex', pattern, flags, negate }); return }
    if (next === 'type') { onChange({ kind: 'type', type, negate }); return }
  }

  const invalid = (field: 'pattern' | 'flags') => (error?.field === field
    ? { 'aria-invalid': true, 'aria-describedby': errorId }
    : { 'aria-invalid': false })

  return (
    <div className="grid gap-1.5">
      <select className="field h-[30px] min-w-0" aria-label="run condition" value={kind} onChange={e => setKind(e.target.value)}>
        {KIND_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {kind === 'regex' && (
        <>
          <div className="flex gap-1.5">
            <input className="field h-7 flex-1 min-w-0 font-mono text-xs" aria-label="regex pattern" placeholder="pattern"
              spellCheck={false} value={draft.pattern} {...invalid('pattern')}
              onChange={e => setDraft(d => ({ ...d, pattern: e.target.value }))} onBlur={commitRegex} onKeyDown={draftKeys} />
            <input className="field h-7 w-[60px] font-mono text-xs" aria-label="regex flags" placeholder="flags"
              spellCheck={false} value={draft.flags} {...invalid('flags')}
              onChange={e => setDraft(d => ({ ...d, flags: e.target.value }))} onBlur={commitRegex} onKeyDown={draftKeys} />
          </div>
          {error && <span id={errorId} role="alert" className="text-[11.5px] text-danger-ink">{error.message}</span>}
        </>
      )}

      {kind === 'type' && (
        <select className="field h-7 text-[12.5px] min-w-0" aria-label="input type" value={type}
          onChange={e => onChange({ kind: 'type', type: e.target.value as ValueType, negate })}>
          {TYPE_OPTIONS.map(t => <option key={t} value={t}>{typeLabel(t)}</option>)}
        </select>
      )}

      <label className="flex items-center gap-1.5 text-[12.5px] cursor-pointer has-disabled:cursor-default has-disabled:opacity-60">
        {/* enabled whenever a condition is stored, so an imported "always + negate" (never runs) can be undone */}
        <input type="checkbox" checked={negate} disabled={!condition}
          onChange={e => {
            if (!condition) return
            if (condition.kind === 'always' && !e.target.checked) onChange(undefined)
            else if (condition.kind === 'regex') onChange({ ...condition, ...draft, negate: e.target.checked })
            else onChange({ ...condition, negate: e.target.checked } as Condition)
          }} />
        Negate (run when it doesn’t match)
      </label>
    </div>
  )
}
