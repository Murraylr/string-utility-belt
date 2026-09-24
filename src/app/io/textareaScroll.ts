/**
 * Scrolls a textarea so the line containing `offset` sits about a third of the way down.
 * setSelectionRange alone does not reliably scroll, and soft-wrapped lines make
 * "line number × line height" wrong, so this measures instead: with the value cut at
 * `offset`, scrollHeight is where that line ends (or just the viewport height when the line
 * is already on the first screen). The value is restored before returning.
 */
export function scrollTextareaTo(el: HTMLTextAreaElement, offset: number): void {
  const full = el.value
  el.value = full.slice(0, offset)
  const lineBottom = el.scrollHeight
  el.value = full
  el.scrollTop = lineBottom <= el.clientHeight ? 0 : lineBottom - el.clientHeight / 3
}
