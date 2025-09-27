import { render } from '@testing-library/react'
import { describe, it } from 'vitest'
import BlogPost from './BlogPost'

describe('<BlogPost />', () => {
  it('mounts', () => {
    render(<BlogPost slug="base64-encode-decode-online" />)
  })
})
