import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readSelection as readSource, replaceSelectionOrCopy as writeSource } from './replace'

/**
 * `executeScript` ships `func.toString()` to the page, so every test runs the
 * functions re-created from their source text: a reference to anything
 * outside the function body fails here exactly as it would in the page.
 */
function serialized<F extends (...args: never[]) => unknown>(fn: F): F {
  return new Function(`return (${fn.toString()})`)() as F
}
const readSelection = serialized(readSource)
const replaceSelectionOrCopy = serialized(writeSource)

let writeText: ReturnType<typeof vi.fn>

beforeEach(() => {
  document.body.innerHTML = ''
  window.getSelection()?.removeAllRanges()
  writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
})

afterEach(() => {
  delete (document as { execCommand?: unknown }).execCommand
})

function field<T extends 'input' | 'textarea'>(tag: T, value: string, type = 'text'): HTMLElementTagNameMap[T] {
  const el = document.createElement(tag)
  if (el instanceof HTMLInputElement) el.type = type
  el.value = value
  document.body.appendChild(el)
  el.focus()
  return el
}

function editable(html: string): HTMLDivElement {
  const div = document.createElement('div')
  div.contentEditable = 'true'
  div.tabIndex = 0 // jsdom (unlike browsers) only focuses contenteditable elements with a tabIndex
  div.innerHTML = html
  document.body.appendChild(div)
  div.focus()
  return div
}

function select(node: Node, start: number, end: number): void {
  const range = document.createRange()
  range.setStart(node, start)
  range.setEnd(node, end)
  const selection = window.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
}

describe('readSelection', () => {
  it('returns the selected slice of a focused input', () => {
    const input = field('input', 'hello world')
    input.setSelectionRange(6, 11)
    expect(readSelection()).toEqual({ text: 'world', whole: false })
  })

  it('keeps line breaks in a textarea selection (the menu\'s selectionText turns them into spaces)', () => {
    const textarea = field('textarea', 'a\nb\nc')
    textarea.setSelectionRange(0, 3)
    expect(readSelection()).toEqual({ text: 'a\nb', whole: false })
  })

  it('returns the whole value of a focused field with only a caret', () => {
    const textarea = field('textarea', 'line 1\nline 2')
    textarea.setSelectionRange(3, 3)
    expect(readSelection()).toEqual({ text: 'line 1\nline 2', whole: true })
  })

  it('never reads a password field', () => {
    const input = field('input', 'hunter2', 'password')
    input.setSelectionRange(0, 7)
    expect(readSelection()).toBeNull()
  })

  it('returns selected page text (with its line breaks) when no field has focus', () => {
    const p = document.createElement('pre')
    p.textContent = 'one\ntwo'
    document.body.appendChild(p)
    select(p.firstChild!, 0, 7)
    expect(readSelection()).toEqual({ text: 'one\ntwo', whole: false })
  })

  it('finds a field focused inside an open shadow root', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const input = document.createElement('input')
    input.value = 'shadow text'
    host.attachShadow({ mode: 'open' }).appendChild(input)
    input.focus()
    input.setSelectionRange(0, 6)
    expect(readSelection()).toEqual({ text: 'shadow', whole: false })
  })

  it('is null when nothing is selected or focused', () => {
    expect(readSelection()).toBeNull()
  })
})

describe('replaceSelectionOrCopy: text fields', () => {
  it('replaces the selected range of an input and puts the caret after it', async () => {
    const input = field('input', 'hello world')
    input.setSelectionRange(6, 11)
    const onInput = vi.fn()
    input.addEventListener('input', onInput)

    await expect(replaceSelectionOrCopy('there', 'world', false)).resolves.toBe(true)

    expect(input.value).toBe('hello there')
    expect([input.selectionStart, input.selectionEnd]).toEqual([11, 11])
    expect(onInput).toHaveBeenCalledTimes(1)
    expect(writeText).not.toHaveBeenCalled()
  })

  it('replaces a multi-line textarea selection, caret after the inserted text', async () => {
    const textarea = field('textarea', 'keep\nA\nB\nkeep')
    textarea.setSelectionRange(5, 8) // "A\nB"

    await expect(replaceSelectionOrCopy('x\ny\nz', 'A\nB', false)).resolves.toBe(true)

    expect(textarea.value).toBe('keep\nx\ny\nz\nkeep')
    expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([10, 10])
  })

  it('handles emoji / astral characters by UTF-16 offsets', async () => {
    const input = field('input', 'a😀b')
    input.setSelectionRange(1, 3) // the emoji
    await replaceSelectionOrCopy('🎉🎉', '😀', false)
    expect(input.value).toBe('a🎉🎉b')
    expect(input.selectionStart).toBe(5)
  })

  it('replaces the whole value in whole mode', async () => {
    const textarea = field('textarea', 'all of it')
    textarea.setSelectionRange(2, 2)
    await expect(replaceSelectionOrCopy('ALL OF IT', 'all of it', true)).resolves.toBe(true)
    expect(textarea.value).toBe('ALL OF IT')
    expect(textarea.selectionStart).toBe(9)
  })

  it('copies instead of writing when the selection no longer matches what was transformed', async () => {
    const input = field('input', 'hello world')
    input.setSelectionRange(0, 5) // user moved the selection to "hello"

    await expect(replaceSelectionOrCopy('there', 'world', false)).resolves.toBe(false)

    expect(input.value).toBe('hello world')
    expect(writeText).toHaveBeenCalledWith('there')
  })

  it('copies instead of writing into a read-only or disabled field', async () => {
    const input = field('input', 'locked')
    input.readOnly = true
    input.setSelectionRange(0, 6)
    await expect(replaceSelectionOrCopy('x', 'locked', false)).resolves.toBe(false)
    expect(input.value).toBe('locked')
    expect(writeText).toHaveBeenCalledWith('x')
  })

  it('copies instead of appending to a field without a selection API (email, number)', async () => {
    const input = field('input', 'a@b.co', 'email')
    await expect(replaceSelectionOrCopy('A@B.CO', 'a@b.co', false)).resolves.toBe(false)
    expect(input.value).toBe('a@b.co')
  })

  it('copies only, even with a field focused, when expected is null', async () => {
    const input = field('input', 'abc')
    input.setSelectionRange(0, 3)
    await expect(replaceSelectionOrCopy('x', null, false)).resolves.toBe(false)
    expect(input.value).toBe('abc')
    expect(writeText).toHaveBeenCalledWith('x')
  })

  it('prefers execCommand("insertText") (keeps undo) and does not insert twice', async () => {
    const input = field('input', 'hello world')
    input.setSelectionRange(6, 11)
    const execCommand = vi.fn((command: string, _ui: boolean, value: string) => {
      if (command !== 'insertText') return false
      const { selectionStart: s, selectionEnd: e } = input
      input.value = input.value.slice(0, s!) + value + input.value.slice(e!)
      return true
    })
    Object.assign(document, { execCommand })

    await expect(replaceSelectionOrCopy('there', 'world', false)).resolves.toBe(true)

    expect(execCommand).toHaveBeenCalledWith('insertText', false, 'there')
    expect(input.value).toBe('hello there')
  })
})

describe('replaceSelectionOrCopy: contenteditable', () => {
  it('replaces the selection and collapses the caret after the inserted text', async () => {
    const div = editable('hello world')
    select(div.firstChild!, 6, 11)
    const onInput = vi.fn()
    div.addEventListener('input', onInput)

    await expect(replaceSelectionOrCopy('there', 'world', false)).resolves.toBe(true)

    expect(div.textContent).toBe('hello there')
    const selection = window.getSelection()!
    expect(selection.isCollapsed).toBe(true)
    // caret sits right after the inserted text node
    expect(selection.anchorNode?.childNodes[selection.anchorOffset - 1]?.textContent).toBe('there')
    expect(onInput).toHaveBeenCalledTimes(1)
  })

  it('replaces inside a nested descendant of the editable root', async () => {
    const div = editable('<p>keep <b>bold</b></p>')
    const bold = div.querySelector('b')!
    select(bold.firstChild!, 0, 4)
    await expect(replaceSelectionOrCopy('BOLD', 'bold', false)).resolves.toBe(true)
    expect(div.textContent).toBe('keep BOLD')
  })

  it('copies rather than guessing where to insert when nothing is selected', async () => {
    const div = editable('hello')
    await expect(replaceSelectionOrCopy(' world', 'hello', false)).resolves.toBe(false)
    expect(div.textContent).toBe('hello')
    expect(writeText).toHaveBeenCalledWith(' world')
  })

  it('never writes into a contenteditable="false" island', async () => {
    const div = editable('<span contenteditable="false" tabindex="0">fixed</span>')
    const span = div.querySelector('span')!
    span.focus()
    select(span.firstChild!, 0, 5)
    await expect(replaceSelectionOrCopy('x', 'fixed', false)).resolves.toBe(false)
    expect(span.textContent).toBe('fixed')
  })
})

describe('replaceSelectionOrCopy: copy path', () => {
  it('copies selected non-editable page text', async () => {
    const p = document.createElement('p')
    p.textContent = 'static'
    document.body.appendChild(p)
    select(p.firstChild!, 0, 6)
    await expect(replaceSelectionOrCopy('STATIC', 'static', false)).resolves.toBe(false)
    expect(p.textContent).toBe('static')
    expect(writeText).toHaveBeenCalledWith('STATIC')
  })

  it('falls back to execCommand("copy") and restores focus and selection when the Clipboard API rejects', async () => {
    writeText.mockRejectedValue(new Error('Document is not focused'))
    let copied: string | undefined
    const execCommand = vi.fn((command: string) => {
      if (command !== 'copy') return false
      copied = (document.activeElement as HTMLTextAreaElement).value
      return true
    })
    Object.assign(document, { execCommand })
    const button = document.createElement('button')
    document.body.appendChild(button)
    button.focus()

    await expect(replaceSelectionOrCopy('fallback', null, false)).resolves.toBe(false)

    expect(copied).toBe('fallback')
    expect(document.activeElement).toBe(button)
    expect(document.querySelector('textarea')).toBeNull()
  })
})
