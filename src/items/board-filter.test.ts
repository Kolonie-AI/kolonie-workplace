import { describe, expect, it } from 'vitest'
import { WORKPLACE_LANES } from '@/domain/lanes'
import type { WorkItemSummary } from '@/domain/workplace'
import {
  EMPTY_BOARD_FILTER,
  applyBoardFilter,
  isBoardFilterActive,
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
    ...overrides,
  } as WorkItemSummary
}

function filter(overrides: Partial<BoardFilter> = {}): BoardFilter {
  return { ...EMPTY_BOARD_FILTER, ...overrides }
}

const board: readonly WorkItemSummary[] = [
  item({ id: 'a', lane: 'inbox', owner: 'Fictional Agent Quill', title: 'Triage the intake note' }),
  item({ id: 'b', lane: 'ready', owner: 'Fictional Agent Birch', title: 'Draft the delivery outline' }),
  item({ id: 'c', lane: 'ready', owner: 'Fictional Agent Quill', title: 'Draft the outreach list' }),
  item({ id: 'd', lane: 'done', owner: 'Fictional Agent Birch', title: 'Archive the intake note' }),
]

function idsOf(items: readonly WorkItemSummary[]): string[] {
  return items.map((entry) => entry.id)
}

describe('board filter — each criterion alone', () => {
  it('keeps every item when nothing is filtered', () => {
    expect(idsOf(applyBoardFilter(board, EMPTY_BOARD_FILTER))).toEqual(['a', 'b', 'c', 'd'])
    expect(isBoardFilterActive(EMPTY_BOARD_FILTER)).toBe(false)
  })

  it('narrows to the chosen lanes, one or several', () => {
    expect(idsOf(applyBoardFilter(board, filter({ lanes: ['ready'] })))).toEqual(['b', 'c'])
    expect(idsOf(applyBoardFilter(board, filter({ lanes: ['inbox', 'done'] })))).toEqual([
      'a',
      'd',
    ])
  })

  it('narrows to one owner', () => {
    expect(idsOf(applyBoardFilter(board, filter({ owner: 'Fictional Agent Birch' })))).toEqual([
      'b',
      'd',
    ])
  })

  it('matches a title substring without regard to case', () => {
    expect(idsOf(applyBoardFilter(board, filter({ search: 'DRAFT' })))).toEqual(['b', 'c'])
    expect(idsOf(applyBoardFilter(board, filter({ search: 'intake' })))).toEqual(['a', 'd'])
    expect(idsOf(applyBoardFilter(board, filter({ search: '   ' })))).toEqual([
      'a',
      'b',
      'c',
      'd',
    ])
  })

  it('searches the title and never the owner or the lane', () => {
    expect(applyBoardFilter(board, filter({ search: 'Quill' }))).toEqual([])
    expect(applyBoardFilter(board, filter({ search: 'ready' }))).toEqual([])
  })
})

describe('board filter — the criteria combine with AND', () => {
  it('requires an item to satisfy lane, owner and search together', () => {
    expect(
      idsOf(
        applyBoardFilter(
          board,
          filter({ lanes: ['ready'], owner: 'Fictional Agent Quill', search: 'draft' }),
        ),
      ),
    ).toEqual(['c'])
  })

  it('yields nothing when one criterion excludes what the others allow', () => {
    expect(
      applyBoardFilter(
        board,
        filter({ lanes: ['inbox'], owner: 'Fictional Agent Birch' }),
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
      '?board=fictional-board&lane=ready&owner=Someone&q=draft',
      EMPTY_BOARD_FILTER,
    )

    expect(new URLSearchParams(query).get('board')).toBe('fictional-board')
    expect(new URLSearchParams(query).has('lane')).toBe(false)
    expect(new URLSearchParams(query).has('owner')).toBe(false)
    expect(new URLSearchParams(query).has('q')).toBe(false)
  })
})

describe('board filter — rejection: a lane the Colony does not define', () => {
  it('drops an unknown lane from the URL rather than filtering by it', () => {
    expect(parseBoardFilter('?lane=archived').lanes).toEqual([])
    expect(parseBoardFilter('?lane=archived&lane=ready').lanes).toEqual(['ready'])
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
