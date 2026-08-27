import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/vue'
import { WORKPLACE_LANES, WORKPLACE_LANE_LABELS } from '@/domain/lanes'
import type { BoardId, Human, WorkItemSummary } from '@/domain/workplace'
import { BoardAccessRefused } from '@/gateway/refusals'
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

async function renderBoard(
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

function laneIds(): string[] {
  return screen
    .getAllByTestId('kanban-lane')
    .map((lane) => lane.getAttribute('data-lane'))
    .filter((lane): lane is string => lane !== null)
}

function cardIdsInLane(lane: string): string[] {
  const column = screen
    .getAllByTestId('kanban-lane')
    .find((candidate) => candidate.getAttribute('data-lane') === lane)

  if (column === undefined) {
    throw new Error(`Kolonie Workplace: lane ${lane} was not rendered.`)
  }

  return within(column)
    .queryAllByTestId('kanban-card')
    .map((card) => card.getAttribute('data-item-id'))
    .filter((id): id is string => id !== null)
}

function allCardIds(): string[] {
  return screen
    .queryAllByTestId('kanban-card')
    .map((card) => card.getAttribute('data-item-id'))
    .filter((id): id is string => id !== null)
}

describe('kanban board — the six fixed Colony lanes', () => {
  it('renders exactly six lanes, in the documented order', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(screen.getAllByTestId('kanban-lane')).toHaveLength(6)
    })
    expect(laneIds()).toEqual(['inbox', 'ready', 'in_progress', 'blocked', 'review', 'done'])
  })

  it('titles each lane with its human label', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(screen.getAllByTestId('kanban-lane')).toHaveLength(6)
    })

    for (const lane of WORKPLACE_LANES) {
      const column = screen
        .getAllByTestId('kanban-lane')
        .find((candidate) => candidate.getAttribute('data-lane') === lane)

      expect(column?.textContent).toContain(WORKPLACE_LANE_LABELS[lane])
    }
  })

  it('offers no way to add, rename, reorder or delete a lane', async () => {
    const { container } = await renderBoard(
      FIXTURE_HUMANS.wren,
      FIXTURE_BOARDS.quillDelivery,
    )

    await waitFor(() => {
      expect(screen.getAllByTestId('kanban-lane')).toHaveLength(6)
    })

    expect(screen.queryByRole('button', { name: /add lane/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /new (lane|bucket|column)/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /rename/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /create/i })).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(container.querySelectorAll('[draggable="true"]')).toHaveLength(6)
    expect(container.querySelector('[data-lane][draggable]')).toBeNull()
  })
})

describe('kanban board — cards', () => {
  it('places each item in the lane matching its lane value and nowhere else', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(allCardIds()).toHaveLength(6)
    })

    expect(cardIdsInLane('inbox')).toEqual([FIXTURE_ITEMS.inbox])
    expect(cardIdsInLane('ready')).toEqual([FIXTURE_ITEMS.ready])
    expect(cardIdsInLane('in_progress')).toEqual([FIXTURE_ITEMS.inProgress])
    expect(cardIdsInLane('blocked')).toEqual([FIXTURE_ITEMS.blocked])
    expect(cardIdsInLane('review')).toEqual([FIXTURE_ITEMS.review])
    expect(cardIdsInLane('done')).toEqual([FIXTURE_ITEMS.done])
    expect(allCardIds().sort()).toEqual([...new Set(allCardIds())].sort())
  })

  it('shows the title and the owner on a card', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    const ready = requireItem(FIXTURE_ITEMS.ready)

    await waitFor(() => {
      expect(allCardIds()).toContain(FIXTURE_ITEMS.ready)
    })

    const card = screen
      .getAllByTestId('kanban-card')
      .find((candidate) => candidate.getAttribute('data-item-id') === FIXTURE_ITEMS.ready)

    expect(card?.textContent).toContain(ready.title)
    expect(card?.textContent).toContain(ready.owner)
  })

  it('distinguishes a blocked item with a marker other cards do not carry', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(allCardIds()).toContain(FIXTURE_ITEMS.blocked)
    })

    const cards = screen.getAllByTestId('kanban-card')
    const blocked = cards.find(
      (card) => card.getAttribute('data-item-id') === FIXTURE_ITEMS.blocked,
    )
    const notBlocked = cards.find(
      (card) => card.getAttribute('data-item-id') === FIXTURE_ITEMS.ready,
    )

    expect(blocked?.getAttribute('data-blocked')).toBe('true')
    expect(within(blocked as HTMLElement).getByTestId('kanban-card-blocked')).toBeTruthy()
    expect(notBlocked?.getAttribute('data-blocked')).toBe('false')
    expect(within(notBlocked as HTMLElement).queryByTestId('kanban-card-blocked')).toBeNull()
  })

  it('stays compact: no description body, comments or attachments', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(allCardIds()).toContain(FIXTURE_ITEMS.review)
    })

    const review = screen
      .getAllByTestId('kanban-card')
      .find((candidate) => candidate.getAttribute('data-item-id') === FIXTURE_ITEMS.review)

    expect(review?.textContent).not.toMatch(/Prepared the fictional catalogue/i)
    expect(review?.textContent).not.toMatch(/fictional-reference/i)
    expect(review?.textContent).not.toMatch(/comment|attachment|description/i)
  })

  it('reads the detail of no card while the board renders', async () => {
    const gateway = createFixtureTaskGateway()
    const spy = vi.spyOn(gateway, 'getItemDetail')

    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)

    await waitFor(() => {
      expect(allCardIds()).toHaveLength(6)
    })

    expect(spy).not.toHaveBeenCalled()
  })

  it('offers no inline edit, completion or create-card affordance', async () => {
    await renderBoard(
      FIXTURE_HUMANS.wren,
      FIXTURE_BOARDS.quillDelivery,
    )

    await waitFor(() => {
      expect(allCardIds()).toHaveLength(6)
    })

    expect(screen.queryByRole('button', { name: /add (a )?(card|task|item)/i })).toBeNull()
    expect(screen.getAllByLabelText('Move to lane')).toHaveLength(6)
    expect(screen.queryByRole('checkbox')).toBeNull()
    const board = screen.getByTestId('kanban-board')
    expect(board.querySelector('input')).toBeNull()
    expect(board.querySelector('textarea')).toBeNull()
    expect(board.querySelector('[contenteditable]')).toBeNull()
  })
})

describe('kanban board — an empty lane is not an empty board', () => {
  it('renders an empty lane as a column carrying an empty-lane note and no board message', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.birchResearch)

    await waitFor(() => {
      expect(screen.getAllByTestId('kanban-lane')).toHaveLength(6)
    })

    expect(screen.getAllByTestId('kanban-lane-empty')).toHaveLength(6)
    expect(screen.getByTestId('kanban-board-empty')).toBeTruthy()
  })

  it('keeps the other five lanes empty as columns while one lane holds an item', async () => {
    const gateway: TaskGateway = {
      listVisibleBoards: vi.fn(async () => [
        {
          id: FIXTURE_BOARDS.quillDelivery,
          agentId: 'agent-a',
          agentName: 'Fictional Agent A',
          profession: null,
          title: 'Fictional One Lane Board',
        },
      ]),
      getBoardItems: vi.fn(async () => [
        {
          id: 'only-item',
          boardId: FIXTURE_BOARDS.quillDelivery,
          title: 'The only fictional item',
          lane: 'review',
          owner: 'Fictional Owner',
        } as WorkItemSummary,
      ]),
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

    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)

    await waitFor(() => {
      expect(allCardIds()).toEqual(['only-item'])
    })

    expect(screen.getAllByTestId('kanban-lane')).toHaveLength(6)
    expect(screen.getAllByTestId('kanban-lane-empty')).toHaveLength(5)
    expect(screen.queryByTestId('kanban-board-empty')).toBeNull()
  })

  it('says the board holds nothing yet, without saying the human has no board', async () => {
    await renderBoard(FIXTURE_HUMANS.ash, FIXTURE_BOARDS.marlowBacklog)

    await waitFor(() => {
      expect(screen.getByTestId('kanban-board-empty')).toBeTruthy()
    })

    const message = screen.getByTestId('kanban-board-empty').textContent ?? ''
    expect(message).toMatch(/no work items/i)
    expect(message).not.toMatch(/no boards/i)
    expect(screen.queryByTestId('boards-empty')).toBeNull()
    expect(screen.getAllByTestId('kanban-lane')).toHaveLength(6)
  })

  it('renders no board at all until one is active', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, undefined)

    expect(screen.queryAllByTestId('kanban-lane')).toEqual([])
    expect(screen.queryByTestId('kanban-board-empty')).toBeNull()
    expect(screen.getByTestId('kanban-no-board')).toBeTruthy()
  })
})

describe('kanban board — items of one board never appear on another', () => {
  it('shows only the active board\'s items when the board is switched', async () => {
    const view = await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(allCardIds()).toHaveLength(6)
    })

    await fireEvent.click(screen.getByText('Fictional Birch Research'))

    await waitFor(() => {
      expect(
        within(view.container as HTMLElement).getByTestId('kanban-board-empty'),
      ).toBeTruthy()
    })

    expect(allCardIds()).toEqual([])
    for (const id of Object.values(FIXTURE_ITEMS)) {
      expect(screen.queryByText(requireItem(id).title)).toBeNull()
    }
  })

  it('never shows the foreign board\'s item when that board is refused', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.marlowOutreach)

    await waitFor(() => {
      expect(screen.getByTestId('board-refused')).toBeTruthy()
    })

    expect(allCardIds()).toEqual([])
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
      getBoardItems: vi.fn(async (_humanId: string, boardId: BoardId) => {
        if (boardId !== 'board-mine') {
          throw new BoardAccessRefused(boardId)
        }

        return [
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
        ] as WorkItemSummary[]
      }),
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

    await renderBoard(FIXTURE_HUMANS.wren, 'board-mine', gateway)

    await waitFor(() => {
      expect(allCardIds()).toEqual(['mine'])
    })

    expect(screen.queryByText('An item of another fictional board')).toBeNull()
  })
})

describe('kanban board — rejection: an item in a lane the Colony does not define', () => {
  function gatewayWithStrayLane(): TaskGateway {
    return {
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
  }

  it('does not let it land in inbox, and does not let it vanish', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, 'board-mine', gatewayWithStrayLane())

    await waitFor(() => {
      expect(screen.getByTestId('kanban-invalid')).toBeTruthy()
    })

    expect(cardIdsInLane('inbox')).toEqual([])
    expect(allCardIds()).toEqual(['sound'])

    const invalid = screen.getByTestId('kanban-invalid')
    expect(invalid.getAttribute('role')).toBe('alert')
    expect(invalid.textContent).toMatch(/An item in a lane the Colony does not define/)
    expect(invalid.textContent).toMatch(/archived/)
  })

  it('renders the sound items normally alongside the invalid-data notice', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, 'board-mine', gatewayWithStrayLane())

    await waitFor(() => {
      expect(allCardIds()).toEqual(['sound'])
    })

    expect(cardIdsInLane('ready')).toEqual(['sound'])
    expect(screen.getAllByTestId('kanban-lane')).toHaveLength(6)
    expect(screen.queryByTestId('kanban-board-empty')).toBeNull()
  })
})

describe('kanban board — loading and failure', () => {
  it('fabricates no card while the items are pending', async () => {
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
        .mockImplementation(() => new Promise<never>(() => undefined)),
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

    await renderBoard(FIXTURE_HUMANS.wren, 'board-mine', gateway)

    await waitFor(() => {
      expect(screen.getByTestId('kanban-loading')).toBeTruthy()
    })

    expect(allCardIds()).toEqual([])
    expect(screen.queryByTestId('kanban-board-empty')).toBeNull()
    expect(screen.queryByTestId('kanban-error')).toBeNull()
  })

  it('renders an error state rather than an empty board that reads as "nothing here"', async () => {
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

    await renderBoard(FIXTURE_HUMANS.wren, 'board-mine', gateway)

    await waitFor(() => {
      expect(screen.getByTestId('kanban-error')).toBeTruthy()
    })

    expect(screen.queryByTestId('kanban-board-empty')).toBeNull()
    expect(allCardIds()).toEqual([])
    expect(screen.getByTestId('kanban-error').textContent).not.toMatch(/no work items/i)
  })
})

describe('kanban board — selecting a card', () => {
  it('marks the clicked card as selected and no other', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(allCardIds()).toHaveLength(6)
    })

    const card = screen
      .getAllByTestId('kanban-card')
      .find((candidate) => candidate.getAttribute('data-item-id') === FIXTURE_ITEMS.review)

    await fireEvent.click(card as HTMLElement)

    await waitFor(() => {
      const selected = screen
        .getAllByTestId('kanban-card')
        .filter((candidate) => candidate.getAttribute('data-selected') === 'true')

      expect(selected.map((entry) => entry.getAttribute('data-item-id'))).toEqual([
        FIXTURE_ITEMS.review,
      ])
    })
  })

  it('moves the selection to a second card rather than accumulating', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(allCardIds()).toHaveLength(6)
    })

    const cardFor = (id: string) =>
      screen
        .getAllByTestId('kanban-card')
        .find((candidate) => candidate.getAttribute('data-item-id') === id) as HTMLElement

    await fireEvent.click(cardFor(FIXTURE_ITEMS.ready))
    await fireEvent.click(cardFor(FIXTURE_ITEMS.done))

    await waitFor(() => {
      expect(cardFor(FIXTURE_ITEMS.done).getAttribute('data-selected')).toBe('true')
    })
    expect(cardFor(FIXTURE_ITEMS.ready).getAttribute('data-selected')).toBe('false')
  })

  /**
   * Until #10 this asserted that selecting read no detail at all, because no
   * detail surface existed and any detail read from the board would have been
   * a prefetch. #10 introduces the pane, and its contract is the opposite of a
   * prefetch: detail is read once, for the card that was opened. What this
   * test protects is unchanged — the board must not read detail for cards
   * nobody opened, and selecting must still write nothing and move nothing.
   */
  it('reads detail once for the opened card, never for the board', async () => {
    const gateway = createFixtureTaskGateway()
    const detail = vi.spyOn(gateway, 'getItemDetail')

    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)

    await waitFor(() => {
      expect(allCardIds()).toHaveLength(6)
    })

    expect(detail).not.toHaveBeenCalled()

    const card = screen
      .getAllByTestId('kanban-card')
      .find((candidate) => candidate.getAttribute('data-item-id') === FIXTURE_ITEMS.ready)

    await fireEvent.click(card as HTMLElement)

    await waitFor(() => {
      expect(detail).toHaveBeenCalledTimes(1)
    })
    expect(detail).toHaveBeenCalledWith(FIXTURE_HUMANS.wren, FIXTURE_ITEMS.ready)
    expect(cardIdsInLane('ready')).toEqual([FIXTURE_ITEMS.ready])
  })

  it('is reachable with the keyboard as a button', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(allCardIds()).toHaveLength(6)
    })

    for (const card of screen.getAllByTestId('kanban-card')) {
      expect(card.tagName).toBe('BUTTON')
      expect(card.getAttribute('type')).toBe('button')
    }
  })
})

describe('kanban board — any implementation of the session port', () => {
  it('renders nothing but the no-board state for a human the fixtures never heard of', async () => {
    const human = { id: 'stub-human', name: 'Stub Human', agentIds: [] } as Human
    const stub: WorkplaceSession = {
      currentHuman: { value: human } as WorkplaceSession['currentHuman'],
      signIn: async () => undefined,
      signOut: async () => undefined,
    }
    const gateway: TaskGateway = {
      listVisibleBoards: vi.fn(async () => []),
      getBoardItems: vi.fn(),
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

    render(AppShell, {
      global: { provide: { [WORKPLACE_SESSION]: stub, [TASK_GATEWAY]: gateway } },
    })

    await waitFor(() => {
      expect(screen.getByTestId('kanban-no-board')).toBeTruthy()
    })

    expect(gateway.getBoardItems).not.toHaveBeenCalled()
    expect(screen.queryAllByTestId('kanban-lane')).toEqual([])
  })
})
