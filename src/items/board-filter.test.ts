import { describe, expect, it } from 'vitest'
import { WORKPLACE_LANES } from '@/domain/lanes'
import type { WorkItemSummary } from '@/domain/workplace'
import {
  EMPTY_BOARD_FILTER,
  applyBoardFilter,
  assigneesOf,
  isBoardFilterActive,
  labelsOf,
  ownersOf,
  parseBoardFilter,
  withBoardFilterInQuery,
  type BoardFilter,
} from '@/items/board-filter'

function item(
  overrides: Partial<WorkItemSummary> & { id: string },
): WorkItemSummary {
  return {
    boardId: 'fictional-board',
    title: `Title for ${overrides.id}`,
    lane: 'ready',
    owner: 'Fictional Agent Quill',
    description: '',
    labels: [],
    assignees: [],
    priority: 'unset',
    dueDate: null,
    percentDone: 0,
    checklist: [],
    comments: [],
    attachments: [],
    coverColour: null,
    coverImageUrl: null,
    coverAttachmentId: null,
    position: 0,
    ...overrides,
  }
}

function filter(overrides: Partial<BoardFilter> = {}): BoardFilter {
  return { ...EMPTY_BOARD_FILTER, ...overrides }
}

const NOW = new Date('2026-08-27T12:00:00.000Z')

const board: readonly WorkItemSummary[] = [
  item({ id: 'a', lane: 'inbox', owner: 'Fictional Agent Quill', title: 'Triage the intake note' }),
  item({ id: 'b', lane: 'ready', owner: 'Fictional Agent Birch', title: 'Draft the delivery outline' }),
  item({ id: 'c', lane: 'ready', owner: 'Fictional Agent Quill', title: 'Draft the outreach list' }),
  item({ id: 'd', lane: 'done', owner: 'Fictional Agent Birch', title: 'Archive the intake note' }),
]

const labelled: readonly WorkItemSummary[] = [
  item({
    id: 'intake',
    labels: [{ id: 'label-intake', title: 'Intake', colour: '#1973ff' }],
  }),
  item({
    id: 'delivery',
    labels: [{ id: 'label-delivery', title: 'Delivery', colour: '#00db60' }],
  }),
  item({
    id: 'both',
    labels: [
      { id: 'label-intake', title: 'Intake', colour: '#1973ff' },
      { id: 'label-delivery', title: 'Delivery', colour: '#00db60' },
    ],
  }),
  item({ id: 'plain' }),
]

const assigned: readonly WorkItemSummary[] = [
  item({
    id: 'wren',
    assignees: [{ id: 'human-wren', name: 'Fictional Human Wren' }],
  }),
  item({
    id: 'ember',
    assignees: [{ id: 'human-ember', name: 'Fictional Operator Ember' }],
  }),
  item({
    id: 'both',
    assignees: [
      { id: 'human-wren', name: 'Fictional Human Wren' },
      { id: 'human-ember', name: 'Fictional Operator Ember' },
    ],
  }),
  item({ id: 'nobody' }),
]

const dated: readonly WorkItemSummary[] = [
  item({ id: 'overdue', dueDate: '2026-08-20' }),
  item({ id: 'upcoming', dueDate: '2026-09-04' }),
  item({ id: 'none' }),
]

function idsOf(items: readonly WorkItemSummary[]): string[] {
  return items.map((entry) => entry.id)
}

describe('board filter — each criterion alone', () => {
  it('keeps every item when nothing is filtered', () => {
    expect(idsOf(applyBoardFilter(board, EMPTY_BOARD_FILTER, NOW))).toEqual(['a', 'b', 'c', 'd'])
    expect(isBoardFilterActive(EMPTY_BOARD_FILTER)).toBe(false)
  })

  it('narrows to the chosen lanes, one or several', () => {
    expect(idsOf(applyBoardFilter(board, filter({ lanes: ['ready'] }), NOW))).toEqual(['b', 'c'])
    expect(idsOf(applyBoardFilter(board, filter({ lanes: ['inbox', 'done'] }), NOW))).toEqual([
      'a',
      'd',
    ])
  })

  it('narrows to one owner', () => {
    expect(idsOf(applyBoardFilter(board, filter({ owner: 'Fictional Agent Birch' }), NOW))).toEqual([
      'b',
      'd',
    ])
  })

  it('matches a title substring without regard to case', () => {
    expect(idsOf(applyBoardFilter(board, filter({ search: 'DRAFT' }), NOW))).toEqual(['b', 'c'])
    expect(idsOf(applyBoardFilter(board, filter({ search: 'intake' }), NOW))).toEqual(['a', 'd'])
    expect(idsOf(applyBoardFilter(board, filter({ search: '   ' }), NOW))).toEqual([
      'a',
      'b',
      'c',
      'd',
    ])
  })

  it('searches the title and never the owner or the lane', () => {
    expect(applyBoardFilter(board, filter({ search: 'Quill' }), NOW)).toEqual([])
    expect(applyBoardFilter(board, filter({ search: 'ready' }), NOW)).toEqual([])
  })

  it('matches a description substring after stripping markup', () => {
    const withCopy = [
      item({
        id: 'outlined',
        title: 'Write the body',
        description: '<p>Outline the fictional delivery in three sections.</p>',
      }),
      item({ id: 'silent', title: 'Write the body' }),
    ]

    expect(idsOf(applyBoardFilter(withCopy, filter({ search: 'SECTIONS' }), NOW))).toEqual([
      'outlined',
    ])
  })

  it('narrows to one assignee and treats unassigned as its own choice', () => {
    expect(idsOf(applyBoardFilter(assigned, filter({ assignee: 'human-wren' }), NOW))).toEqual([
      'wren',
      'both',
    ])
    expect(idsOf(applyBoardFilter(assigned, filter({ assignee: 'none' }), NOW))).toEqual(['nobody'])
  })

  it('narrows to one label', () => {
    expect(idsOf(applyBoardFilter(labelled, filter({ label: 'label-intake' }), NOW))).toEqual([
      'intake',
      'both',
    ])
  })

  it('narrows by due date: has, overdue, or none', () => {
    expect(idsOf(applyBoardFilter(dated, filter({ due: 'has' }), NOW))).toEqual([
      'overdue',
      'upcoming',
    ])
    expect(idsOf(applyBoardFilter(dated, filter({ due: 'overdue' }), NOW))).toEqual(['overdue'])
    expect(idsOf(applyBoardFilter(dated, filter({ due: 'none' }), NOW))).toEqual(['none'])
  })
})

describe('board filter — the criteria combine with AND', () => {
  it('requires an item to satisfy lane, owner and search together', () => {
    expect(
      idsOf(
        applyBoardFilter(
          board,
          filter({ lanes: ['ready'], owner: 'Fictional Agent Quill', search: 'draft' }),
          NOW,
        ),
      ),
    ).toEqual(['c'])
  })

  it('requires an item to satisfy assignee, label and due together', () => {
    const mixed = [
      item({
        id: 'keep',
        assignees: [{ id: 'human-wren', name: 'Fictional Human Wren' }],
        labels: [{ id: 'label-intake', title: 'Intake', colour: '#1973ff' }],
        dueDate: '2026-08-20',
      }),
      item({
        id: 'wrong-due',
        assignees: [{ id: 'human-wren', name: 'Fictional Human Wren' }],
        labels: [{ id: 'label-intake', title: 'Intake', colour: '#1973ff' }],
        dueDate: '2026-09-04',
      }),
      item({
        id: 'wrong-label',
        assignees: [{ id: 'human-wren', name: 'Fictional Human Wren' }],
        labels: [{ id: 'label-delivery', title: 'Delivery', colour: '#00db60' }],
        dueDate: '2026-08-20',
      }),
    ]

    expect(
      idsOf(
        applyBoardFilter(
          mixed,
          filter({ assignee: 'human-wren', label: 'label-intake', due: 'overdue' }),
          NOW,
        ),
      ),
    ).toEqual(['keep'])
  })

  it('yields nothing when one criterion excludes what the others allow', () => {
    expect(
      applyBoardFilter(
        board,
        filter({ lanes: ['inbox'], owner: 'Fictional Agent Birch' }),
        NOW,
      ),
    ).toEqual([])
  })
})

describe('board filter — the owners come from the board', () => {
  it('offers each owner present on the board once, and no hard-coded name', () => {
    expect(ownersOf(board)).toEqual(['Fictional Agent Birch', 'Fictional Agent Quill'])
  })

  it('offers nothing for a board that holds nothing', () => {
    expect(ownersOf([])).toEqual([])
  })

  it('recomputes for a different board rather than remembering the last one', () => {
    expect(ownersOf([item({ id: 'x', owner: 'Fictional Agent Marlow' })])).toEqual([
      'Fictional Agent Marlow',
    ])
  })
})

describe('board filter — assignees and labels come from the board', () => {
  it('offers each assignee once, and no hard-coded name', () => {
    expect(assigneesOf(assigned).map((entry) => entry.id)).toEqual(['human-wren', 'human-ember'])
  })

  it('offers each label once, and no hard-coded title', () => {
    expect(labelsOf(labelled).map((entry) => entry.id)).toEqual(['label-delivery', 'label-intake'])
  })

  it('offers nothing for a board that holds neither', () => {
    expect(assigneesOf(board)).toEqual([])
    expect(labelsOf(board)).toEqual([])
  })
})

describe('board filter — the URL carries the active filter', () => {
  it('writes nothing for an unfiltered board', () => {
    expect(withBoardFilterInQuery('', EMPTY_BOARD_FILTER)).toBe('')
  })

  it('round-trips lane, owner and search through the query string', () => {
    const active = filter({
      lanes: ['ready', 'blocked'],
      owner: 'Fictional Agent Quill',
      search: 'draft',
    })

    expect(parseBoardFilter(withBoardFilterInQuery('', active))).toEqual(active)
  })

  it('round-trips assignee, label and due through the query string', () => {
    const active = filter({
      assignee: 'human-wren',
      label: 'label-intake',
      due: 'overdue',
    })

    expect(parseBoardFilter(withBoardFilterInQuery('', active))).toEqual(active)
  })

  it('reads a repeated lane parameter as several lanes', () => {
    expect(parseBoardFilter('?lane=ready&lane=done').lanes).toEqual(['ready', 'done'])
  })

  it('keeps query parameters it does not own', () => {
    const query = withBoardFilterInQuery('?board=fictional-board', filter({ search: 'draft' }))

    expect(new URLSearchParams(query).get('board')).toBe('fictional-board')
    expect(new URLSearchParams(query).get('q')).toBe('draft')
  })

  it('drops its own parameters again when the filter is cleared', () => {
    const query = withBoardFilterInQuery(
      '?board=fictional-board&lane=ready&owner=Someone&q=draft&assignee=human-wren&label=label-intake&due=overdue',
      EMPTY_BOARD_FILTER,
    )

    expect(new URLSearchParams(query).get('board')).toBe('fictional-board')
    expect(new URLSearchParams(query).has('lane')).toBe(false)
    expect(new URLSearchParams(query).has('owner')).toBe(false)
    expect(new URLSearchParams(query).has('q')).toBe(false)
    expect(new URLSearchParams(query).has('assignee')).toBe(false)
    expect(new URLSearchParams(query).has('label')).toBe(false)
    expect(new URLSearchParams(query).has('due')).toBe(false)
  })
})

describe('board filter — rejection: a lane the Colony does not define', () => {
  it('drops an unknown lane from the URL rather than filtering by it', () => {
    expect(parseBoardFilter('?lane=archived').lanes).toEqual([])
    expect(parseBoardFilter('?lane=archived&lane=ready').lanes).toEqual(['ready'])
  })

  it('drops an unknown due mode rather than filtering by it', () => {
    expect(parseBoardFilter('?due=next-week').due).toBe('')
    expect(isBoardFilterActive(parseBoardFilter('?due=next-week'))).toBe(false)
  })

  it('reads an absent query string as no filter at all', () => {
    expect(parseBoardFilter('')).toEqual(EMPTY_BOARD_FILTER)
    expect(isBoardFilterActive(parseBoardFilter('?board=fictional-board'))).toBe(false)
  })

  it('keeps the six Colony lanes as the only filterable lanes', () => {
    const everyLane = parseBoardFilter(
      WORKPLACE_LANES.map((lane) => `lane=${lane}`).join('&'),
    )

    expect(everyLane.lanes).toEqual([...WORKPLACE_LANES])
  })
})
