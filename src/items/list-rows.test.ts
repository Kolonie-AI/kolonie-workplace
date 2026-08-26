import { describe, expect, it } from 'vitest'
import { WORKPLACE_LANES } from '@/domain/lanes'
import type { WorkItemSummary } from '@/domain/workplace'
import { partitionIntoLanes } from '@/items/lane-columns'
import { orderForList } from '@/items/list-rows'

function summary(id: string, lane: string): WorkItemSummary {
  return {
    id,
    boardId: 'fictional-board',
    title: `Title for ${id}`,
    lane,
    owner: 'Fictional Owner',
  } as unknown as WorkItemSummary
}

function rowsFor(items: readonly WorkItemSummary[]) {
  return orderForList(partitionIntoLanes(items).columns)
}

describe('list rows — one documented ordering', () => {
  it('orders rows by the fixed Colony lane order, whatever order the gateway returned', () => {
    const rows = rowsFor([
      summary('d', 'done'),
      summary('b', 'ready'),
      summary('a', 'inbox'),
      summary('c', 'blocked'),
    ])

    expect(rows.map((row) => row.item.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(rows.map((row) => row.lane)).toEqual(['inbox', 'ready', 'blocked', 'done'])
  })

  it('keeps the gateway order within a lane rather than re-sorting it', () => {
    const rows = rowsFor([
      summary('second', 'ready'),
      summary('first', 'ready'),
      summary('third', 'ready'),
    ])

    expect(rows.map((row) => row.item.id)).toEqual(['second', 'first', 'third'])
  })

  it('marks the first row of each lane so the lane is legible at a glance', () => {
    const rows = rowsFor([
      summary('r1', 'ready'),
      summary('r2', 'ready'),
      summary('done-1', 'done'),
    ])

    expect(rows.map((row) => row.isLaneStart)).toEqual([true, false, true])
  })

  it('produces no row for a lane that holds nothing', () => {
    const rows = rowsFor([summary('only', 'review')])

    expect(rows).toHaveLength(1)
    expect(rows[0]?.lane).toBe('review')
  })

  it('is deterministic: the same partition ordered twice gives the same ids', () => {
    const items = [summary('x', 'done'), summary('y', 'inbox'), summary('z', 'review')]

    expect(rowsFor(items).map((row) => row.item.id)).toEqual(
      rowsFor(items).map((row) => row.item.id),
    )
  })

  it('emits every lane that holds an item, and never a lane the Colony does not define', () => {
    const rows = rowsFor(WORKPLACE_LANES.map((lane, index) => summary(`item-${index}`, lane)))

    expect(rows.map((row) => row.lane)).toEqual([...WORKPLACE_LANES])
    expect(rows.every((row) => row.isLaneStart)).toBe(true)
  })
})
