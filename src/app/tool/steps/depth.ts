/**
 * How deep a step sits: 0 for the top-level pipeline, 1 inside a branch lane or a
 * macro or "run on each" body, and so on. Nested cards render compact, and their
 * timeline marks use letters so they never read as top-level step numbers.
 */
import { createContext, useContext } from 'react'

export const StepDepth = createContext(0)

export const useStepDepth = (): number => useContext(StepDepth)

/** The timeline mark for the step at `index`: `01`, `02`… at the top level, `a`, `b`… nested. */
export function stepMark(index: number, depth: number): string {
  if (depth === 0) return String(index + 1).padStart(2, '0')
  return index < 26 ? String.fromCharCode(97 + index) : String(index + 1)
}
