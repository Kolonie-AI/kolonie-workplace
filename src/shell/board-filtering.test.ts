import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/vue'
import { WORKPLACE_CLOCK } from '@/clock/workplace-clock'
import type { BoardId, WorkItemSummary } from '@/domain/workplace'
import type { TaskGateway } from '@/gateway/task-gateway'
import { TASK_GATEWAY } from '@/gateway/provide-gateway'
import { createFixtureTaskGateway } from '@/gateway/fixture-task-gateway'
import {
  FIXTURE_BOARDS,
  FIXTURE_HUMANS,
  FIXTURE_ITEMS,
  FIXTURE_LABELS,
} from '@/fixtures/catalogue'
import AppShell from '@/shell/AppShell.vue'
import { createFixtureWorkplaceSession } from '@/session/fixture-workplace-session'
import { WORKPLACE_SESSION, type WorkplaceSession } from '@/session/workplace-session'

const FIXED_NOW = new Date('2026-08-31T12:00:00.000Z')

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

async function signedInSession(humanId: string): Promise<WorkplaceSession> {
  const session = createFixtureWorkplaceSession()
  await session.signIn({ humanId })
  return session
}

async function renderShell(
  humanId: string,
  boardId: BoardId | undefined,
  props: Record<string, unknown> = {},
  gateway: TaskGateway = createFixtureTaskGateway(),
) {
  const session = await signedInSession(humanId)
  const view = render(AppShell, {
    props: { ...(boardId === undefined ? {} : { initialBoardId: boardId }), ...props },
    global: {
      provide: {
        [WORKPLACE_SESSION]: session,
        [TASK_GATEWAY]: gateway,
        [WORKPLACE_CLOCK]: () => FIXED_NOW,
      },
    },
  })

  await waitFor(() => {
    expect(screen.queryByTestId('boards-loading')).toBeNull()
  })

  return view
}

function renderedIds(testId: 'kanban-card' | 'list-row'): string[] {
  return screen
    .queryAllByTestId(testId)
    .map((element) => element.getAttribute('data-item-id'))
    .filter((id): id is string => id !== null)
}

async function showList(): Promise<void> {
  await fireEvent.click(screen.getByRole('tab', { name: 'List' }))
  await waitFor(() => {
    expect(screen.getByRole('tabpanel').getAttribute('data-view')).toBe('list')
  })
}

async function showKanban(): Promise<void> {
  await fireEvent.click(screen.getByRole('tab', { name: 'Kanban' }))
  await waitFor(() => {
    expect(screen.getByRole('tabpanel').getAttribute('data-view')).toBe('kanban')
  })
}

async function openFilter(): Promise<HTMLElement> {
  const already = screen.queryByTestId('filter-popover')

  if (already !== null) {
    return already
  }

  await fireEvent.click(screen.getByTestId('filter-open'))
  await waitFor(() => {
    expect(screen.getByTestId('filter-popover')).toBeTruthy()
  })

  return screen.getByTestId('filter-popover')
}

async function search(term: string): Promise<void> {
  await openFilter()
  await fireEvent.update(screen.getByTestId('filter-search'), term)
}

async function chooseLane(lane: string): Promise<void> {
  await openFilter()
  await fireEvent.click(screen.getByTestId(`filter-lane-${lane}`))
}

async function chooseOwner(owner: string): Promise<void> {
  await openFilter()
  await fireEvent.update(screen.getByTestId('filter-owner'), owner)
}

async function chooseAssignee(assignee: string): Promise<void> {
  await openFilter()
  await fireEvent.update(screen.getByTestId('filter-assignee'), assignee)
}

async function chooseLabel(label: string): Promise<void> {
  await openFilter()
  await fireEvent.update(screen.getByTestId('filter-label'), label)
}

async function chooseDue(due: string): Promise<void> {
  await openFilter()
  await fireEvent.update(screen.getByTestId('filter-due'), due)
}

describe('board filtering — one filter, both views', () => {
  it('narrows the Kanban to one lane while still rendering all six lanes', async () => {
    await renderShell(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toHaveLength(6)
    })

    await chooseLane('ready')

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toEqual([FIXTURE_ITEMS.ready])
    })
    expect(screen.getAllByTestId('kanban-lane')).toHaveLength(6)
    expect(screen.getAllByTestId('kanban-lane-empty')).toHaveLength(5)
  })

  it('hides cards assigned to anyone else and keeps all six lanes', async () => {
    await renderShell(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toHaveLength(6)
    })

    await chooseAssignee(FIXTURE_HUMANS.wren)

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toEqual([
        FIXTURE_ITEMS.inbox,
        FIXTURE_ITEMS.inProgress,
        FIXTURE_ITEMS.review,
      ])
    })
    expect(screen.getAllByTestId('kanban-lane')).toHaveLength(6)
  })

  it('narrows to one fixture label', async () => {
    await renderShell(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toHaveLength(6)
    })

    await chooseLabel(FIXTURE_LABELS.research.id)

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toEqual([
        FIXTURE_ITEMS.inProgress,
        FIXTURE_ITEMS.review,
      ])
    })
  })

  it('narrows overdue cards from the injected clock', async () => {
    await renderShell(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toHaveLength(6)
    })

    await chooseDue('overdue')

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toEqual([
        FIXTURE_ITEMS.inProgress,
        FIXTURE_ITEMS.blocked,
      ])
    })
  })

  it('matches a description keyword after stripping markup', async () => {
    await renderShell(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toHaveLength(6)
    })

    await search('three sections')

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toEqual([FIXTURE_ITEMS.ready])
    })
  })

  it('narrows to one of the owners the board actually carries', async () => {
    const gateway: TaskGateway = {
      listVisibleBoards: vi.fn(async () => [
        {
          id: 'board-shared',
          agentId: 'agent-a',
          agentName: 'Fictional Agent A',
          profession: null,
          title: 'Fictional Shared Board',
        },
      ]),
      getBoardItems: vi.fn(async () => [
        {
          id: 'quill-item',
          boardId: 'board-shared',
          title: 'An item owned by Quill',
          lane: 'ready',
          owner: 'Fictional Agent Quill',
        },
        {
          id: 'birch-item',
          boardId: 'board-shared',
          title: 'An item owned by Birch',
          lane: 'ready',
          owner: 'Fictional Agent Birch',
        },
      ] as WorkItemSummary[]),
      getItemDetail: vi.fn(),
      moveItemToLane: vi.fn(),
      createWorkItem: vi.fn(),
      updateWorkItem: vi.fn(),
      deleteWorkItem: vi.fn(),
      reorderWorkItem: vi.fn(),
      createComment: vi.fn(),
      updateComment: vi.fn(),
      deleteComment: vi.fn(),
      addAttachment: vi.fn(),
      deleteAttachment: vi.fn(),
      createChecklistItem: vi.fn(),
      updateChecklistItem: vi.fn(),
      reorderChecklistItem: vi.fn(),
      deleteChecklistItem: vi.fn(),
      listCardLinks: vi.fn(),
      addCardLink: vi.fn(),
      removeCardLink: vi.fn(),
    }

    await renderShell(FIXTURE_HUMANS.wren, 'board-shared', {}, gateway)

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toHaveLength(2)
    })

    await chooseOwner('Fictional Agent Birch')

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toEqual(['birch-item'])
    })

    await chooseOwner('Fictional Agent Quill')

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toEqual(['quill-item'])
    })
  })

  it('narrows by a case-insensitive title substring', async () => {
    await renderShell(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toHaveLength(6)
    })

    await search('ARCHIVE')

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toEqual([FIXTURE_ITEMS.done])
    })
  })

  it('combines lane, owner and search with AND', async () => {
    await renderShell(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toHaveLength(6)
    })

    await chooseLane('review')
    await chooseOwner('Fictional Agent Quill')
    await search('catalogue')

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toEqual([FIXTURE_ITEMS.review])
    })

    await search('outline')

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toEqual([])
    })
  })

  it('shows the identical filtered set after switching to List and back', async () => {
    await renderShell(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toHaveLength(6)
    })

    await search('the fictional')
    await chooseLane('in_progress')

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toEqual([FIXTURE_ITEMS.inProgress])
    })

    const fromKanban = renderedIds('kanban-card')

    await showList()

    expect(renderedIds('list-row')).toEqual(fromKanban)
    expect((screen.getByTestId('filter-search') as HTMLInputElement).value).toBe(
      'the fictional',
    )

    await showKanban()

    expect(renderedIds('kanban-card')).toEqual(fromKanban)
  })

  it('offers only the owners present on the board and recomputes them per board', async () => {
    await renderShell(FIXTURE_HUMANS.ash, FIXTURE_BOARDS.marlowOutreach)

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toHaveLength(1)
    })

    await openFilter()

    const owners = () =>
      Array.from(screen.getByTestId('filter-owner').querySelectorAll('option'))
        .map((option) => option.getAttribute('value'))
        .filter((value): value is string => value !== null && value !== '')

    expect(owners()).toEqual(['Fictional Agent Marlow'])

    await fireEvent.click(screen.getByText('Fictional Marlow Empty Backlog'))

    await waitFor(() => {
      expect(screen.getByTestId('kanban-board-empty')).toBeTruthy()
    })
    expect(owners()).toEqual([])
  })
})

describe('board filtering — the filter lives in a toolbar popover', () => {
  it('opens a Filter popover from the board toolbar and keeps the board visible', async () => {
    await renderShell(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toHaveLength(6)
    })

    expect(screen.queryByTestId('filter-popover')).toBeNull()
    expect(screen.queryByTestId('board-filters')).toBeNull()

    const opener = screen.getByTestId('filter-open')
    expect(opener.getAttribute('title')).toMatch(/Filter cards F/i)

    await fireEvent.click(opener)

    const popover = await screen.findByTestId('filter-popover')
    expect(within(popover).getByRole('heading', { name: 'Filter' })).toBeTruthy()
    expect(within(popover).getByTestId('filter-close')).toBeTruthy()
    expect(within(popover).getByTestId('filter-search')).toBeTruthy()
    expect(within(popover).getByTestId('filter-assignee')).toBeTruthy()
    expect(within(popover).getByTestId('filter-label')).toBeTruthy()
    expect(within(popover).getByTestId('filter-due')).toBeTruthy()
    expect(renderedIds('kanban-card')).toHaveLength(6)
  })

  it('closes on Escape and on the close control without clearing criteria', async () => {
    await renderShell(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toHaveLength(6)
    })

    await chooseAssignee(FIXTURE_HUMANS.wren)
    await waitFor(() => {
      expect(renderedIds('kanban-card')).toHaveLength(3)
    })

    await fireEvent.keyDown(screen.getByTestId('filter-popover'), { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByTestId('filter-popover')).toBeNull()
    })
    expect(renderedIds('kanban-card')).toHaveLength(3)

    await openFilter()
    await fireEvent.click(screen.getByTestId('filter-close'))
    await waitFor(() => {
      expect(screen.queryByTestId('filter-popover')).toBeNull()
    })
    expect(renderedIds('kanban-card')).toHaveLength(3)
  })
})

describe('board filtering — no match is its own state', () => {
  it('says no item matches, and does not reuse the empty-board message', async () => {
    await renderShell(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toHaveLength(6)
    })

    await search('nothing on this fictional board matches')

    await waitFor(() => {
      expect(screen.getByTestId('kanban-no-match')).toBeTruthy()
    })

    expect(screen.queryByTestId('kanban-board-empty')).toBeNull()
    expect(screen.queryByTestId('kanban-error')).toBeNull()
    expect(screen.getByTestId('kanban-no-match').textContent).toMatch(/filter/i)
    expect(screen.getAllByTestId('kanban-lane')).toHaveLength(6)

    await showList()

    expect(screen.getByTestId('list-no-match')).toBeTruthy()
    expect(screen.queryByTestId('list-board-empty')).toBeNull()
    expect(screen.queryByTestId('list-error')).toBeNull()
  })

  it('keeps the empty-board state for a board that holds nothing', async () => {
    await renderShell(FIXTURE_HUMANS.ash, FIXTURE_BOARDS.marlowBacklog)

    await waitFor(() => {
      expect(screen.getByTestId('kanban-board-empty')).toBeTruthy()
    })

    expect(screen.queryByTestId('kanban-no-match')).toBeNull()
  })

  it('keeps the read-failure state when the items could not be read', async () => {
    const gateway: TaskGateway = {
      listVisibleBoards: vi.fn(async () => [
        {
          id: 'board-mine',
          agentId: 'agent-a',
          agentName: 'Fictional Agent A',
          profession: null,
          title: 'Fictional My Board',
        },
      ]),
      getBoardItems: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockRejectedValue(new Error('Kolonie Workplace: the board items could not be read.')),
      getItemDetail: vi.fn(),
      moveItemToLane: vi.fn(),
      createWorkItem: vi.fn(),
      updateWorkItem: vi.fn(),
      deleteWorkItem: vi.fn(),
      reorderWorkItem: vi.fn(),
      createComment: vi.fn(),
      updateComment: vi.fn(),
      deleteComment: vi.fn(),
      addAttachment: vi.fn(),
      deleteAttachment: vi.fn(),
      createChecklistItem: vi.fn(),
      updateChecklistItem: vi.fn(),
      reorderChecklistItem: vi.fn(),
      deleteChecklistItem: vi.fn(),
      listCardLinks: vi.fn(),
      addCardLink: vi.fn(),
      removeCardLink: vi.fn(),
    }

    await renderShell(FIXTURE_HUMANS.wren, 'board-mine', {}, gateway)

    await waitFor(() => {
      expect(screen.getByTestId('kanban-error')).toBeTruthy()
    })

    expect(screen.queryByTestId('kanban-no-match')).toBeNull()
    expect(screen.queryByTestId('kanban-board-empty')).toBeNull()
  })
})

describe('board filtering — the URL carries the filter', () => {
  it('restores lane, owner and search from the query string on load', async () => {
    await renderShell(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, {
      initialQuery: '?lane=review&owner=Fictional%20Agent%20Quill&q=catalogue',
    })

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toEqual([FIXTURE_ITEMS.review])
    })

    await openFilter()
    expect((screen.getByTestId('filter-search') as HTMLInputElement).value).toBe('catalogue')
    expect((screen.getByTestId('filter-owner') as HTMLSelectElement).value).toBe(
      'Fictional Agent Quill',
    )
    expect(
      screen.getByTestId('filter-lane-review').getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('restores assignee, label and due from the query string on load', async () => {
    await renderShell(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, {
      initialQuery: `?assignee=${FIXTURE_HUMANS.wren}&label=${FIXTURE_LABELS.research.id}&due=overdue`,
    })

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toEqual([FIXTURE_ITEMS.inProgress])
    })

    await openFilter()
    expect((screen.getByTestId('filter-assignee') as HTMLSelectElement).value).toBe(
      FIXTURE_HUMANS.wren,
    )
    expect((screen.getByTestId('filter-label') as HTMLSelectElement).value).toBe(
      FIXTURE_LABELS.research.id,
    )
    expect((screen.getByTestId('filter-due') as HTMLSelectElement).value).toBe('overdue')
  })

  it('writes the active filter into the query string as it changes', async () => {
    await renderShell(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toHaveLength(6)
    })

    await search('archive')
    await chooseLane('done')

    await waitFor(() => {
      const query = new URLSearchParams(window.location.search)
      expect(query.get('q')).toBe('archive')
      expect(query.getAll('lane')).toEqual(['done'])
    })
  })

  it('ignores a lane in the URL that the Colony does not define', async () => {
    await renderShell(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, {
      initialQuery: '?lane=archived',
    })

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toHaveLength(6)
    })

    expect(screen.queryByTestId('kanban-no-match')).toBeNull()
  })
})

describe('board filtering — clearing', () => {
  it('returns to the unfiltered board in one action', async () => {
    await renderShell(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, {
      initialQuery: '?lane=review&owner=Fictional%20Agent%20Quill&q=catalogue',
    })

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toEqual([FIXTURE_ITEMS.review])
    })

    await fireEvent.click(screen.getByTestId('filter-clear'))

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toHaveLength(6)
    })

    await openFilter()
    expect((screen.getByTestId('filter-search') as HTMLInputElement).value).toBe('')
    expect((screen.getByTestId('filter-owner') as HTMLSelectElement).value).toBe('')
    expect(screen.getByTestId('filter-lane-review').getAttribute('aria-pressed')).toBe('false')

    const query = new URLSearchParams(window.location.search)
    expect(query.has('lane')).toBe(false)
    expect(query.has('owner')).toBe(false)
    expect(query.has('q')).toBe(false)
  })

  it('restores every card after clearing an assignee filter', async () => {
    await renderShell(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toHaveLength(6)
    })

    await chooseAssignee(FIXTURE_HUMANS.wren)
    await waitFor(() => {
      expect(renderedIds('kanban-card')).toHaveLength(3)
    })

    await fireEvent.click(screen.getByTestId('filter-clear'))
    await waitFor(() => {
      expect(renderedIds('kanban-card')).toHaveLength(6)
    })
  })

  it('offers the clear action only while something is filtered', async () => {
    await renderShell(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toHaveLength(6)
    })

    expect(screen.queryByTestId('filter-clear')).toBeNull()

    await search('archive')

    await waitFor(() => {
      expect(screen.getByTestId('filter-clear')).toBeTruthy()
    })
  })

  it('reads no board again when a filter changes', async () => {
    const gateway = createFixtureTaskGateway()
    const spy = vi.spyOn(gateway, 'getBoardItems')

    await renderShell(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, {}, gateway)

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toHaveLength(6)
    })

    const before = spy.mock.calls.length

    await search('archive')
    await chooseLane('done')
    await showList()

    expect(renderedIds('list-row')).toEqual([FIXTURE_ITEMS.done])
    expect(spy.mock.calls.length).toBe(before)
  })
})

describe('board filtering — the filter does not reach the gateway', () => {
  it('passes only the human and the board to the gateway', async () => {
    const gateway = createFixtureTaskGateway()
    const spy = vi.spyOn(gateway, 'getBoardItems')

    await renderShell(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, {}, gateway)

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toHaveLength(6)
    })

    await search('archive')
    await chooseLane('done')

    for (const call of spy.mock.calls) {
      expect(call).toHaveLength(2)
      expect(call[0]).toBe(FIXTURE_HUMANS.wren)
      expect(call[1]).toBe(FIXTURE_BOARDS.quillDelivery)
    }
  })
})
