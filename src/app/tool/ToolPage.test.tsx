import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ToolProvider } from '@/app/ToolContext'
import ToolPage from './ToolPage'

// CodeMirror and its language packs are dynamically imported by the I/O panels;
// mock them the same way IOSection.test.tsx does so this test doesn't pull in a
// real editor instance.
vi.mock('@uiw/react-codemirror', () => ({
  default: (props: any) => <div data-testid="mock-codemirror">{props.value}</div>,
}))
vi.mock('@codemirror/lang-json', () => ({ json: () => null }))
vi.mock('@codemirror/lang-xml', () => ({ xml: () => null }))
vi.mock('@codemirror/lang-html', () => ({ html: () => null }))
vi.mock('@codemirror/lang-sql', () => ({ sql: () => null }))
vi.mock('@codemirror/lang-yaml', () => ({ yaml: () => null }))
vi.mock('@codemirror/lang-markdown', () => ({ markdown: () => null }))

// Feature-slot children belong to other workstreams; stub them so this test
// stays focused on ToolPage's own layout/wiring.
vi.mock('@/app/commands/ToolCommandBridge', () => ({ default: () => null }))
vi.mock('@/app/magic/MagicButton', () => ({ default: () => null }))
vi.mock('@/app/share/ShareButton', () => ({ default: () => null }))
vi.mock('@/app/library/LibraryButton', () => ({ default: () => null }))
vi.mock('@/app/library/PresetsButton', () => ({ default: () => null }))
vi.mock('@/app/engine/EngineControls', () => ({ default: () => null }))
vi.mock('./steps/BulkToggle', () => ({ default: () => null }))
vi.mock('@/components/UtilityPicker', () => ({
  default: ({ onPick }: { onPick: (id: string) => void }) => (
    <div data-testid="picker-stub"><button onClick={() => onPick('case')}>pick case</button></div>
  ),
}))

function Harness() {
  return (
    <ToolProvider initialSteps={[]} initialInput="" persist={false}>
      <ToolPage />
    </ToolProvider>
  )
}

describe('ToolPage utility picker layout', () => {
  it('opens the picker inside a height-capped, scrollable section', () => {
    render(<Harness />)
    // ToolPage's own header cta and PipelineToolbar's cta share the accessible
    // name "Add utility" (see rule 5 in the workstream brief re: header/toolbar
    // parity) — either opens the same picker, so the first match is enough.
    fireEvent.click(screen.getAllByRole('button', { name: /^add utility$/i })[0])
    const wrapper = screen.getByTestId('picker-stub').closest('section')
    expect(wrapper).not.toBeNull()
    expect(wrapper).toHaveClass('overflow-y-auto')
    expect(wrapper?.className).toMatch(/max-h-/)
  })

  it('closes on the toolbar button (a real toggle; the header cta only opens)', () => {
    render(<Harness />)
    const [headerCta, toolbarToggle] = screen.getAllByRole('button', { name: /^add utility$/i })
    expect(toolbarToggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(headerCta)
    expect(screen.getByTestId('picker-stub')).toBeTruthy()
    expect(toolbarToggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(toolbarToggle)
    expect(screen.queryByTestId('picker-stub')).toBeNull()
    expect(toolbarToggle).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('ToolPage toolbar accessibility', () => {
  it('gives the quick-add select an accessible name and adds the picked utility', () => {
    render(<Harness />)
    const quick = screen.getByRole('combobox', { name: 'quick add a utility' })
    fireEvent.change(quick, { target: { value: 'case' } })
    expect(screen.getByRole('checkbox', { name: 'toggle step 1' })).toBeInTheDocument()
  })
})
