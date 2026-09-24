import { describe, expect, it } from 'vitest'
import { readParamValues, renderParamControls } from './paramControls'
import type { UtilityMeta } from '../../../../src/core/registry'

const meta: UtilityMeta = {
  id: 'demo',
  name: 'demo',
  category: 'Test',
  description: '',
  accepts: 'string',
  produces: 'string',
  params: {
    mode: { kind: 'select', label: 'Mode', options: ['upper', 'lower'], default: 'upper' },
    keep: { kind: 'boolean', label: 'Keep', default: false },
    times: { kind: 'number', label: 'Times', default: 1, min: 1 },
    prefix: { kind: 'string', label: 'Prefix', default: '' },
    note: { kind: 'code', label: 'Note', default: 'x' },
  },
  tags: [],
  aliases: [],
  env: [],
  streamable: false,
  exampleCount: 0,
}

describe('renderParamControls', () => {
  it('renders string/number/boolean/select controls and skips other kinds', () => {
    const container = document.createElement('div')
    renderParamControls(container, meta)
    expect(container.querySelectorAll('[data-param-key]')).toHaveLength(4)
    expect(container.querySelector('[data-param-key="note"]')).toBeNull()
  })

  it('every control has a label referencing it by id', () => {
    const container = document.createElement('div')
    renderParamControls(container, meta)
    for (const key of ['mode', 'keep', 'times', 'prefix']) {
      const control = container.querySelector<HTMLElement>(`[data-param-key="${key}"]`)!
      const label = container.querySelector<HTMLLabelElement>(`label[for="${control.id}"]`)
      expect(label).not.toBeNull()
    }
  })

  it('seeds each control with its declared default', () => {
    const container = document.createElement('div')
    renderParamControls(container, meta)
    expect(container.querySelector<HTMLSelectElement>('[data-param-key="mode"]')!.value).toBe('upper')
    expect(container.querySelector<HTMLInputElement>('[data-param-key="keep"]')!.checked).toBe(false)
    expect(container.querySelector<HTMLInputElement>('[data-param-key="times"]')!.value).toBe('1')
  })
})

describe('readParamValues', () => {
  it('reads back edited values and omits the unsupported kind', () => {
    const container = document.createElement('div')
    renderParamControls(container, meta)
    container.querySelector<HTMLSelectElement>('[data-param-key="mode"]')!.value = 'lower'
    container.querySelector<HTMLInputElement>('[data-param-key="keep"]')!.checked = true
    container.querySelector<HTMLInputElement>('[data-param-key="times"]')!.value = '3'

    const values = readParamValues(container, meta)

    expect(values).toEqual({ mode: 'lower', keep: true, times: 3, prefix: '' })
    expect('note' in values).toBe(false)
  })
})
