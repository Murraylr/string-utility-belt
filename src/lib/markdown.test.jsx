import { describe, it, expect } from 'vitest'
import { mdToHtml } from './markdown'
describe('mdToHtml', () => {
  it('renders bold', () => {
    expect(mdToHtml('**hi**')).toContain('<strong>hi</strong>')
  })
})
