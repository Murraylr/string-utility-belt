/** Minimal param inputs for the popup: string/number/boolean/select only — every
 * other kind (code, regex, keyvalue, file, …) just runs with its default value. */
import type { UtilityMeta } from '../../../../src/core/registry'

const SUPPORTED = new Set(['string', 'number', 'boolean', 'select'])

export function renderParamControls(container: HTMLElement, meta: UtilityMeta): void {
  container.innerHTML = ''
  for (const [key, spec] of Object.entries(meta.params)) {
    if (!SUPPORTED.has(spec.kind)) continue

    // Each control sits inside its own label (which also names it with `for`):
    // a checkbox before its text, any other control under a small caption.
    const label = document.createElement('label')
    label.htmlFor = `param-${key}`
    const text = spec.label ?? key

    let control: HTMLInputElement | HTMLSelectElement
    if (spec.kind === 'select') {
      const select = document.createElement('select')
      for (const option of spec.options) {
        const opt = document.createElement('option')
        opt.value = option
        opt.textContent = option
        select.appendChild(opt)
      }
      if (spec.default !== undefined) select.value = spec.default
      control = select
    } else if (spec.kind === 'boolean') {
      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.checked = !!spec.default
      control = checkbox
    } else {
      const input = document.createElement('input')
      input.type = spec.kind === 'number' ? 'number' : 'text'
      input.spellcheck = false
      if (spec.kind === 'number') {
        if (spec.min !== undefined) input.min = String(spec.min)
        if (spec.max !== undefined) input.max = String(spec.max)
        if (spec.step !== undefined) input.step = String(spec.step)
      }
      if (spec.kind === 'string' && spec.placeholder) input.placeholder = spec.placeholder
      if (spec.default !== undefined) input.value = String(spec.default)
      control = input
    }
    control.id = `param-${key}`
    control.dataset.paramKey = key

    if (spec.kind === 'boolean') {
      label.className = 'param-bool'
      label.append(control, text)
    } else {
      label.className = 'param'
      control.className = spec.kind === 'select' ? 'select' : 'field'
      const caption = document.createElement('span')
      caption.textContent = text
      label.append(caption, control)
    }
    container.appendChild(label)
  }
}

/** Reads back every param a control was rendered for; anything skipped by
 * `renderParamControls` (an unsupported kind) is simply absent — the caller's
 * default-fill (`resolveParams` inside `runUtilityById`) covers it. */
export function readParamValues(container: HTMLElement, meta: UtilityMeta): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const [key, spec] of Object.entries(meta.params)) {
    const el = container.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-param-key="${key}"]`)
    if (!el) continue
    if (spec.kind === 'boolean') values[key] = (el as HTMLInputElement).checked
    else if (spec.kind === 'number') values[key] = el.value === '' ? undefined : Number(el.value)
    else values[key] = el.value
  }
  return values
}
