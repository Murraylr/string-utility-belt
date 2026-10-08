/** Steps toolbar control (§8.13): turn every step, nested ones included, off or on at once. */
import React from 'react'
import { walkSteps } from '@/core/steps'
import { useOptionalTool } from '@/app/ToolContext'

export default function BulkToggle() {
  const tool = useOptionalTool()
  // every step on (or none at all): the button turns them off; otherwise it turns them all on
  const allOn = !tool || walkSteps(tool.state.steps, s => (s.enabled === false ? false : undefined))
  return (
    <button type="button" className="btn-ghost" disabled={!tool || tool.state.steps.length === 0}
      onClick={() => tool?.dispatch({ type: 'SET_ALL_ENABLED', enabled: !allOn })}>
      {allOn ? 'Turn all off' : 'Turn all on'}
    </button>
  )
}
