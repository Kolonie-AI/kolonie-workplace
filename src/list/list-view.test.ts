import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { WORKPLACE_LANE_LABELS } from '@/domain/lanes'
import type { BoardId, WorkItemSummary } from '@/domain/workplace'
import type { TaskGateway } from '@/gateway/task-gateway'
import { TASK_GATEWAY } from '@/gateway/provide-gateway'
import { createFixtureTaskGateway } from '@/gateway/fixture-task-gateway'
import {
  FIXTURE_BOARDS,
  FIXTURE_HUMANS,
  FIXTURE_ITEMS,
  fixtureWorkItems,
} from '@/fixtures/catalogue'
import AppShell from '@/shell/AppShell.vue'
import { createFixtureWorkplaceSession } from '@/session/fixture-workplace-session'
import { WORKPLACE_SESSION, type WorkplaceSession } from '@/session/workplace-session'

function requireItem(id: string): WorkItemSummary {
  const item = fixtureWorkItems.find((candidate) => candidate.id === id)

  if (item === undefined) {
    throw new Error(`Kolonie Workplace: fixture item ${id} is missing.`)
  }

  return item
}

async function signedInSession(humanId: string): Promise<WorkplaceSession> {
  const session = createFixtureWorkplaceSession()
  await session.signIn({ humanId })
  return session
}

async function renderList(
  humanId: string,
  boardId: BoardId | undefined,
  gateway: TaskGateway = createFixtureTaskGateway(),
) {
  const session = await signedInSession(humanId)
  const view = render(AppShell, {
    props: {
      initialView: 'list',
      ...(boardId === undefined ? {} : { initialBoardId: boardId }),
    },
    global: { provide: { [WORKPLACE_SESSION]: session, [TASK_GATEWAY]: gateway } },
  })

  await waitFor(() => {
    expect(screen.queryByTestId('boards-loading')).toBeNull()
  })

  return view
}

function rowIds(): string[] {
  return screen
    .queryAllByTestId('list-row')
    .map((row) => row.getAttribute('data-item-id'))
    .filter((id): id is string => id !== null)
}

describe('list view — rows over the active board', () => {
  it('renders one row per item of the active board', async () => {
    await renderList(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(rowIds()).toHaveLength(6)
    })

    expect([...rowIds()].sort()).toEqual([...Object.values(FIXTURE_ITEMS)].sort())
  })

  it('shows the title, the lane and the owner on a row', async () => {
    await renderList(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(rowIds()).toContain(FIXTURE_ITEMS.ready)
    })

    const ready = requireItem(FIXTURE_ITEMS.ready)
    const row = screen
      .getAllByTestId('list-row')
      .find((candidate) => candidate.getAttribute('data-item-id') === FIXTURE_ITEMS.ready)

    expect(row?.textContent).toContain(ready.title)
    expect(row?.textContent).toContain(ready.owner)
    expect(row?.textContent).toContain(WORKPLACE_LANE_LABELS.ready)
  })

  it('distinguishes a blocked item with a marker other rows do not carry', async () => {
    await renderList(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(rowIds()).toContain(FIXTURE_ITEMS.blocked)
    })

    const rows = screen.getAllByTestId('list-row')
    const blocked = rows.find(
      (row) => row.getAttribute('data-item-id') === FIXTURE_ITEMS.blocked,
    )
    const notBlocked = rows.find(
      (row) => row.getAttribute('data-item-id') === FIXTURE_ITEMS.ready,
    )

    expect(blocked?.getAttribute('data-blocked')).toBe('true')
    expect(within(blocked as HTMLElement).getByTestId('list-row-blocked')).toBeTruthy()
    expect(notBlocked?.getAttribute('data-blocked')).toBe('false')
    expect(within(notBlocked as HTMLElement).queryByTestId('list-row-blocked')).toBeNull()
  })

  it('orders the rows by the fixed Colony lane order', async () => {
    await renderList(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(rowIds()).toHaveLength(6)
    })

    expect(
      screen.getAllByTestId('list-row').map((row) => row.getAttribute('data-lane')),
    ).toEqual(['inbox', 'ready', 'in_progress', 'blocked', 'review', 'done'])
  })

  it('reads the detail of no row while the list renders', async () => {
    const gateway = createFixtureTaskGateway()
    const spy = vi.spyOn(gateway, 'getItemDetail')

    await renderList(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)

    await waitFor(() => {
      expect(rowIds()).toHaveLength(6)
    })

    expect(spy).not.toHaveBeenCalled()
  })
})

describe('list view — read-only, with no controls', () => {
  it('offers no sorting control, column configuration or filter bar', async () => {
    await renderList(
      FIXTURE_HUMANS.wren,
      FIXTURE_BOARDS.quillDelivery,
    )

    await waitFor(() => {
      expect(rowIds()).toHaveLength(6)
    })

    expect(screen.queryByRole('button', { name: /sort/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /column/i })).toBeNull()
    const view = screen.getByTestId('list-view')
    expect(within(view).queryByRole('searchbox')).toBeNull()
    expect(screen.getAllByLabelText('Move to lane')).toHaveLength(6)
  })

  it('offers no inline edit, completion checkbox or create-row affordance', async () => {
    await renderList(
      FIXTURE_HUMANS.wren,
      FIXTURE_BOARDS.quillDelivery,
    )

    await waitFor(() => {
      expect(rowIds()).toHaveLength(6)
    })

    const view = screen.getByTestId('list-view')
    expect(within(view).queryByRole('checkbox')).toBeNull()
    expect(within(view).queryByRole('button', { name: /add (a )?(row|task|item)/i })).toBeNull()
    expect(within(view).queryByRole('button', { name: /create|new/i })).toBeNull()
    expect(view.querySelector('input')).toBeNull()
    expect(view.querySelector('textarea')).toBeNull()
    expect(view.querySelector('[contenteditable]')).toBeNull()
    expect(view.querySelector('[draggable]')).toBeNull()
  })
})

describe('list view — empty, loading and failure states', () => {
  it('renders an honest empty state for a board that holds nothing', async () => {
    await renderList(FIXTURE_HUMANS.ash, FIXTURE_BOARDS.marlowBacklog)

    await waitFor(() => {
      expect(screen.getByTestId('list-board-empty')).toBeTruthy()
    })

    const message = screen.getByTestId('list-board-empty').textContent ?? ''
    expect(message).toMatch(/no work items/i)
    expect(message).not.toMatch(/no boards/i)
    expect(rowIds()).toEqual([])
  })

  it('renders no list at all until a board is active', async () => {
    await renderList(FIXTURE_HUMANS.wren, undefined)

    expect(rowIds()).toEqual([])
    expect(screen.queryByTestId('list-board-empty')).toBeNull()
    expect(screen.getByTestId('list-no-board')).toBeTruthy()
  })

  it('renders an error state rather than an empty list that reads as "nothing here"', async () => {
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
        .mockRejectedValue(
          new Error('Kolonie Workplace: the board items could not be read.'),
        ),
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
    }

    await renderList(FIXTURE_HUMANS.wren, 'board-mine', gateway)

    await waitFor(() => {
      expect(screen.getByTestId('list-error')).toBeTruthy()
    })

    expect(screen.queryByTestId('list-board-empty')).toBeNull()
    expect(rowIds()).toEqual([])
    expect(screen.getByTestId('list-error').textContent).not.toMatch(/no work items/i)
  })
})

describe('list view — rejection: an item the human may not see', () => {
  it('never renders a row for a foreign board that is refused', async () => {
    await renderList(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.marlowOutreach)

    await waitFor(() => {
      expect(screen.getByTestId('board-refused')).toBeTruthy()
    })

    expect(rowIds()).toEqual([])
    expect(screen.queryByText('Prepare the fictional outreach list')).toBeNull()
  })

  it('drops an item the gateway attributes to a board other than the active one', async () => {
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
    }

    await renderList(FIXTURE_HUMANS.wren, 'board-mine', gateway)

    await waitFor(() => {
      expect(rowIds()).toEqual(['mine'])
    })

    expect(screen.queryByText('An item of another fictional board')).toBeNull()
  })
})
