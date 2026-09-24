import { useId, type ReactNode } from 'react'
import type { ParamSpec, Params } from '@/types/utility'
import { validateParams } from '@/core/params'
import StringParam from './params/StringParam'
import NumberParam from './params/NumberParam'
import BooleanParam from './params/BooleanParam'
import SelectParam from './params/SelectParam'
import CodeParam from './params/CodeParam'
import TextareaParam from './params/TextareaParam'
import RegexParam from './params/RegexParam'
import KeyValueParam from './params/KeyValueParam'
import FileParam from './params/FileParam'
import ColorParam from './params/ColorParam'
import DateParam from './params/DateParam'
import MultiselectParam from './params/MultiselectParam'
import RangeParam from './params/RangeParam'
import { asText } from './params/types'

export interface ParamsEditorProps {
  spec: Record<string, ParamSpec>
  params: Params | undefined
  onChange: (next: Params) => void
  /**
   * Prefix for each control's id: `${idPrefix}-${key}`. Defaults to `param-<unique>`,
   * so several editors on one page (one per step) never share an id.
   */
  idPrefix?: string
  /** The step's live input — powers the `regex` kind's match-count preview. */
  sampleInput?: string
}

/** Kinds that render their own `fieldset`/`legend`, so no `<label>` is added above them. */
const SELF_LABELED = new Set<string>(['multiselect', 'keyvalue'])
/** Kinds that need the full row width. */
const WIDE = new Set<string>(['code', 'textarea', 'keyvalue', 'file'])

const finite = (v: unknown): number | null => {
  if (v === '' || v === null || v === undefined || typeof v === 'boolean') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * V8 echoes the whole pattern into a RegExp error. Dropping it keeps the message short and
 * unchanged while the pattern is typed, so the `role="alert"` is not re-announced per keystroke.
 */
const tidyError = (kind: string, message: string) =>
  kind === 'regex' ? message.replace(/^(Invalid regular expression: )\/[\s\S]*\/[a-z]*: /, '$1') : message

/**
 * What a control shows: the stored value (else the declared default), coerced to the
 * control's shape — stored params can hold any JSON (share links, old localStorage).
 */
function displayValue(cfg: ParamSpec, raw: unknown): unknown {
  const v = raw === undefined || raw === null ? (cfg as { default?: unknown }).default : raw
  switch (cfg.kind) {
    case 'number': return v === '' ? '' : finite(v) ?? ''
    case 'range': return finite(v) ?? finite(cfg.default) ?? cfg.min
    case 'boolean': return v === true
    case 'select': return v === undefined ? cfg.options[0] ?? '' : asText(v)
    case 'multiselect': return Array.isArray(v) ? v.map(asText) : typeof v === 'string' && v ? [v] : []
    case 'keyvalue': return v
    default: return asText(v)
  }
}

/**
 * Renders every param of a utility's spec: one control per `ParamKind`, plus
 * declarative validation from `@/core/params` shown as an inline error under
 * the offending control. Editing is never blocked by an invalid value.
 */
export default function ParamsEditor({ spec, params, onChange, idPrefix, sampleInput }: ParamsEditorProps) {
  const uid = useId().replace(/[^\w-]/g, '')
  const prefix = idPrefix ?? `param-${uid}`
  const current: Params = params ?? {}
  const entries = Object.entries(spec ?? {})
  const errors = validateParams({ params: spec }, current)
  // Precomputed so a sibling lookup (regex's `flagsParam`) sees the same
  // default-filled value as the control it names, not the raw possibly-absent one.
  const values: Params = {}
  for (const [k, cfg] of entries) values[k] = displayValue(cfg, current[k])

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {entries.map(([key, cfg]) => {
        const id = `${prefix}-${key}`
        const value = values[key]
        // A legacy free-text keyvalue is still accepted by its utility; the control's own
        // note (with its convert action) says what is going on, so it is not an error.
        const raw = current[key]
        const legacyKeyValue = cfg.kind === 'keyvalue' && typeof raw === 'string' && raw.trim() !== ''
        const error = errors[key] && !legacyKeyValue ? tidyError(cfg.kind, errors[key]) : null
        const helpId = cfg.description ? `${id}-help` : ''
        const errorId = error ? `${id}-error` : ''
        const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined
        const set = (v: unknown) => onChange({ ...current, [key]: v })
        const common = { id, error, describedBy }

        let control: ReactNode
        switch (cfg.kind) {
          case 'string':
            control = <StringParam {...common} spec={cfg} value={value as string} onChange={set} />
            break
          case 'number':
            control = <NumberParam {...common} spec={cfg} value={value as number | ''} onChange={set} />
            break
          case 'boolean':
            control = <BooleanParam {...common} spec={cfg} value={value as boolean} onChange={set} />
            break
          case 'select':
            control = <SelectParam {...common} spec={cfg} value={value as string} onChange={set} />
            break
          case 'code':
            control = <CodeParam {...common} spec={cfg} value={value as string} onChange={set} />
            break
          case 'textarea':
            control = <TextareaParam {...common} spec={cfg} value={value as string} onChange={set} />
            break
          case 'regex':
            control = (
              <RegexParam
                {...common}
                spec={cfg}
                value={value as string}
                onChange={set}
                flags={cfg.flagsParam ? asText(values[cfg.flagsParam]) : undefined}
                sampleInput={sampleInput}
              />
            )
            break
          case 'keyvalue':
            control = (
              <KeyValueParam
                {...common}
                spec={cfg}
                value={value}
                onChange={set}
                // the legacy rule grammar (multi_replace's) keeps find verbatim when its `regex` flag is on
                regexKeys={spec.regex?.kind === 'boolean' && values.regex === true}
              />
            )
            break
          case 'file':
            control = <FileParam {...common} spec={cfg} value={value as string} onChange={set} />
            break
          case 'color':
            control = <ColorParam {...common} spec={cfg} value={value as string} onChange={set} />
            break
          case 'date':
            control = <DateParam {...common} spec={cfg} value={value as string} onChange={set} />
            break
          case 'multiselect':
            control = <MultiselectParam {...common} spec={cfg} value={value as string[]} onChange={set} />
            break
          case 'range':
            control = <RangeParam {...common} spec={cfg} value={value as number} onChange={set} />
            break
          default:
            control = null
        }

        return (
          <div key={key} className={`flex min-w-0 flex-col gap-1 text-sm ${WIDE.has(cfg.kind) ? 'md:col-span-2' : ''}`}>
            {!SELF_LABELED.has(cfg.kind) && (
              <label
                htmlFor={id}
                className="text-muted"
                // CodeMirror's editable surface is a contenteditable, which a <label> cannot focus
                onClick={cfg.kind === 'code' ? () => document.getElementById(id)?.focus() : undefined}
              >
                {cfg.label}
              </label>
            )}
            {control}
            {helpId && <p id={helpId} className="text-xs text-muted">{cfg.description}</p>}
            {error && <p id={errorId} role="alert" className="text-xs text-danger">{error}</p>}
          </div>
        )
      })}
    </div>
  )
}
