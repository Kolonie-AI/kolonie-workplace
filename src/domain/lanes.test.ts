import { describe, expect, it } from 'vitest'
import { WORKPLACE_LANES, isLane } from '@/domain/lanes'

describe('workplace lanes', () => {
  it('are exactly the six Colony lanes, in board order', () => {
    expect(WORKPLACE_LANES).toEqual([
      'inbox',
      'ready',
      'in_progress',
      'blocked',
      'review',
      'done',
    ])
  })

  it('rejects a lane the Colony does not define', () => {
    expect(isLane('done')).toBe(true)
    expect(isLane('archived')).toBe(false)
  })
})
