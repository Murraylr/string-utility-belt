import { invalid, type ControlProps } from './types'

const HEX_RE = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

/** Splits a hex colour into the `#rrggbb` an `<input type=color>` needs and any alpha suffix. */
function splitHex(hex: string): { rgb: string; alpha: string } {
  const h = hex.slice(1)
  if (h.length <= 4) {
    const [r, g, b, a] = h
    return { rgb: `#${r}${r}${g}${g}${b}${b}`.toLowerCase(), alpha: a ? `${a}${a}` : '' }
  }
  return { rgb: `#${h.slice(0, 6)}`.toLowerCase(), alpha: h.slice(6) }
}

/** A native color swatch (hex only) kept in sync with a free-text field that
 * accepts any CSS color string; the swatch falls back to a neutral default
 * whenever the text isn't a hex value it can render. Picking on the swatch keeps
 * an existing alpha channel. */
export default function ColorParam({ id, spec, value, onChange, error, describedBy }: ControlProps<'color', string>) {
  const isHex = HEX_RE.test(value)
  const fallback = spec.default && HEX_RE.test(spec.default) ? splitHex(spec.default).rgb : '#000000'
  const { rgb, alpha } = isHex ? splitHex(value) : { rgb: fallback, alpha: '' }

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        className="h-[30px] w-9 shrink-0 cursor-pointer rounded-md border bg-surface p-0.5"
        aria-label={`${spec.label} swatch`}
        title={isHex ? undefined : 'not a hex colour — showing a placeholder swatch'}
        value={rgb}
        onChange={e => onChange(e.target.value + alpha)}
      />
      <input
        id={id}
        className="field h-[30px] min-w-0 flex-1 font-mono text-[12.5px]"
        placeholder={spec.placeholder}
        spellCheck={false}
        value={value}
        aria-invalid={invalid(error)}
        aria-describedby={describedBy}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}
