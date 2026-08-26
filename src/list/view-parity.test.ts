import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import type { BoardId, WorkItemSummary } from '@/domain/workplace'
import type { TaskGateway } from '@/gateway/task-gateway'
import { TASK_GATEWAY } from '@/gateway/provide-gateway'
import { createFixtureTaskGateway } from '@/gateway/fixture-task-gateway'
import { FIXTURE_BOARDS, FIXTURE_HUMANS, FIXTURE_ITEMS } from '@/fixtures/catalogue'
import AppShell from '@/shell/AppShell.vue'
import { createFixtureWorkplaceSession } from '@/session/fixture-workplace-session'
import { WORKPLACE_SESSION, type WorkplaceSession } from '@/session/workplace-session'

/**
 * Parity is asserted against the DOM each component actually produced.
 *
 * `renderedIds` reads `data-item-id` off the elements the Kanban and the List
 * put on the page — `kanban-card` and `list-row` are different components with
 * different templates and different test ids. Nothing here calls a shared
 * helper twice and compares its result to itself: if the List ever rendered a
 * different set than the Kanban, one of these two DOM reads would return
 * different ids and the assertion would fail.
 */
async function signedInSession(humanId: string): Promise<WorkplaceSession> {
  const session = createFixtureWorkplaceSession()
  await session.signIn({ humanId })
  return session
}

async function renderShell(
  humanId: string,
  boardId: BoardId | undefined,
  gateway: TaskGateway = createFixtureTaskGateway(),
) {
  const session = await signedInSession(humanId)
  const view = render(AppShell, {
    props: boardId === undefined ? {} : { initialBoardId: boardId },
    global: { provide: { [WORKPLACE_SESSION]: session, [TASK_GATEWAY]: gateway } },
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

async function showKanban(): Promise<void> {
  await fireEvent.click(screen.getByRole('tab', { name: 'Kanban' }))
  await waitFor(() => {
    expect(screen.getByRole('tabpanel').getAttribute('data-view')).toBe('kanban')
  })
}

async function showList(): Promise<void> {
  await fireEvent.click(screen.getByRole('tab', { name: 'List' }))
  await waitFor(() => {
    expect(screen.getByRole('tabpanel').getAttribute('data-view')).toBe('list')
  })
}

describe('view parity — the same board renders the same item ids in both views', () => {
  it('renders in List exactly the ids the Kanban rendered as cards', async () => {
    await renderShell(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toHaveLength(6)
    })

    const fromKanban = renderedIds('kanban-card')
    expect(renderedIds('list-row')).toEqual([])

    await showList()

    const fromList = renderedIds('list-row')
    expect(renderedIds('kanban-card')).toEqual([])

    expect(fromList).not.toEqual([])
    expect(new Set(fromList)).toEqual(new Set(fromKanban))
    expect(fromList).toHaveLength(fromKanban.length)
  })

  it('holds parity in the other direction, List rendered before Kanban', async () => {
    const session = await signedInSession(FIXTURE_HUMANS.wren)
    render(AppShell, {
      props: {
        initialView: 'list',
        initialBoardId: FIXTURE_BOARDS.quillDelivery,
      },
      global: {
        provide: {
          [WORKPLACE_SESSION]: session,
          [TASK_GATEWAY]: createFixtureTaskGateway(),
        },
      },
    })

    await waitFor(() => {
      expect(renderedIds('list-row')).toHaveLength(6)
    })

    const fromList = renderedIds('list-row')

    await showKanban()

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toHaveLength(6)
    })

    expect(new Set(renderedIds('kanban-card'))).toEqual(new Set(fromList))
  })

  it('holds parity after the board is switched, for the second board too', async () => {
    await renderShell(FIXTURE_HUMANS.ash, FIXTURE_BOARDS.marlowOutreach)

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toHaveLength(1)
    })

    const outreachFromKanban = renderedIds('kanban-card')

    await showList()
    expect(new Set(renderedIds('list-row'))).toEqual(new Set(outreachFromKanban))

    await fireEvent.click(screen.getByText('Fictional Marlow Empty Backlog'))

    await waitFor(() => {
      expect(screen.getByTestId('list-board-empty')).toBeTruthy()
    })

    const backlogFromList = renderedIds('list-row')

    await showKanban()

    await waitFor(() => {
      expect(screen.getByTestId('kanban-board-empty')).toBeTruthy()
    })

    expect(new Set(renderedIds('kanban-card'))).toEqual(new Set(backlogFromList))
    expect(backlogFromList).toEqual([])
  })

  it('reads the board once per board, not once per view', async () => {
    const gateway = createFixtureTaskGateway()
    const spy = vi.spyOn(gateway, 'getBoardItems')

    await renderShell(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toHaveLength(6)
    })

    const before = spy.mock.calls.length

    await showList()
    await showKanban()
    await showList()

    expect(renderedIds('list-row')).toHaveLength(6)
    expect(spy.mock.calls.length).toBe(before)
  })

  it('keeps the active board across a tab switch and reads no other board', async () => {
    const gateway = createFixtureTaskGateway()
    const spy = vi.spyOn(gateway, 'getBoardItems')

    await renderShell(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toHaveLength(6)
    })

    await showList()

    expect(screen.getByTestId('active-board').getAttribute('data-board-id')).toBe(
      FIXTURE_BOARDS.quillDelivery,
    )

    for (const call of spy.mock.calls) {
      expect(call[1]).toBe(FIXTURE_BOARDS.quillDelivery)
    }
  })
})

describe('view parity — rejection: an item the human may not see appears in neither view', () => {
  it('shows the foreign board\'s item in neither Kanban nor List', async () => {
    await renderShell(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.marlowOutreach)

    await waitFor(() => {
      expect(screen.getByTestId('board-refused')).toBeTruthy()
    })

    expect(renderedIds('kanban-card')).toEqual([])
    expect(screen.queryByText('Prepare the fictional outreach list')).toBeNull()

    await showList()

    expect(renderedIds('list-row')).toEqual([])
    expect(screen.queryByText('Prepare the fictional outreach list')).toBeNull()
  })

  it('drops an item attributed to another board from both views alike', async () => {
    const gateway: TaskGateway = {
      listVisibleBoards: vi.fn(async () => [
        {
          id: 'board-mine',
          agentId: 'agent-a',
          agentName: 'Fictional Agent A',
          title: 'Fictional My Board',
        },
      ]),
      getBoardItems: vi.fn(async () => [
        {
          id: 'mine',
          boardId: 'board-mine',
          title: 'An item of my fictional board',
          lane: 'ready',
          owner: 'Fictional Owner',
        },
        {
          id: 'theirs',
          boardId: 'board-theirs',
          title: 'An item of another fictional board',
          lane: 'ready',
          owner: 'Fictional Owner',
        },
      ] as WorkItemSummary[]),
      getItemDetail: vi.fn(),
    }

    await renderShell(FIXTURE_HUMANS.wren, 'board-mine', gateway)

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toEqual(['mine'])
    })

    await showList()

    expect(renderedIds('list-row')).toEqual(['mine'])
    expect(screen.queryByText('An item of another fictional board')).toBeNull()
  })

  it('keeps an item in an undefined lane out of both views, and out of neither notice', async () => {
    const gateway: TaskGateway = {
      listVisibleBoards: vi.fn(async () => [
        {
          id: 'board-mine',
          agentId: 'agent-a',
          agentName: 'Fictional Agent A',
          title: 'Fictional My Board',
        },
      ]),
      getBoardItems: vi.fn(async () => [
        {
          id: 'stray',
          boardId: 'board-mine',
          title: 'An item in a lane the Colony does not define',
          lane: 'archived',
          owner: 'Fictional Owner',
        },
        {
          id: 'sound',
          boardId: 'board-mine',
          title: 'A sound fictional item',
          lane: 'ready',
          owner: 'Fictional Owner',
        },
      ] as unknown as WorkItemSummary[]),
      getItemDetail: vi.fn(),
    }

    await renderShell(FIXTURE_HUMANS.wren, 'board-mine', gateway)

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toEqual(['sound'])
    })

    expect(screen.getByTestId('kanban-invalid')).toBeTruthy()

    await showList()

    expect(renderedIds('list-row')).toEqual(['sound'])
    expect(screen.getByTestId('list-invalid')).toBeTruthy()
  })
})

describe('view parity — selection is one state behind both views', () => {
  it('carries a card selection over to the matching row', async () => {
    await renderShell(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toHaveLength(6)
    })

    const card = screen
      .getAllByTestId('kanban-card')
      .find((candidate) => candidate.getAttribute('data-item-id') === FIXTURE_ITEMS.review)

    await fireEvent.click(card as HTMLElement)
    await showList()

    const selectedRows = screen
      .getAllByTestId('list-row')
      .filter((row) => row.getAttribute('data-selected') === 'true')

    expect(selectedRows.map((row) => row.getAttribute('data-item-id'))).toEqual([
      FIXTURE_ITEMS.review,
    ])
  })

  it('carries a row selection over to the matching card', async () => {
    await renderShell(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toHaveLength(6)
    })

    await showList()

    const row = screen
      .getAllByTestId('list-row')
      .find((candidate) => candidate.getAttribute('data-item-id') === FIXTURE_ITEMS.blocked)

    await fireEvent.click(row as HTMLElement)
    expect(row?.getAttribute('data-selected')).toBe('true')

    await showKanban()

    const selectedCards = screen
      .getAllByTestId('kanban-card')
      .filter((card) => card.getAttribute('data-selected') === 'true')

    expect(selectedCards.map((card) => card.getAttribute('data-item-id'))).toEqual([
      FIXTURE_ITEMS.blocked,
    ])
  })

  it('selecting the same item in either view leaves the identical selection state', async () => {
    await renderShell(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toHaveLength(6)
    })

    const cardFor = (id: string) =>
      screen
        .getAllByTestId('kanban-card')
        .find((candidate) => candidate.getAttribute('data-item-id') === id) as HTMLElement

    await fireEvent.click(cardFor(FIXTURE_ITEMS.ready))

    await showList()
    const afterCard = screen
      .getAllByTestId('list-row')
      .map((row) => row.getAttribute('data-selected'))

    const rowFor = (id: string) =>
      screen
        .getAllByTestId('list-row')
        .find((candidate) => candidate.getAttribute('data-item-id') === id) as HTMLElement

    await fireEvent.click(rowFor(FIXTURE_ITEMS.ready))
    const afterRow = screen
      .getAllByTestId('list-row')
      .map((row) => row.getAttribute('data-selected'))

    expect(afterRow).toEqual(afterCard)
  })

  it('moves the selection rather than accumulating one per view', async () => {
    await renderShell(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(renderedIds('kanban-card')).toHaveLength(6)
    })

    const card = screen
      .getAllByTestId('kanban-card')
      .find((candidate) => candidate.getAttribute('data-item-id') === FIXTURE_ITEMS.ready)
    await fireEvent.click(card as HTMLElement)

    await showList()

    const row = screen
      .getAllByTestId('list-row')
      .find((candidate) => candidate.getAttribute('data-item-id') === FIXTURE_ITEMS.done)
    await fireEvent.click(row as HTMLElement)

    await showKanban()

    const selected = screen
      .getAllByTestId('kanban-card')
      .filter((candidate) => candidate.getAttribute('data-selected') === 'true')

    expect(selected.map((candidate) => candidate.getAttribute('data-item-id'))).toEqual([
      FIXTURE_ITEMS.done,
    ])
  })
})
