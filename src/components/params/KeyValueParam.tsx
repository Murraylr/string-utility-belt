import { useLayoutEffect, useRef } from 'react'
import { parseLegacyKeyValue, toPairs, type Pair } from './keyvalueUtils'
import type { ControlProps } from './types'

export interface KeyValueParamProps extends Omit<ControlProps<'keyvalue', Pair[]>, 'value'> {
  /** Pairs, or a legacy free-text value from before this param kind existed. Anything else reads as no pairs. */
  value: unknown
  /** Keys are regex sources, so converting a legacy value leaves their backslash escapes alone. */
  regexKeys?: boolean
}

/**
 * One key or value. A textarea, not an input: an `<input>` strips line breaks, so a pair
 * holding one (a converted `\n` rule, a share link) would show wrong and lose it on edit.
 * Plain Enter still behaves like an input's (a habitual Enter would otherwise add a trailing
 * newline that silently stops a rule matching); Shift+Enter inserts a line break.
 */
function Cell({ label, placeholder, value, onChange, focusKey }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void; focusKey?: string
}) {
  return (
    <textarea
      data-kv={focusKey}
      className="field min-w-0 flex-1 resize-none"
      rows={Math.min(6, value.split('\n').length)}
      spellCheck={false}
      aria-label={label}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) e.preventDefault() }}
    />
  )
}

/** Editable ordered key/value rows: reorder, remove, add — the shape `multi_replace` needs.
 * A legacy free-text value is shown read-only with a one-click conversion. */
export default function KeyValueParam({ id, spec, value, onChange, describedBy, regexKeys }: KeyValueParamProps) {
  const rootRef = useRef<HTMLFieldSetElement>(null)
  // After an add/move/remove the rows re-render under the pointer, so focus is placed on
  // the first enabled control named here (by `data-kv`) once the new value arrives.
  const pendingFocus = useRef<string[] | null>(null)
  useLayoutEffect(() => {
    const wanted = pendingFocus.current
    if (!wanted) return
    pendingFocus.current = null
    for (const key of wanted) {
      const el = rootRef.current?.querySelector<HTMLButtonElement | HTMLTextAreaElement>(`[data-kv="${key}"]`)
      if (el && !el.disabled) { el.focus(); return }
    }
  })

  const keyLabel = spec.keyLabel ?? 'key'
  const valueLabel = spec.valueLabel ?? 'value'
  const legacy = typeof value === 'string' && value.trim() !== '' ? value : null
  const pairs = legacy === null ? toPairs(value) : []

  const setPair = (i: number, next: Pair) => onChange(pairs.map((p, idx) => (idx === i ? next : p)))
  const remove = (i: number) => {
    pendingFocus.current = [`remove-${i}`, `remove-${i - 1}`, 'add']
    onChange(pairs.filter((_, idx) => idx !== i))
  }
  const add = () => {
    pendingFocus.current = [`key-${pairs.length}`]
    onChange([...pairs, ['', '']])
  }
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= pairs.length) return
    const next = [...pairs]
    ;[next[i], next[j]] = [next[j], next[i]]
    pendingFocus.current = dir < 0 ? [`up-${j}`, `down-${j}`] : [`down-${j}`, `up-${j}`]
    onChange(next)
  }

  return (
    <fieldset ref={rootRef} id={id} className="flex flex-col gap-2" aria-describedby={describedBy}>
      <legend className="text-muted mb-1">{spec.label}</legend>
      {legacy !== null ? (
        <div className="flex flex-col gap-2 rounded-xl border bg-surface-2 p-2 text-xs">
          <p className="text-muted">legacy value, stored as free text:</p>
          <pre className="mono max-h-40 overflow-auto whitespace-pre-wrap [overflow-wrap:anywhere]">{legacy}</pre>
          <button type="button" className="btn self-start" onClick={() => onChange(parseLegacyKeyValue(legacy, { regexKeys }))}>
            convert to pairs
          </button>
        </div>
      ) : (
        <>
          {pairs.map(([k, v], i) => (
            <div key={i} className="flex items-start gap-1">
              <Cell label={`${keyLabel} ${i + 1}`} placeholder={keyLabel} value={k} onChange={next => setPair(i, [next, v])} focusKey={`key-${i}`} />
              <Cell label={`${valueLabel} ${i + 1}`} placeholder={valueLabel} value={v} onChange={next => setPair(i, [k, next])} />
              <button type="button" className="icon-btn" data-kv={`up-${i}`} aria-label={`move row ${i + 1} up`} onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
              <button type="button" className="icon-btn" data-kv={`down-${i}`} aria-label={`move row ${i + 1} down`} onClick={() => move(i, 1)} disabled={i === pairs.length - 1}>↓</button>
              <button type="button" className="icon-btn text-danger" data-kv={`remove-${i}`} aria-label={`remove row ${i + 1}`} onClick={() => remove(i)}>×</button>
            </div>
          ))}
          <button type="button" className="btn self-start" data-kv="add" onClick={add}>add row</button>
        </>
      )}
    </fieldset>
  )
}
