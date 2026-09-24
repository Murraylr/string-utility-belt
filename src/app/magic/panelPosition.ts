/**
 * Pure geometry for `MagicButton`'s popover, kept out of that component so it stays
 * fast-refresh-friendly (a component file may only export components) and is easy to
 * unit-test directly — real layout only exists in a browser, not jsdom.
 */

const PANEL_WIDTH = 320
const VIEWPORT_GUTTER = 16

/**
 * The popover's default `right: 0` anchors it to the trigger button, which is fine on a
 * wide toolbar but runs the panel off the left edge of the viewport when that button sits
 * near the left on a narrow one (the toolbar wraps). Clamp its `left` (in `wrap`'s own
 * coordinate space, since the panel is absolutely positioned inside it) so it always stays
 * within the viewport, right-aligned to the button when there's room for that.
 */
export function clampedPanelLeft(
  buttonRight: number, wrapLeft: number, viewportWidth: number,
): { left: number; width: number } {
  const width = Math.min(PANEL_WIDTH, viewportWidth - VIEWPORT_GUTTER * 2)
  const maxLeft = viewportWidth - VIEWPORT_GUTTER - width
  const viewportLeft = Math.max(VIEWPORT_GUTTER, Math.min(buttonRight - width, maxLeft))
  return { left: viewportLeft - wrapLeft, width }
}
