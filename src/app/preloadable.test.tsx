import React, { Suspense } from 'react'
import { describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { preloadable } from './preloadable'

const Hello = ({ name }: { name: string }) => <p>hello {name}</p>

describe('preloadable', () => {
  it('renders straight away once preloaded: no suspense fallback over pre-rendered content', async () => {
    const Page = preloadable(async () => ({ default: Hello }))
    await Page.preload()
    render(<Suspense fallback={<p>loading</p>}><Page name="ada" /></Suspense>)
    expect(screen.getByText('hello ada')).toBeTruthy()
    expect(screen.queryByText('loading')).toBeNull()
  })

  it('suspends like React.lazy when not preloaded, then renders', async () => {
    let resolve!: (m: { default: typeof Hello }) => void
    const Page = preloadable(() => new Promise<{ default: typeof Hello }>(r => { resolve = r }))
    render(<Suspense fallback={<p>loading</p>}><Page name="bob" /></Suspense>)
    expect(screen.getByText('loading')).toBeTruthy()
    await act(async () => { resolve({ default: Hello }) })
    expect(await screen.findByText('hello bob')).toBeTruthy()
  })

  it('loads the chunk once, and lets a failed load be retried', async () => {
    let calls = 0
    const Page = preloadable(async () => {
      calls++
      if (calls === 1) throw new Error('chunk failed')
      return { default: Hello }
    })
    await expect(Page.preload()).rejects.toThrow('chunk failed')
    await Page.preload()
    await Page.preload()
    expect(calls).toBe(2)
  })
})
