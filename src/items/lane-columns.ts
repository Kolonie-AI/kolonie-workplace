import { WORKPLACE_LANES, isLane, type Lane } from '@/domain/lanes'
import type { WorkItemSummary } from '@/domain/workplace'

/**
 * The six Colony lanes are fixed. A column is produced for every one of them
 * whether or not it holds an item, so an empty lane is a lane rather than an
 * absence — and no lane is ever produced that the Colony does not define.
 */
export interface LaneColumn {
  readonly lane: Lane
  readonly items: readonly WorkItemSummary[]
}

/**
 * An item whose lane is not one of the six is neither dropped nor folded into
 * `inbox`. Folding it in would put work under a status nobody gave it, and
 * dropping it would hide work from the human the board exists for; both read as
 * a healthy board. It is surfaced as invalid data instead, carrying the lane
 * value that was actually reported so the fault can be traced upstream.
 */
export interface InvalidLaneItem {
  readonly item: WorkItemSummary
  readonly reportedLane: string
}

export interface LanePartition {
  readonly columns: readonly LaneColumn[]
  readonly invalid: readonly InvalidLaneItem[]
}

export function partitionIntoLanes(items: readonly WorkItemSummary[]): LanePartition {
  const collected = new Map<Lane, WorkItemSummary[]>(
    WORKPLACE_LANES.map((lane) => [lane, []]),
  )
  const invalid: InvalidLaneItem[] = []

  for (const item of items) {
    const reported: unknown = item.lane

    if (typeof reported === 'string' && isLane(reported)) {
      collected.get(reported)?.push(item)
      continue
    }

    invalid.push({ item, reportedLane: String(reported) })
  }

  return {
    columns: WORKPLACE_LANES.map((lane) => ({
      lane,
      items: (collected.get(lane) ?? [])
        .slice()
        .sort((left, right) => left.position - right.position),
    })),
    invalid,
  }
}
