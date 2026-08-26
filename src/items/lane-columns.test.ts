import { describe, expect, it } from 'vitest'
import { WORKPLACE_LANES } from '@/domain/lanes'
import type { WorkItemSummary } from '@/domain/workplace'
import { partitionIntoLanes } from '@/items/lane-columns'

function item(overrides: Partial<WorkItemSummary> & { id: string }): WorkItemSummary {
  return {
    boardId: 'board-under-test',
    title: `Title for ${overrides.id}`,
    lane: 'inbox',
    owner: 'Fictional Owner',
    ...overrides,
  }
}

describe('lane columns', () => {
  it('produces exactly the six Colony lanes, in the documented order, for an empty board', () => {
    const { columns, invalid } = partitionIntoLanes([])

    expect(columns.map((column) => column.lane)).toEqual([...WORKPLACE_LANES])
    expect(columns.every((column) => column.items.length === 0)).toBe(true)
    expect(invalid).toEqual([])
  })

  it('places an item in the lane matching its value and in no other lane', () => {
    const ready = item({ id: 'a', lane: 'ready' })
    const done = item({ id: 'b', lane: 'done' })

    const { columns } = partitionIntoLanes([ready, done])

    for (const column of columns) {
      const expected =
        column.lane === 'ready' ? ['a'] : column.lane === 'done' ? ['b'] : []

      expect(column.items.map((entry) => entry.id)).toEqual(expected)
    }
  })

  it('keeps the order the gateway returned within a lane', () => {
    const { columns } = partitionIntoLanes([
      item({ id: 'second', lane: 'in_progress' }),
      item({ id: 'first', lane: 'in_progress' }),
    ])

    const inProgress = columns.find((column) => column.lane === 'in_progress')

    expect(inProgress?.items.map((entry) => entry.id)).toEqual(['second', 'first'])
  })

  it('renders an empty lane as a column rather than dropping it', () => {
    const { columns } = partitionIntoLanes([item({ id: 'only', lane: 'review' })])

    expect(columns).toHaveLength(WORKPLACE_LANES.length)
    expect(columns.filter((column) => column.items.length === 0)).toHaveLength(
      WORKPLACE_LANES.length - 1,
    )
  })
})

describe('lane columns — rejection: a lane the Colony does not define', () => {
  it('does not silently place an unknown lane in inbox', () => {
    const { columns } = partitionIntoLanes([
      { ...item({ id: 'stray' }), lane: 'archived' } as unknown as WorkItemSummary,
    ])

    const inbox = columns.find((column) => column.lane === 'inbox')

    expect(inbox?.items).toEqual([])
    expect(columns.flatMap((column) => column.items.map((entry) => entry.id))).toEqual([])
  })

  it('surfaces the unknown-lane item as invalid data rather than losing it', () => {
    const { invalid } = partitionIntoLanes([
      { ...item({ id: 'stray' }), lane: 'archived' } as unknown as WorkItemSummary,
      item({ id: 'sound', lane: 'ready' }),
    ])

    expect(invalid).toHaveLength(1)
    expect(invalid[0]?.item.id).toBe('stray')
    expect(invalid[0]?.reportedLane).toBe('archived')
  })

  it('rejects an empty, mis-cased or whitespace lane rather than guessing', () => {
    const { invalid, columns } = partitionIntoLanes([
      { ...item({ id: 'empty' }), lane: '' } as unknown as WorkItemSummary,
      { ...item({ id: 'cased' }), lane: 'Ready' } as unknown as WorkItemSummary,
      { ...item({ id: 'padded' }), lane: ' ready ' } as unknown as WorkItemSummary,
    ])

    expect(invalid.map((entry) => entry.item.id)).toEqual(['empty', 'cased', 'padded'])
    expect(columns.flatMap((column) => column.items)).toEqual([])
  })

  it('keeps the sound items on the board while an unsound one is surfaced', () => {
    const { columns, invalid } = partitionIntoLanes([
      { ...item({ id: 'stray' }), lane: 'archived' } as unknown as WorkItemSummary,
      item({ id: 'sound', lane: 'ready' }),
    ])

    const ready = columns.find((column) => column.lane === 'ready')

    expect(ready?.items.map((entry) => entry.id)).toEqual(['sound'])
    expect(invalid.map((entry) => entry.item.id)).toEqual(['stray'])
  })

  it('reports a non-string lane without throwing', () => {
    const { invalid, columns } = partitionIntoLanes([
      { ...item({ id: 'nullish' }), lane: null } as unknown as WorkItemSummary,
      { ...item({ id: 'numeric' }), lane: 3 } as unknown as WorkItemSummary,
    ])

    expect(invalid.map((entry) => entry.item.id)).toEqual(['nullish', 'numeric'])
    expect(invalid.map((entry) => entry.reportedLane)).toEqual(['null', '3'])
    expect(columns.flatMap((column) => column.items)).toEqual([])
  })
})
