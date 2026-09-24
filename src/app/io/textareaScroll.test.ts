import { describe, expect, it } from 'vitest'
import { scrollTextareaTo } from './textareaScroll'

/** A textarea stand-in with 20px lines in a 100px viewport (scrollHeight never below the viewport, like the real one). */
function fakeTextarea(value: string) {
  const el: { value: string; scrollTop: number; clientHeight: number; readonly scrollHeight: number } = {
    value,
    scrollTop: 0,
    clientHeight: 100,
    get scrollHeight() { return Math.max(el.clientHeight, el.value.split('\n').length * 20) },
  }
  return el as unknown as HTMLTextAreaElement
}

const lines = (n: number) => Array.from({ length: n }, (_, i) => `line ${i + 1}`).join('\n')

describe('scrollTextareaTo', () => {
  it('puts a far-down line about a third of the way into the viewport and restores the value', () => {
    const text = lines(100)
    const el = fakeTextarea(text)
    scrollTextareaTo(el, text.indexOf('line 60'))
    expect(el.value).toBe(text)
    // line 60 spans 1180..1200; it must be visible
    expect(el.scrollTop).toBeLessThanOrEqual(1180)
    expect(el.scrollTop + el.clientHeight).toBeGreaterThanOrEqual(1200)
  })

  it('scrolls to the top for a line already on the first screen', () => {
    const text = lines(100)
    const el = fakeTextarea(text)
    el.scrollTop = 900
    scrollTextareaTo(el, text.indexOf('line 2'))
    expect(el.scrollTop).toBe(0)
  })
})
