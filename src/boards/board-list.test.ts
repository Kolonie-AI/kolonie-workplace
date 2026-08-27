import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/vue'
import { nextTick, ref } from 'vue'
import type { Human } from '@/domain/workplace'
import type { TaskGateway } from '@/gateway/task-gateway'
import { TASK_GATEWAY } from '@/gateway/provide-gateway'
import { createFixtureTaskGateway } from '@/gateway/fixture-task-gateway'
import { BoardAccessRefused } from '@/gateway/refusals'
import {
  FIXTURE_BOARDS,
  FIXTURE_HUMANS,
  fixtureAgents,
  fixtureBoards,
} from '@/fixtures/catalogue'
import AppShell from '@/shell/AppShell.vue'
import { createFixtureWorkplaceSession } from '@/session/fixture-workplace-session'
import { WORKPLACE_SESSION, type WorkplaceSession } from '@/session/workplace-session'

function requireBoard(id: string) {
  const board = fixtureBoards.find((candidate) => candidate.id === id)

  if (board === undefined) {
    throw new Error(`Kolonie Workplace: fixture board ${id} is missing.`)
  }

  return board
}

function requireAgent(boardId: string) {
  const agent = fixtureAgents.find((candidate) => candidate.boardIds.includes(boardId))

  if (agent === undefined) {
    throw new Error(`Kolonie Workplace: no fixture agent holds board ${boardId}.`)
  }

  return agent
}

const quillDelivery = requireBoard(FIXTURE_BOARDS.quillDelivery)
const birchResearch = requireBoard(FIXTURE_BOARDS.birchResearch)
const marlowOutreach = requireBoard(FIXTURE_BOARDS.marlowOutreach)
const marlowBacklog = requireBoard(FIXTURE_BOARDS.marlowBacklog)
const quill = requireAgent(FIXTURE_BOARDS.quillDelivery)
const birch = requireAgent(FIXTURE_BOARDS.birchResearch)
const marlow = requireAgent(FIXTURE_BOARDS.marlowOutreach)

function displayedProfession(agent: typeof quill): string {
  return agent.profession ?? 'Profession not declared'
}

async function signedInSession(humanId: string): Promise<WorkplaceSession> {
  const session = createFixtureWorkplaceSession()
  await session.signIn({ humanId })
  return session
}

function renderShell(
  session: WorkplaceSession,
  gateway: TaskGateway,
  props: Record<string, unknown> = {},
) {
  return render(AppShell, {
    props,
    global: {
      provide: {
        [WORKPLACE_SESSION]: session,
        [TASK_GATEWAY]: gateway,
      },
    },
  })
}

async function renderForHuman(
  humanId: string,
  gateway: TaskGateway = createFixtureTaskGateway(),
  props: Record<string, unknown> = {},
) {
  const session = await signedInSession(humanId)
  const view = renderShell(session, gateway, props)

  await waitFor(() => {
    expect(screen.queryByTestId('boards-loading')).toBeNull()
  })

  return view
}

function listedBoardIds(): string[] {
  return screen
    .queryAllByTestId('board-link')
    .map((link) => link.getAttribute('data-board-id'))
    .filter((id): id is string => id !== null)
}

describe('sidebar board list — journey 1: two agents, one board each', () => {
  it('lists two boards read through TaskGateway, each attributed to its agent', async () => {
    const gateway = createFixtureTaskGateway()
    const spy = vi.spyOn(gateway, 'listVisibleBoards')

    await renderForHuman(FIXTURE_HUMANS.wren, gateway)

    expect(spy).toHaveBeenCalledWith(FIXTURE_HUMANS.wren)
    expect(listedBoardIds().sort()).toEqual(
      [FIXTURE_BOARDS.quillDelivery, FIXTURE_BOARDS.birchResearch].sort(),
    )

    const groups = screen.getAllByTestId('board-group')
    expect(groups).toHaveLength(2)

    const sidebar = screen.getByTestId('sidebar')
    expect(sidebar.textContent).toContain(quillDelivery.title)
    expect(sidebar.textContent).toContain(birchResearch.title)
    expect(sidebar.textContent).toContain(quill.name)
    expect(sidebar.textContent).toContain(birch.name)
    expect(quill.profession).not.toBe(birch.profession)
    expect(groups[0]?.textContent).toContain(displayedProfession(quill))
    expect(groups[0]?.textContent).not.toContain(displayedProfession(birch))
    expect(groups[1]?.textContent).toContain(displayedProfession(birch))
    expect(groups[1]?.textContent).not.toContain(displayedProfession(quill))
  })
})

describe('sidebar board list — journey 2: one agent, two boards', () => {
  it('lists both boards in one group under that agent', async () => {
    await renderForHuman(FIXTURE_HUMANS.ash)

    expect(listedBoardIds().sort()).toEqual(
      [FIXTURE_BOARDS.marlowOutreach, FIXTURE_BOARDS.marlowBacklog].sort(),
    )

    const groups = screen.getAllByTestId('board-group')
    expect(groups).toHaveLength(1)
    expect(groups[0]?.textContent).toContain(marlow.name)
    expect(groups[0]?.textContent).toContain(displayedProfession(marlow))
    expect(within(groups[0] as HTMLElement).getAllByTestId('board-link')).toHaveLength(2)
  })
})

describe('sidebar board list — journey 3: no boards at all', () => {
  it('renders an honest empty state with no sample board and no create affordance', async () => {
    await renderForHuman(FIXTURE_HUMANS.rook)

    expect(listedBoardIds()).toEqual([])
    expect(screen.getByTestId('boards-empty').textContent).toMatch(/no boards/i)
    expect(screen.queryByTestId('boards-error')).toBeNull()
    expect(screen.queryByTestId('active-board')).toBeNull()
    expect(screen.queryByRole('button', { name: /create/i })).toBeNull()
    expect(screen.queryByText(quillDelivery.title)).toBeNull()
    expect(screen.queryByText(marlowOutreach.title)).toBeNull()
  })
})

describe('sidebar board list — journey 4: a foreign board', () => {
  it('does not list a board belonging to another human\'s agent', async () => {
    await renderForHuman(FIXTURE_HUMANS.wren)

    expect(listedBoardIds()).not.toContain(FIXTURE_BOARDS.marlowOutreach)
    expect(screen.queryByText(marlowOutreach.title)).toBeNull()
  })

  it('refuses that board when it is addressed directly, rather than opening it', async () => {
    const gateway = createFixtureTaskGateway()
    const spy = vi.spyOn(gateway, 'getBoardItems')

    await renderForHuman(FIXTURE_HUMANS.wren, gateway, {
      initialBoardId: FIXTURE_BOARDS.marlowOutreach,
    })

    await waitFor(() => {
      expect(screen.getByTestId('board-refused')).toBeTruthy()
    })

    expect(spy).toHaveBeenCalledWith(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.marlowOutreach)
    expect(screen.getByTestId('board-refused').textContent).toMatch(/not available/i)
    expect(screen.getByTestId('board-refused').textContent).not.toMatch(/outreach/i)
    expect(screen.queryByTestId('active-board')).toBeNull()
    expect(screen.queryByText(marlowOutreach.title)).toBeNull()
  })

  it('still lists the boards the human may open while a foreign one is refused', async () => {
    await renderForHuman(FIXTURE_HUMANS.wren, createFixtureTaskGateway(), {
      initialBoardId: FIXTURE_BOARDS.marlowOutreach,
    })

    await waitFor(() => {
      expect(screen.getByTestId('board-refused')).toBeTruthy()
    })

    expect(listedBoardIds().sort()).toEqual(
      [FIXTURE_BOARDS.quillDelivery, FIXTURE_BOARDS.birchResearch].sort(),
    )
    expect(screen.queryByTestId('boards-empty')).toBeNull()
  })
})

describe('sidebar board list — journey 5: an empty board is still a board', () => {
  it('lists a board that exists but holds no items', async () => {
    await renderForHuman(FIXTURE_HUMANS.ash)

    expect(listedBoardIds()).toContain(FIXTURE_BOARDS.marlowBacklog)
    expect(screen.queryByTestId('boards-empty')).toBeNull()
    expect(screen.getByText(marlowBacklog.title)).toBeTruthy()
  })

  it('opens the empty board as the active board, unlike a human with no boards', async () => {
    const noBoards = await renderForHuman(FIXTURE_HUMANS.rook)

    expect(within(noBoards.container as HTMLElement).getByTestId('boards-empty')).toBeTruthy()
    expect(within(noBoards.container as HTMLElement).queryByTestId('active-board')).toBeNull()

    const emptyBoard = await renderForHuman(
      FIXTURE_HUMANS.ash,
      createFixtureTaskGateway(),
      { initialBoardId: FIXTURE_BOARDS.marlowBacklog },
    )

    await waitFor(() => {
      expect(
        within(emptyBoard.container as HTMLElement)
          .getByTestId('active-board')
          .getAttribute('data-board-id'),
      ).toBe(FIXTURE_BOARDS.marlowBacklog)
    })
    expect(
      within(emptyBoard.container as HTMLElement).queryByTestId('boards-empty'),
    ).toBeNull()
    expect(
      within(emptyBoard.container as HTMLElement).getByTestId('active-board').textContent,
    ).toContain(marlowBacklog.title)
  })
})

describe('sidebar board list — loading and failure', () => {
  it('shows a loading state and fabricates no board while the gateway is pending', async () => {
    const gateway: TaskGateway = {
      listVisibleBoards: vi.fn(() => new Promise<never>(() => undefined)),
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

    const session = await signedInSession(FIXTURE_HUMANS.wren)
    renderShell(session, gateway)
    await nextTick()

    expect(screen.getByTestId('boards-loading')).toBeTruthy()
    expect(listedBoardIds()).toEqual([])
    expect(screen.queryByTestId('boards-empty')).toBeNull()
    expect(screen.queryByTestId('boards-error')).toBeNull()
    expect(screen.queryByText(quillDelivery.title)).toBeNull()
  })

  it('renders an error state rather than an empty list that reads as "you have none"', async () => {
    const gateway: TaskGateway = {
      listVisibleBoards: vi.fn(async () => {
        throw new Error('Kolonie Workplace: the board catalogue could not be read.')
      }),
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

    const session = await signedInSession(FIXTURE_HUMANS.wren)
    renderShell(session, gateway)

    await waitFor(() => {
      expect(screen.getByTestId('boards-error')).toBeTruthy()
    })

    expect(screen.queryByTestId('boards-empty')).toBeNull()
    expect(listedBoardIds()).toEqual([])
    expect(screen.getByTestId('boards-error').textContent).not.toMatch(/no boards/i)
  })
})

describe('sidebar board list — selecting a board', () => {
  it('makes the selected board the active board in the canvas', async () => {
    await renderForHuman(FIXTURE_HUMANS.wren)

    await fireEvent.click(screen.getByText(birchResearch.title))

    await waitFor(() => {
      expect(screen.getByTestId('active-board').getAttribute('data-board-id')).toBe(
        FIXTURE_BOARDS.birchResearch,
      )
    })
    expect(screen.getByTestId('active-board').textContent).toContain(birchResearch.title)
    expect(screen.getByTestId('active-board').textContent).toContain(birch.name)
    expect(screen.getByTestId('active-board').textContent).toContain(displayedProfession(birch))
    expect(screen.getByTestId('active-board').textContent).not.toContain(
      displayedProfession(quill),
    )
  })

  it('keeps one agent profession unchanged while switching between its boards', async () => {
    await renderForHuman(FIXTURE_HUMANS.ash)

    await fireEvent.click(screen.getByText(marlowOutreach.title))
    await waitFor(() => {
      expect(screen.getByTestId('active-board').textContent).toContain(
        displayedProfession(marlow),
      )
    })

    await fireEvent.click(screen.getByText(marlowBacklog.title))
    await waitFor(() => {
      expect(screen.getByTestId('active-board').getAttribute('data-board-id')).toBe(
        FIXTURE_BOARDS.marlowBacklog,
      )
    })
    expect(screen.getByTestId('active-board').textContent).toContain(
      displayedProfession(marlow),
    )
  })

  it('keeps profession out of every work-item card', async () => {
    await renderForHuman(FIXTURE_HUMANS.ash, createFixtureTaskGateway(), {
      initialBoardId: FIXTURE_BOARDS.marlowOutreach,
    })

    await waitFor(() => {
      expect(screen.getAllByTestId('kanban-card').length).toBeGreaterThan(0)
    })

    for (const card of screen.getAllByTestId('kanban-card')) {
      expect(card.textContent).not.toContain(displayedProfession(marlow))
    }
  })

  it('marks the selected board in the sidebar', async () => {
    await renderForHuman(FIXTURE_HUMANS.ash)

    await fireEvent.click(screen.getByText(marlowBacklog.title))

    await waitFor(() => {
      const selected = screen
        .getAllByTestId('board-link')
        .find((link) => link.getAttribute('data-board-id') === FIXTURE_BOARDS.marlowBacklog)

      expect(selected?.getAttribute('aria-current')).toBe('page')
    })

    const other = screen
      .getAllByTestId('board-link')
      .find((link) => link.getAttribute('data-board-id') === FIXTURE_BOARDS.marlowOutreach)
    expect(other?.getAttribute('aria-current')).toBeNull()
  })
})

describe('sidebar board list — read-only, and no cardinality assumption', () => {
  it('offers no create, rename, delete, favourite, archive or reorder affordance', async () => {
    const { container } = await renderForHuman(FIXTURE_HUMANS.wren)

    expect(screen.queryByRole('button', { name: /create/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /rename/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /favourite/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /favorite/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /archive/i })).toBeNull()
    expect(container.querySelector('[draggable="true"]')).toBeNull()
  })

  it('renders exactly the boards the gateway returned, whatever their shape', async () => {
    const gateway: TaskGateway = {
      listVisibleBoards: vi.fn(async () => [
        {
          id: 'board-a',
          agentId: 'agent-a',
          agentName: 'Agent A',
          profession: null,
          title: 'Board A',
        },
        {
          id: 'board-b',
          agentId: 'agent-a',
          agentName: 'Agent A',
          profession: null,
          title: 'Board B',
        },
        {
          id: 'board-c',
          agentId: 'agent-b',
          agentName: 'Agent B',
          profession: null,
          title: 'Board C',
        },
      ]),
      getBoardItems: vi.fn(async () => []),
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

    await renderForHuman(FIXTURE_HUMANS.wren, gateway)

    expect(listedBoardIds()).toEqual(['board-a', 'board-b', 'board-c'])
    expect(screen.getAllByTestId('board-group')).toHaveLength(2)
  })
})

describe('sidebar board list — any implementation of the session port', () => {
  it('asks for the boards of a human the fixtures never heard of, and invents none', async () => {
    const human = ref<Human | null>({
      id: 'stub-human',
      name: 'Stub Human From Another Implementation',
      agentIds: [],
    })
    const stub: WorkplaceSession = {
      currentHuman: human,
      signIn: async () => undefined,
      signOut: async () => {
        human.value = null
      },
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

    renderShell(stub, gateway)

    await waitFor(() => {
      expect(gateway.listVisibleBoards).toHaveBeenCalledWith('stub-human')
    })
    expect(screen.getByTestId('boards-empty')).toBeTruthy()
    expect(listedBoardIds()).toEqual([])
  })
})

describe('sidebar board list — a read failure is not a permission refusal', () => {
  it('renders a distinct unreadable state when a listed board cannot be read', async () => {
    const gateway: TaskGateway = {
      listVisibleBoards: vi.fn(async () => [
        {
          id: FIXTURE_BOARDS.quillDelivery,
          agentId: 'fictional-agent-quill',
          agentName: 'Fictional Agent Quill',
          profession: null,
          title: quillDelivery.title,
        },
      ]),
      getBoardItems: vi.fn(async () => {
        throw new Error('Kolonie Workplace: the board items could not be read.')
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

    await renderForHuman(FIXTURE_HUMANS.wren, gateway, {
      initialBoardId: FIXTURE_BOARDS.quillDelivery,
    })

    await waitFor(() => {
      expect(screen.getByTestId('board-unreadable')).toBeTruthy()
    })

    const unreadable = screen.getByTestId('board-unreadable')

    expect(unreadable.textContent).toMatch(/could not be read/i)
    expect(unreadable.textContent).not.toMatch(/not available/i)
    expect(unreadable.getAttribute('role')).toBe('alert')
    expect(screen.queryByTestId('board-refused')).toBeNull()
    expect(screen.queryByTestId('active-board')).toBeNull()
  })

  it('keeps the permission refusal visually distinct from a read failure', async () => {
    const gateway = createFixtureTaskGateway()

    await renderForHuman(FIXTURE_HUMANS.wren, gateway, {
      initialBoardId: FIXTURE_BOARDS.marlowOutreach,
    })

    await waitFor(() => {
      expect(screen.getByTestId('board-refused')).toBeTruthy()
    })

    const refused = screen.getByTestId('board-refused')

    expect(refused.textContent).toMatch(/not available/i)
    expect(refused.classList.contains('app-shell__refusal')).toBe(true)
    expect(screen.queryByTestId('board-unreadable')).toBeNull()
    expect(screen.queryByTestId('active-board')).toBeNull()
  })

  it('shows no stale board content in either case', async () => {
    const gateway: TaskGateway = {
      listVisibleBoards: vi.fn(async () => [
        {
          id: FIXTURE_BOARDS.quillDelivery,
          agentId: 'fictional-agent-quill',
          agentName: 'Fictional Agent Quill',
          profession: null,
          title: quillDelivery.title,
        },
      ]),
      getBoardItems: vi.fn(async () => {
        throw new Error('Kolonie Workplace: the board items could not be read.')
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

    await renderForHuman(FIXTURE_HUMANS.wren, gateway, {
      initialBoardId: FIXTURE_BOARDS.quillDelivery,
    })

    await waitFor(() => {
      expect(screen.getByTestId('board-unreadable')).toBeTruthy()
    })

    expect(screen.queryByTestId('active-board')).toBeNull()
    expect(screen.queryByTestId('kanban-card')).toBeNull()
    expect(screen.queryByTestId('list-row')).toBeNull()
  })

  it('rejection case: a refused second board leaves none of the first board on screen', async () => {
    const gateway = createFixtureTaskGateway()
    vi.spyOn(gateway, 'getBoardItems').mockImplementation(async (humanId, boardId) => {
      if (boardId === FIXTURE_BOARDS.birchResearch) {
        throw new BoardAccessRefused(boardId)
      }

      return createFixtureTaskGateway().getBoardItems(humanId, boardId)
    })

    await renderForHuman(FIXTURE_HUMANS.wren, gateway, {
      initialBoardId: FIXTURE_BOARDS.quillDelivery,
    })

    await waitFor(() => {
      expect(screen.getByTestId('active-board').getAttribute('data-board-id')).toBe(
        FIXTURE_BOARDS.quillDelivery,
      )
    })
    await waitFor(() => {
      expect(screen.getAllByTestId('kanban-card').length).toBeGreaterThan(0)
    })
    await fireEvent.click(screen.getAllByTestId('kanban-card')[0] as HTMLElement)
    await waitFor(() => {
      expect(screen.getByTestId('detail-pane')).toBeTruthy()
    })

    await fireEvent.click(screen.getByText(birchResearch.title))

    await waitFor(() => {
      expect(screen.getByTestId('board-refused')).toBeTruthy()
    })

    expect(screen.getByTestId('board-refused').textContent).toMatch(/not available/i)
    expect(screen.queryByTestId('board-unreadable')).toBeNull()
    expect(screen.queryByTestId('active-board')).toBeNull()
    expect(screen.queryByTestId('kanban-card')).toBeNull()
    expect(screen.queryByTestId('list-row')).toBeNull()
    expect(screen.queryByTestId('detail-pane')).toBeNull()
    expect(screen.getByTestId('kanban-no-board')).toBeTruthy()

    await fireEvent.click(screen.getByRole('tab', { name: 'List' }))

    expect(screen.queryByTestId('kanban-card')).toBeNull()
    expect(screen.queryByTestId('list-row')).toBeNull()
    expect(screen.getByTestId('list-no-board')).toBeTruthy()
  })

  it('rejection case: a failed second read leaves none of the first board on screen', async () => {
    const gateway = createFixtureTaskGateway()
    vi.spyOn(gateway, 'getBoardItems').mockImplementation(async (_humanId, boardId) => {
      if (boardId === FIXTURE_BOARDS.birchResearch) {
        throw new Error('Kolonie Workplace: the board items could not be read.')
      }

      return createFixtureTaskGateway().getBoardItems(_humanId, boardId)
    })

    await renderForHuman(FIXTURE_HUMANS.wren, gateway, {
      initialBoardId: FIXTURE_BOARDS.quillDelivery,
    })

    await waitFor(() => {
      expect(screen.getByTestId('active-board').getAttribute('data-board-id')).toBe(
        FIXTURE_BOARDS.quillDelivery,
      )
    })
    await waitFor(() => {
      expect(screen.getAllByTestId('kanban-card').length).toBeGreaterThan(0)
    })
    await fireEvent.click(screen.getByRole('tab', { name: 'List' }))
    await waitFor(() => {
      expect(screen.getAllByTestId('list-row').length).toBeGreaterThan(0)
    })
    await fireEvent.click(screen.getAllByTestId('list-row')[0] as HTMLElement)
    await waitFor(() => {
      expect(screen.getByTestId('detail-pane')).toBeTruthy()
    })

    await fireEvent.click(screen.getByText(birchResearch.title))

    await waitFor(() => {
      expect(screen.getByTestId('board-unreadable')).toBeTruthy()
    })

    expect(screen.getByTestId('board-unreadable').textContent).toMatch(/could not be read/i)
    expect(screen.getByTestId('board-unreadable').textContent).not.toMatch(/not available/i)
    expect(screen.queryByTestId('board-refused')).toBeNull()
    expect(screen.queryByTestId('active-board')).toBeNull()
    expect(screen.queryByTestId('kanban-card')).toBeNull()
    expect(screen.queryByTestId('list-row')).toBeNull()
    expect(screen.queryByTestId('detail-pane')).toBeNull()
    expect(screen.getByTestId('list-no-board')).toBeTruthy()
  })

  it('renders the newly selected board after a refusal once that board can be read', async () => {
    const gateway = createFixtureTaskGateway()
    let refuseBirch = true
    vi.spyOn(gateway, 'getBoardItems').mockImplementation(async (humanId, boardId) => {
      if (boardId === FIXTURE_BOARDS.birchResearch && refuseBirch) {
        throw new BoardAccessRefused(boardId)
      }

      return createFixtureTaskGateway().getBoardItems(humanId, boardId)
    })

    await renderForHuman(FIXTURE_HUMANS.wren, gateway, {
      initialBoardId: FIXTURE_BOARDS.quillDelivery,
    })

    await waitFor(() => {
      expect(screen.getAllByTestId('kanban-card').length).toBeGreaterThan(0)
    })

    await fireEvent.click(screen.getByText(birchResearch.title))

    await waitFor(() => {
      expect(screen.getByTestId('board-refused')).toBeTruthy()
    })
    expect(screen.queryByTestId('active-board')).toBeNull()

    refuseBirch = false
    await fireEvent.click(screen.getByText(birchResearch.title))

    await waitFor(() => {
      expect(screen.getByTestId('active-board').getAttribute('data-board-id')).toBe(
        FIXTURE_BOARDS.birchResearch,
      )
    })

    expect(screen.queryByTestId('board-refused')).toBeNull()
    expect(screen.queryByTestId('board-unreadable')).toBeNull()
    expect(screen.getByTestId('active-board').textContent).toContain(birchResearch.title)
  })

  it('renders the newly selected board after a read failure once that board can be read', async () => {
    const gateway = createFixtureTaskGateway()
    let failBirch = true
    vi.spyOn(gateway, 'getBoardItems').mockImplementation(async (humanId, boardId) => {
      if (boardId === FIXTURE_BOARDS.birchResearch && failBirch) {
        throw new Error('Kolonie Workplace: the board items could not be read.')
      }

      return createFixtureTaskGateway().getBoardItems(humanId, boardId)
    })

    await renderForHuman(FIXTURE_HUMANS.wren, gateway, {
      initialBoardId: FIXTURE_BOARDS.quillDelivery,
    })

    await waitFor(() => {
      expect(screen.getByTestId('active-board').getAttribute('data-board-id')).toBe(
        FIXTURE_BOARDS.quillDelivery,
      )
    })

    await fireEvent.click(screen.getByText(birchResearch.title))

    await waitFor(() => {
      expect(screen.getByTestId('board-unreadable')).toBeTruthy()
    })
    expect(screen.queryByTestId('active-board')).toBeNull()

    failBirch = false
    await fireEvent.click(screen.getByText(birchResearch.title))

    await waitFor(() => {
      expect(screen.getByTestId('active-board').getAttribute('data-board-id')).toBe(
        FIXTURE_BOARDS.birchResearch,
      )
    })

    expect(screen.queryByTestId('board-unreadable')).toBeNull()
    expect(screen.queryByTestId('board-refused')).toBeNull()
    expect(screen.getByTestId('active-board').textContent).toContain(birchResearch.title)
  })
})
