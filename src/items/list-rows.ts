import type { Lane } from '@/domain/lanes'
import type { WorkItemSummary } from '@/domain/workplace'
import type { LaneColumn } from '@/items/lane-columns'

/**
 * One row of the List view: the item, the lane it sits in, and whether it is
 * the first item of that lane.
 *
 * `isLaneStart` exists so the lane is legible at a glance without the List
 * becoming configurable. It is a property of the ordering, not a control.
 */
export interface ListRow {
  readonly item: WorkItemSummary
  readonly lane: Lane
  readonly isLaneStart: boolean
}

/**
 * The single documented ordering of the List view: lanes in the fixed Colony
 * order — inbox, ready, in_progress, blocked, review, done — and, within a
 * lane, the order the gateway reported.
 *
 * It is deterministic because both of those are: the lane order is a constant
 * and never a sort over item data, and within a lane nothing is re-sorted, so
 * no tie can be broken two ways. It takes the very columns the Kanban renders,
 * so List cannot order a different set than Kanban holds — only the same set
 * flattened. A lane holding nothing contributes no row; an empty lane is a
 * Kanban column, and in a dense vertical list it would be a heading over
 * nothing.
 *
 * There is deliberately no argument here: the ordering is one choice, made
 * once, and the List view offers no sorting control to change it.
 */
export function orderForList(columns: readonly LaneColumn[]): readonly ListRow[] {
  return columns.flatMap((column) =>
    column.items.map((item, index) => ({
      item,
      lane: column.lane,
      isLaneStart: index === 0,
    })),
  )
}
