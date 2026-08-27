import { WORKPLACE_LANES, isLane, type Lane } from '@/domain/lanes'
import type { WorkItemSummary } from '@/domain/workplace'

export interface BoardFilter {
  readonly lanes: readonly Lane[]
  readonly owner: string
  readonly search: string
}

export const EMPTY_BOARD_FILTER: BoardFilter = { lanes: [], owner: '', search: '' }

const LANE_PARAMETER = 'lane'
const OWNER_PARAMETER = 'owner'
const SEARCH_PARAMETER = 'q'

export function isBoardFilterActive(filter: BoardFilter): boolean {
  return (
    filter.lanes.length > 0 || filter.owner !== '' || filter.search.trim() !== ''
  )
}

export function applyBoardFilter(
  items: readonly WorkItemSummary[],
  filter: BoardFilter,
): readonly WorkItemSummary[] {
  const term = filter.search.trim().toLowerCase()

  return items.filter((item) => {
    if (filter.lanes.length > 0 && !filter.lanes.includes(item.lane)) {
      return false
    }

    if (filter.owner !== '' && item.owner !== filter.owner) {
      return false
    }

    return term === '' || item.title.toLowerCase().includes(term)
  })
}

export function ownersOf(items: readonly WorkItemSummary[]): readonly string[] {
  return [...new Set(items.map((item) => item.owner))].sort((left, right) =>
    left.localeCompare(right),
  )
}

/**
 * A lane the Colony does not define is dropped rather than filtered by. A URL
 * can carry anything, and narrowing a board by a status that does not exist
 * would show an empty board that reads as "nothing here".
 */
export function parseBoardFilter(query: string): BoardFilter {
  const parameters = new URLSearchParams(query)
  const lanes = parameters
    .getAll(LANE_PARAMETER)
    .filter((candidate): candidate is Lane => isLane(candidate))

  return {
    lanes: [...new Set(lanes)],
    owner: parameters.get(OWNER_PARAMETER) ?? '',
    search: parameters.get(SEARCH_PARAMETER) ?? '',
  }
}

/**
 * The filter is written into the query string the caller already has, so a
 * parameter this module does not own — the board, for one — survives. Clearing
 * a criterion removes its parameter rather than leaving it empty, which is what
 * makes a cleared filter and a never-filtered board the same URL.
 */
export function withBoardFilterInQuery(query: string, filter: BoardFilter): string {
  const parameters = new URLSearchParams(query)

  parameters.delete(LANE_PARAMETER)
  parameters.delete(OWNER_PARAMETER)
  parameters.delete(SEARCH_PARAMETER)

  for (const lane of WORKPLACE_LANES) {
    if (filter.lanes.includes(lane)) {
      parameters.append(LANE_PARAMETER, lane)
    }
  }

  if (filter.owner !== '') {
    parameters.set(OWNER_PARAMETER, filter.owner)
  }

  if (filter.search.trim() !== '') {
    parameters.set(SEARCH_PARAMETER, filter.search)
  }

  const written = parameters.toString()

  return written === '' ? '' : `?${written}`
}
