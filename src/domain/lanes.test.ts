import { describe, expect, it } from 'vitest'
import { WORKPLACE_LANES, WORKPLACE_LANE_LABELS, isLane } from '@/domain/lanes'

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

  it('carries a human label for each lane and for nothing else', () => {
    expect(Object.keys(WORKPLACE_LANE_LABELS)).toEqual([...WORKPLACE_LANES])
    expect(WORKPLACE_LANE_LABELS.in_progress).toBe('In progress')
    expect(WORKPLACE_LANE_LABELS.inbox).toBe('Inbox')
    expect(WORKPLACE_LANE_LABELS.blocked).toBe('Blocked')
  })
})
