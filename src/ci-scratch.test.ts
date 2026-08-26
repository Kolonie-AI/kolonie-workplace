import { describe, expect, it } from 'vitest'

describe('deliberate failure for issue 16 CI verification', () => {
  it('fails on purpose so the Test check can be observed red', () => {
    expect(1 + 1).toBe(3)
  })
})
