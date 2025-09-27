
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StepCard from './StepCard'

describe('StepCard', () => {
  it('renders step index text', () => {
    render(<StepCard index={0} step={{enabled:true, utilityId:'trim', params:{}}} total={1} onMoveUp={()=>{}} onMoveDown={()=>{}} onDelete={()=>{}} onToggle={()=>{}} onChangeParams={()=>{}} onChangeUtil={()=>{}} />)
    expect(screen.getByText('step 1')).toBeTruthy()
  })
})
