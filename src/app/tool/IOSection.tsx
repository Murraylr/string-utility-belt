import React from 'react'
import ToolPromo from '@/app/sponsors/ToolPromo'
import InputPanel from './InputPanel'
import OutputPanel from './OutputPanel'
import { useIOLayout } from './ioLayout'

export interface IOSectionProps {
  /** Above the input: the page's title row. */
  header?: React.ReactNode
  /** Below the input: the steps. */
  children?: React.ReactNode
}

/**
 * The tool page's frame: input and steps in the main column, the output in a sticky
 * column beside them (or below them, as one column, when the user picks that or the
 * window is too narrow for two). Under the output, one of our own tools (house-only:
 * no sponsor beside what people paste).
 */
export default function IOSection({ header, children }: IOSectionProps) {
  const [layout] = useIOLayout()
  const beside = layout === 'side-by-side'

  return (
    // one container for both layouts, so switching never remounts the panels (and loses their state)
    <div className={`grid gap-7 items-start ${beside ? 'grid-cols-[repeat(auto-fit,minmax(min(100%,500px),1fr))]' : ''}`}>
      <div className="grid gap-5 min-w-0">
        {header}
        <InputPanel />
        {children}
      </div>
      <div className={`grid gap-3 min-w-0 ${beside ? 'sticky top-[84px]' : ''}`}>
        <OutputPanel />
        <ToolPromo />
      </div>
    </div>
  )
}
