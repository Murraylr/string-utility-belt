import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PipelineStep } from '@/types/utility'
import { ToolProvider } from '@/app/ToolContext'
import { __resetExtensionBridgeForTests } from './bridge'
import { installFakeExtension, type FakeExtension } from './fakeExtension'
import SaveToExtensionButton from './SaveToExtensionButton'

const STEPS: PipelineStep[] = [
  { id: 'a', enabled: true, utilityId: 'trim', params: {} },
  { id: 'b', enabled: true, utilityId: 'base64_encode', params: {} },
]

let fake: FakeExtension

function renderButton(steps: PipelineStep[] = STEPS, name?: string) {
  return render(
    <ToolProvider initialSteps={steps} initialName={name} initialInput="" persist={false}>
      <SaveToExtensionButton />
    </ToolProvider>,
  )
}

async function openDialog(steps: PipelineStep[] = STEPS, name?: string) {
  const user = userEvent.setup()
  renderButton(steps, name)
  await user.click(await screen.findByRole('button', { name: 'save to extension' }))
  return user
}

const lastRequest = () => fake.sent.filter(s => s.message.type === 'request').pop()?.message.request

beforeEach(() => {
  __resetExtensionBridgeForTests()
  localStorage.clear()
  fake = installFakeExtension()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SaveToExtensionButton', () => {
  it('renders nothing until the extension answers, then offers the dialog', async () => {
    renderButton()
    expect(screen.queryByRole('button', { name: 'save to extension' })).toBeNull()
    expect(await screen.findByRole('button', { name: 'save to extension' })).toHaveAttribute('aria-haspopup', 'dialog')
  })

  it('renders nothing without the extension', async () => {
    vi.unstubAllGlobals()
    renderButton()
    await new Promise(r => setTimeout(r, 0))
    expect(screen.queryByRole('button', { name: 'save to extension' })).toBeNull()
  })

  it('saves the pipeline under the given name and shows the extension\'s answer', async () => {
    fake.respond(() => ({ ok: true, message: 'Saved "Encode" — it\'s on the right-click menu.' }))
    const user = await openDialog()
    expect(screen.getByRole('dialog', { name: 'Save to extension' })).toBeInTheDocument()

    const save = screen.getByRole('button', { name: 'save pipeline' })
    expect(save).toBeDisabled() // no name yet
    await user.type(screen.getByLabelText('pipeline name'), 'Encode')
    await user.click(save)

    expect(await screen.findByText('Saved "Encode" — it\'s on the right-click menu.')).toBeInTheDocument()
    expect(lastRequest()).toEqual({ type: 'save-pipeline', name: 'Encode', steps: STEPS })
  })

  it('prefills the pipeline\'s own name, and shows an error answer as such', async () => {
    fake.respond(() => ({ ok: false, error: 'The extension holds up to 50 pipelines.' }))
    const user = await openDialog(STEPS, 'My pipeline')
    const nameInput = screen.getByLabelText('pipeline name')
    expect(nameInput).toHaveValue('My pipeline')

    await user.type(nameInput, '{Enter}') // submits the form
    expect(await screen.findByText('The extension holds up to 50 pipelines.')).toHaveClass('text-warn')
  })

  it('refuses up front a pipeline with a step the extension cannot run', async () => {
    await openDialog([...STEPS, { id: 'c', enabled: false, utilityId: 'custom_js', params: {} }], 'Has code')

    expect(screen.getByRole('alert')).toHaveTextContent(/can't run custom javascript/)
    expect(screen.getByRole('button', { name: 'save pipeline' })).toBeDisabled()
  })

  it('cannot save an empty pipeline', async () => {
    await openDialog([], 'Nothing')
    expect(screen.getByText(/add some steps/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'save pipeline' })).toBeDisabled()
  })

  it('sends the starred utilities the extension can run as favourites', async () => {
    localStorage.setItem('sub:pref:favorites', JSON.stringify(['sha3', 'custom_js', 'trim']))
    fake.respond(() => ({ ok: true, message: 'Added 2 favourites to the right-click menu.' }))
    const user = await openDialog()

    expect(screen.getByText(/add your 2 starred utilities/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'add favourites' }))
    expect(await screen.findByText('Added 2 favourites to the right-click menu.')).toBeInTheDocument()
    expect(lastRequest()).toEqual({ type: 'add-favorites', utilityIds: ['sha3', 'trim'] })
  })

  it('has nothing to add without starred utilities', async () => {
    await openDialog()
    expect(screen.getByText(/star utilities in the picker/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'add favourites' })).toBeDisabled()
  })
})
