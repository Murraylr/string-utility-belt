/** The line icons the options page draws from script: Lucide's paths, inlined (extension pages load nothing remote). */
const SVG_NS = 'http://www.w3.org/2000/svg'

const PATHS = {
  'arrow-up': ['m5 12 7-7 7 7', 'M12 19V5'],
  'arrow-down': ['M12 5v14', 'm19 12-7 7-7-7'],
} as const

export type IconName = keyof typeof PATHS

/** A decorative (`aria-hidden`) icon, sized by the font size around it; the control holding it carries the name. */
export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  const attrs: Record<string, string> = {
    class: 'icon', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2',
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true',
  }
  for (const [key, value] of Object.entries(attrs)) svg.setAttribute(key, value)
  for (const d of PATHS[name]) {
    const path = document.createElementNS(SVG_NS, 'path')
    path.setAttribute('d', d)
    svg.appendChild(path)
  }
  return svg
}
