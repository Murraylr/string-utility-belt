/** Toolbar control (§8.13): enable/disable every step at once. Mount is the integrator's job. */
import React from 'react'
import { useOptionalTool } from '@/app/ToolContext'

export default function BulkToggle() {
  const tool = useOptionalTool()
  return (
    <div className="flex items-center gap-1">
      <button type="button" className="btn" disabled={!tool}
        onClick={() => tool?.dispatch({ type: 'SET_ALL_ENABLED', enabled: true })}>
        Enable all
      </button>
      <button type="button" className="btn" disabled={!tool}
        onClick={() => tool?.dispatch({ type: 'SET_ALL_ENABLED', enabled: false })}>
        Disable all
      </button>
    </div>
  )
}
