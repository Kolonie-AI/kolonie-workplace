import { WORKPLACE_LANES, isLane, type Lane } from '@/domain/lanes'
import type { WorkItemAssignee, WorkItemLabel, WorkItemSummary } from '@/domain/workplace'
import { dueDateState } from '@/kanban/card-facets'

export const BOARD_FILTER_DUE_MODES = ['has', 'overdue', 'none'] as const

export type BoardFilterDue = (typeof BOARD_FILTER_DUE_MODES)[number]

export interface BoardFilter {
  readonly lanes: readonly Lane[]
  readonly owner: string
  readonly search: string
  readonly assignee: string
  readonly label: string
  readonly due: BoardFilterDue | ''
}

export const EMPTY_BOARD_FILTER: BoardFilter = {
  lanes: [],
  owner: '',
  search: '',
  assignee: '',
  label: '',
  due: '',
}

const LANE_PARAMETER = 'lane'
const OWNER_PARAMETER = 'owner'
const SEARCH_PARAMETER = 'q'
const ASSIGNEE_PARAMETER = 'assignee'
const LABEL_PARAMETER = 'label'
const DUE_PARAMETER = 'due'
const UNASSIGNED = 'none'

export function isBoardFilterDue(value: string): value is BoardFilterDue {
  return (BOARD_FILTER_DUE_MODES as readonly string[]).includes(value)
}

export function isBoardFilterActive(filter: BoardFilter): boolean {
  return (
    filter.lanes.length > 0 ||
    filter.owner !== '' ||
    filter.search.trim() !== '' ||
    filter.assignee !== '' ||
    filter.label !== '' ||
    filter.due !== ''
  )
}

function searchableText(value: string | undefined): string {
  return (value ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
}

export function applyBoardFilter(
  items: readonly WorkItemSummary[],
  filter: BoardFilter,
  now: Date,
): readonly WorkItemSummary[] {
  const term = filter.search.trim().toLowerCase()

  return items.filter((item) => {
    if (filter.lanes.length > 0 && !filter.lanes.includes(item.lane)) {
      return false
    }

    if (filter.owner !== '' && item.owner !== filter.owner) {
      return false
    }

    const itemAssignees = item.assignees ?? []
    const itemLabels = item.labels ?? []

    if (filter.assignee === UNASSIGNED) {
      if (itemAssignees.length > 0) {
        return false
      }
    } else if (
      filter.assignee !== '' &&
      !itemAssignees.some((assignee) => assignee.id === filter.assignee)
    ) {
      return false
    }

    if (filter.label !== '' && !itemLabels.some((label) => label.id === filter.label)) {
      return false
    }

    if (filter.due === 'has' && item.dueDate === null) {
      return false
    }

    if (filter.due === 'none' && item.dueDate !== null) {
      return false
    }

    if (filter.due === 'overdue' && dueDateState(item.dueDate, now) !== 'overdue') {
      return false
    }

    if (term === '') {
      return true
    }

    return (
      item.title.toLowerCase().includes(term) || searchableText(item.description).includes(term)
    )
  })
}

export function ownersOf(items: readonly WorkItemSummary[]): readonly string[] {
  return [...new Set(items.map((item) => item.owner))].sort((left, right) =>
    left.localeCompare(right),
  )
}

export function assigneesOf(items: readonly WorkItemSummary[]): readonly WorkItemAssignee[] {
  const assignees = new Map<string, WorkItemAssignee>()

  for (const item of items) {
    for (const assignee of item.assignees ?? []) {
      assignees.set(assignee.id, assignee)
    }
  }

  return [...assignees.values()].sort((left, right) => left.name.localeCompare(right.name))
}

export function labelsOf(items: readonly WorkItemSummary[]): readonly WorkItemLabel[] {
  const labels = new Map<string, WorkItemLabel>()

  for (const item of items) {
    for (const label of item.labels ?? []) {
      labels.set(label.id, label)
    }
  }

  return [...labels.values()].sort((left, right) => left.title.localeCompare(right.title))
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
  const due = parameters.get(DUE_PARAMETER) ?? ''

  return {
    lanes: [...new Set(lanes)],
    owner: parameters.get(OWNER_PARAMETER) ?? '',
    search: parameters.get(SEARCH_PARAMETER) ?? '',
    assignee: parameters.get(ASSIGNEE_PARAMETER) ?? '',
    label: parameters.get(LABEL_PARAMETER) ?? '',
    due: isBoardFilterDue(due) ? due : '',
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
  parameters.delete(ASSIGNEE_PARAMETER)
  parameters.delete(LABEL_PARAMETER)
  parameters.delete(DUE_PARAMETER)

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

  if (filter.assignee !== '') {
    parameters.set(ASSIGNEE_PARAMETER, filter.assignee)
  }

  if (filter.label !== '') {
    parameters.set(LABEL_PARAMETER, filter.label)
  }

  if (filter.due !== '') {
    parameters.set(DUE_PARAMETER, filter.due)
  }

  const written = parameters.toString()

  return written === '' ? '' : `?${written}`
}
