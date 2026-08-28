import { describe, expect, it } from 'vitest'
import { sanitizeDescription } from '@/detail/sanitize-description'

describe('sanitize description', () => {
  it('keeps the formatting tags the toolbar can produce', () => {
    expect(
      sanitizeDescription(
        '<p><strong>Bold</strong> and <em>italic</em></p><ul><li><code>code</code></li></ul>',
      ),
    ).toBe('<p><strong>Bold</strong> and <em>italic</em></p><ul><li><code>code</code></li></ul>')
  })

  it('strips scripts and event-handler attributes', () => {
    expect(
      sanitizeDescription('<p>Safe<img src="x" onerror="alert(1)"></p><script>alert(2)</script>'),
    ).toBe('<p>Safe</p>')
  })
})
