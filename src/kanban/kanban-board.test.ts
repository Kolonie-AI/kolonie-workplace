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

      const heading = column?.querySelector('.kanban__lane-title')

      expect(heading?.textContent).toContain(WORKPLACE_LANE_LABELS[lane])
    }

    expect(
      screen
        .getAllByTestId('kanban-lane')
        .map((column) =>
          column.querySelector('.kanban__lane-title')?.firstElementChild?.textContent?.trim(),
        ),
    ).toEqual(['Inbox', 'Ready', 'In progress', 'Blocked', 'Review', 'Done'])
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

  it('offers no Add another list control and no list menu that mutates a lane', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(screen.getAllByTestId('kanban-lane')).toHaveLength(6)
    })

    expect(screen.queryByRole('button', { name: /add (another )?list/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /rename|move list|copy list|archive list|delete list/i })).toBeNull()
    expect(screen.queryByTestId('kanban-add-list')).toBeNull()
  })

  it('states no standing drag instruction on the board', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(screen.getAllByTestId('kanban-lane')).toHaveLength(6)
    })

    expect(screen.queryByTestId('kanban-move-hint')).toBeNull()
    expect(screen.getByTestId('kanban-board').textContent).not.toMatch(
      /drag a card onto another lane/i,
    )
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

  it('shows the title on a card and keeps the owner off the face', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    const ready = requireItem(FIXTURE_ITEMS.ready)

    await waitFor(() => {
      expect(allCardIds()).toContain(FIXTURE_ITEMS.ready)
    })

    const card = screen
      .getAllByTestId('kanban-card')
      .find((candidate) => candidate.getAttribute('data-item-id') === FIXTURE_ITEMS.ready)

    expect(card?.textContent).toContain(ready.title)
    expect(card?.textContent).not.toContain(ready.owner)
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

  it('exposes the dense fixture card by accessible name', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(allCardIds()).toContain(FIXTURE_ITEMS.inProgress)
    })

    const card = screen
      .getAllByTestId('kanban-card')
      .find((candidate) => candidate.getAttribute('data-item-id') === FIXTURE_ITEMS.inProgress)

    expect(within(card as HTMLElement).getByRole('img', { name: 'Delivery' })).toBeTruthy()
    expect(within(card as HTMLElement).getByRole('img', { name: 'Research' })).toBeTruthy()
    const description = within(card as HTMLElement).getByLabelText('Has a description')
    expect(description.textContent).not.toMatch(/Aa/)
    expect(description.querySelector('svg')).not.toBeNull()
    expect(within(card as HTMLElement).getByLabelText('Checklist 1/2')).toBeTruthy()
    const comments = within(card as HTMLElement).getByLabelText('3 comments')
    expect(comments.textContent).toMatch(/3/)
    expect(comments.querySelector('svg')).not.toBeNull()
    const attachments = within(card as HTMLElement).getByLabelText('1 attachment')
    expect(attachments.textContent).toMatch(/1/)
    expect(attachments.querySelector('svg')).not.toBeNull()
  })

  it('shows an image-cover fixture card and a colour-cover strip on the default board', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(allCardIds()).toContain(FIXTURE_ITEMS.ready)
      expect(allCardIds()).toContain(FIXTURE_ITEMS.inProgress)
    })

    const ready = screen
      .getAllByTestId('kanban-card')
      .find((candidate) => candidate.getAttribute('data-item-id') === FIXTURE_ITEMS.ready)
    const inProgress = screen
      .getAllByTestId('kanban-card')
      .find((candidate) => candidate.getAttribute('data-item-id') === FIXTURE_ITEMS.inProgress)

    const imageCover = within(ready as HTMLElement).getByTestId('kanban-card-cover')
    expect(imageCover.getAttribute('data-cover-kind')).toBe('image')
    expect(imageCover.querySelector('img')?.getAttribute('src')).toBe(
      '/fictional-covers/outline.svg',
    )

    const colourCover = within(inProgress as HTMLElement).getByTestId('kanban-card-cover')
    expect(colourCover.getAttribute('data-cover-kind')).toBe('colour')
    expect(colourCover.querySelector('img')).toBeNull()
  })

  it('stays compact: no description body, handover or reference content', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(allCardIds()).toContain(FIXTURE_ITEMS.review)
    })

    const review = screen
      .getAllByTestId('kanban-card')
      .find((candidate) => candidate.getAttribute('data-item-id') === FIXTURE_ITEMS.review)

    expect(review?.textContent).not.toMatch(/Prepared the fictional catalogue/i)
    expect(review?.textContent).not.toMatch(/fictional-reference/i)
    expect(review?.textContent).not.toMatch(/The fictional summaries look complete/i)
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

  it('offers no inline edit or completion affordance', async () => {
    await renderBoard(
      FIXTURE_HUMANS.wren,
      FIXTURE_BOARDS.quillDelivery,
    )

    await waitFor(() => {
      expect(allCardIds()).toHaveLength(6)
    })

    for (const card of screen.getAllByTestId('kanban-card')) {
      expect(within(card).queryByLabelText('Move to lane')).toBeNull()
    }

    expect(screen.queryByTestId('kanban-card-move')).toBeNull()
    expect(screen.queryByTestId('kanban-card-move-disclosure')).toBeNull()
    expect(screen.queryByRole('combobox', { name: 'Move to lane' })).toBeNull()

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

describe('kanban board — inline card composer', () => {
  function laneNamed(lane: string): HTMLElement {
    const element = screen
      .getAllByTestId('kanban-lane')
      .find((candidate) => candidate.getAttribute('data-lane') === lane)

    if (element === undefined) {
      throw new Error(`Expected the ${lane} lane.`)
    }

    return element
  }

  it('offers one collapsed Add a card control in every lane, naming its lane', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /^add a card in /i })).toHaveLength(6)
    })

    for (const lane of WORKPLACE_LANES) {
      const well = laneNamed(lane)
      const collapsed = within(well).getByRole('button', {
        name: `Add a card in ${WORKPLACE_LANE_LABELS[lane]}`,
      })

      expect(collapsed.textContent?.trim()).toBe('Add a card')
    }
  })

  it('places the composer after the card stack', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)
    await screen.findAllByTestId('kanban-lane')

    const ready = laneNamed('ready')
    const cards = within(ready).getByTestId('kanban-cards')
    const composer = within(ready).getByTestId('lane-composer')

    expect(
      cards.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(composer.parentElement).toBe(ready)
    expect(ready.lastElementChild).toBe(composer)
  })

  it('keeps the composer at the bottom of an empty well', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.birchResearch)
    await screen.findAllByTestId('kanban-lane')

    const inbox = laneNamed('inbox')
    expect(within(inbox).getByTestId('lane-composer')).toBe(inbox.lastElementChild)

    await fireEvent.click(
      within(inbox).getByRole('button', { name: 'Add a card in Inbox' }),
    )
    expect(within(inbox).getByTestId('lane-composer')).toBe(inbox.lastElementChild)
  })

  it('opens a textarea with Add card and cancel controls', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)
    await screen.findAllByTestId('kanban-lane')
    const ready = laneNamed('ready')

    await fireEvent.click(
      within(ready).getByRole('button', { name: 'Add a card in Ready' }),
    )

    const field = within(ready).getByRole('textbox', {
      name: 'Enter a title or paste a link',
    })
    expect(field.tagName).toBe('TEXTAREA')
    expect(document.activeElement).toBe(field)
    expect(within(ready).getByRole('button', { name: 'Add card' })).toBeTruthy()
    expect(within(ready).getByRole('button', { name: 'Cancel adding a card' })).toBeTruthy()
    expect(
      within(ready).queryByRole('button', { name: 'Add a card in Ready' }),
    ).toBeNull()
  })

  it('creates through the gateway when the Add card button is pressed', async () => {
    const gateway = createFixtureTaskGateway()
    const create = vi.spyOn(gateway, 'createWorkItem')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await screen.findAllByTestId('kanban-lane')
    const done = laneNamed('done')
    await fireEvent.click(
      within(done).getByRole('button', { name: 'Add a card in Done' }),
    )
    const field = within(done).getByRole('textbox', {
      name: 'Enter a title or paste a link',
    })

    await fireEvent.update(field, 'A card added with the button')
    await fireEvent.click(within(done).getByRole('button', { name: 'Add card' }))

    await waitFor(() => {
      expect(within(done).getByText('A card added with the button')).toBeTruthy()
    })
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0]?.[1]).toMatchObject({
      lane: 'done',
      title: 'A card added with the button',
    })
    expect((field as HTMLTextAreaElement).value).toBe('')
  })

  it('cancels without creating and returns focus to the collapsed control', async () => {
    const gateway = createFixtureTaskGateway()
    const create = vi.spyOn(gateway, 'createWorkItem')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await screen.findAllByTestId('kanban-lane')
    const inProgress = laneNamed('in_progress')
    await fireEvent.click(
      within(inProgress).getByRole('button', { name: 'Add a card in In progress' }),
    )
    await fireEvent.update(
      within(inProgress).getByRole('textbox', { name: 'Enter a title or paste a link' }),
      'A title that is discarded',
    )

    await fireEvent.click(
      within(inProgress).getByRole('button', { name: 'Cancel adding a card' }),
    )

    expect(
      within(inProgress).queryByRole('textbox', { name: 'Enter a title or paste a link' }),
    ).toBeNull()
    expect(create).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(document.activeElement).toBe(
        within(inProgress).getByRole('button', { name: 'Add a card in In progress' }),
      )
    })
  })

  it('does not submit an empty or blank title', async () => {
    const gateway = createFixtureTaskGateway()
    const create = vi.spyOn(gateway, 'createWorkItem')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await screen.findAllByTestId('kanban-lane')
    const ready = laneNamed('ready')
    await fireEvent.click(
      within(ready).getByRole('button', { name: 'Add a card in Ready' }),
    )
    const field = within(ready).getByRole('textbox', {
      name: 'Enter a title or paste a link',
    })

    await fireEvent.keyDown(field, { key: 'Enter' })
    await fireEvent.update(field, '   ')
    await fireEvent.click(within(ready).getByRole('button', { name: 'Add card' }))

    expect(create).not.toHaveBeenCalled()
    expect(
      within(ready).getByRole('textbox', { name: 'Enter a title or paste a link' }),
    ).toBe(field)
  })

  it('creates in the chosen lane, clears the input and keeps the composer open', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)
    await screen.findAllByTestId('kanban-lane')
    const ready = laneNamed('ready')
    await fireEvent.click(within(ready).getByRole('button', { name: 'Add a card in Ready' }))
    const input = within(ready).getByRole('textbox', { name: 'Enter a title or paste a link' })

    await fireEvent.update(input, 'A card created from Ready')
    await fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(within(ready).getByText('A card created from Ready')).toBeTruthy()
    })
    expect((input as HTMLTextAreaElement).value).toBe('')
    expect(document.activeElement).toBe(input)
    expect(within(ready).getByRole('textbox', { name: 'Enter a title or paste a link' })).toBe(input)
  })

  it('closes on Escape and returns focus to the Add a card button', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)
    await screen.findAllByTestId('kanban-lane')
    const blocked = laneNamed('blocked')
    const add = within(blocked).getByRole('button', { name: 'Add a card in Blocked' })
    await fireEvent.click(add)
    const input = within(blocked).getByRole('textbox', { name: 'Enter a title or paste a link' })

    await fireEvent.keyDown(input, { key: 'Escape' })

    expect(within(blocked).queryByRole('textbox', { name: 'Enter a title or paste a link' })).toBeNull()
    await waitFor(() => {
      expect(document.activeElement).toBe(
        within(blocked).getByRole('button', { name: 'Add a card in Blocked' }),
      )
    })
  })

  it('closes on blur when the field is empty without creating', async () => {
    const gateway = createFixtureTaskGateway()
    const create = vi.spyOn(gateway, 'createWorkItem')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await screen.findAllByTestId('kanban-lane')
    const review = laneNamed('review')
    await fireEvent.click(within(review).getByRole('button', { name: 'Add a card in Review' }))

    await fireEvent.blur(within(review).getByRole('textbox', { name: 'Enter a title or paste a link' }))

    expect(within(review).queryByRole('textbox', { name: 'Enter a title or paste a link' })).toBeNull()
    expect(create).not.toHaveBeenCalled()
  })

  it('removes a rejected optimistic card and surfaces the failure', async () => {
    let rejectCreate: ((error: Error) => void) | undefined
    const gateway = createFixtureTaskGateway()
    vi.spyOn(gateway, 'createWorkItem').mockImplementation(
      async () => new Promise((_resolve, reject) => { rejectCreate = reject }),
    )
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await screen.findAllByTestId('kanban-lane')
    const inbox = laneNamed('inbox')
    await fireEvent.click(within(inbox).getByRole('button', { name: 'Add a card in Inbox' }))
    const input = within(inbox).getByRole('textbox', { name: 'Enter a title or paste a link' })
    await fireEvent.update(input, 'A card that will be rejected')
    await fireEvent.keyDown(input, { key: 'Enter' })

    expect(within(inbox).getByText('A card that will be rejected')).toBeTruthy()
    rejectCreate?.(new Error('write unavailable'))

    await waitFor(() => {
      expect(within(inbox).queryByText('A card that will be rejected')).toBeNull()
    })
    expect(screen.getByTestId('kanban-create-error').textContent).toMatch(/failed/i)
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

function transfer() {
  return {
    data: '',
    setData(_type: string, value: string) {
      this.data = value
    },
    getData() {
      return this.data
    },
    effectAllowed: '',
    dropEffect: '',
  }
}

function cardById(id: string): HTMLElement {
  const card = screen
    .getAllByTestId('kanban-card')
    .find((candidate) => candidate.getAttribute('data-item-id') === id)

  if (card === undefined) {
    throw new Error(`Kolonie Workplace: card ${id} was not rendered.`)
  }

  return card
}

function laneNamed(lane: string): HTMLElement {
  const element = screen
    .getAllByTestId('kanban-lane')
    .find((candidate) => candidate.getAttribute('data-lane') === lane)

  if (element === undefined) {
    throw new Error(`Kolonie Workplace: lane ${lane} was not rendered.`)
  }

  return element
}

async function dragCardOnto(sourceId: string, target: HTMLElement): Promise<void> {
  const payload = transfer()
  const source = cardById(sourceId)
  const start = new Event('dragstart', { bubbles: true }) as DragEvent
  Object.defineProperty(start, 'dataTransfer', { value: payload })
  source.dispatchEvent(start)

  const over = new Event('dragover', { bubbles: true, cancelable: true }) as DragEvent
  Object.defineProperty(over, 'dataTransfer', { value: payload })
  target.dispatchEvent(over)

  const drop = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent
  Object.defineProperty(drop, 'dataTransfer', { value: payload })
  target.dispatchEvent(drop)

  const end = new Event('dragend', { bubbles: true }) as DragEvent
  source.dispatchEvent(end)
}

describe('kanban board — within-list reorder and cross-list move', () => {
  it('reorders two cards in one lane through the gateway and keeps that order after a re-read', async () => {
    const gateway = createFixtureTaskGateway()
    const created = await gateway.createWorkItem(FIXTURE_HUMANS.wren, {
      boardId: FIXTURE_BOARDS.quillDelivery,
      title: 'Second fictional ready card',
      lane: 'ready',
    })
    const reorders = vi.spyOn(gateway, 'reorderWorkItem')
    const view = await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)

    await waitFor(() => {
      expect(cardIdsInLane('ready')).toEqual([FIXTURE_ITEMS.ready, created.id])
    })

    await dragCardOnto(FIXTURE_ITEMS.ready, cardById(created.id))

    await waitFor(() => {
      expect(reorders).toHaveBeenCalledWith(FIXTURE_HUMANS.wren, FIXTURE_ITEMS.ready, {
        lane: 'ready',
        position: 1,
      })
    })
    expect(cardIdsInLane('ready')).toEqual([created.id, FIXTURE_ITEMS.ready])

    await fireEvent.click(screen.getByText('Fictional Birch Research'))
    await waitFor(() => {
      expect(within(view.container as HTMLElement).getByTestId('kanban-board-empty')).toBeTruthy()
    })
    await fireEvent.click(screen.getByText('Fictional Quill Delivery'))
    await waitFor(() => {
      expect(cardIdsInLane('ready')).toEqual([created.id, FIXTURE_ITEMS.ready])
    })
  })

  it('moves a card onto another lifecycle lane through moveItemToLane', async () => {
    const gateway = createFixtureTaskGateway()
    const moves = vi.spyOn(gateway, 'moveItemToLane')
    const reorders = vi.spyOn(gateway, 'reorderWorkItem')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)

    await waitFor(() => {
      expect(cardIdsInLane('ready')).toEqual([FIXTURE_ITEMS.ready])
    })

    await dragCardOnto(
      FIXTURE_ITEMS.ready,
      within(laneNamed('in_progress')).getByTestId('kanban-cards'),
    )

    await waitFor(() => {
      expect(moves).toHaveBeenCalledWith(
        FIXTURE_HUMANS.wren,
        FIXTURE_ITEMS.ready,
        'in_progress',
      )
    })
    expect(reorders).not.toHaveBeenCalled()
    expect(cardIdsInLane('ready')).toEqual([])
    expect(cardIdsInLane('in_progress')).toEqual([
      FIXTURE_ITEMS.inProgress,
      FIXTURE_ITEMS.ready,
    ])
  })

  it('reorders with ArrowUp and ArrowDown and never uses a pointer', async () => {
    const gateway = createFixtureTaskGateway()
    const created = await gateway.createWorkItem(FIXTURE_HUMANS.wren, {
      boardId: FIXTURE_BOARDS.quillDelivery,
      title: 'Second fictional ready card',
      lane: 'ready',
    })
    const reorders = vi.spyOn(gateway, 'reorderWorkItem')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)

    await waitFor(() => {
      expect(cardIdsInLane('ready')).toEqual([FIXTURE_ITEMS.ready, created.id])
    })

    await fireEvent.keyDown(cardById(FIXTURE_ITEMS.ready), { key: 'ArrowDown' })

    await waitFor(() => {
      expect(reorders).toHaveBeenCalledWith(FIXTURE_HUMANS.wren, FIXTURE_ITEMS.ready, {
        lane: 'ready',
        position: 1,
      })
    })
    expect(cardIdsInLane('ready')).toEqual([created.id, FIXTURE_ITEMS.ready])

    await fireEvent.keyDown(cardById(FIXTURE_ITEMS.ready), { key: 'ArrowUp' })

    await waitFor(() => {
      expect(reorders).toHaveBeenCalledWith(FIXTURE_HUMANS.wren, FIXTURE_ITEMS.ready, {
        lane: 'ready',
        position: 0,
      })
    })
    expect(cardIdsInLane('ready')).toEqual([FIXTURE_ITEMS.ready, created.id])
  })

  it('moves across lanes with ArrowLeft and ArrowRight through the same gateway call as a drop', async () => {
    const gateway = createFixtureTaskGateway()
    const moves = vi.spyOn(gateway, 'moveItemToLane')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)

    await waitFor(() => {
      expect(cardIdsInLane('ready')).toEqual([FIXTURE_ITEMS.ready])
    })

    await fireEvent.keyDown(cardById(FIXTURE_ITEMS.ready), { key: 'ArrowRight' })

    await waitFor(() => {
      expect(moves).toHaveBeenCalledWith(
        FIXTURE_HUMANS.wren,
        FIXTURE_ITEMS.ready,
        'in_progress',
      )
    })
    expect(moves).toHaveBeenCalledTimes(1)
    expect(cardIdsInLane('in_progress')).toContain(FIXTURE_ITEMS.ready)

    await fireEvent.keyDown(cardById(FIXTURE_ITEMS.ready), { key: 'ArrowLeft' })

    await waitFor(() => {
      expect(moves).toHaveBeenCalledWith(FIXTURE_HUMANS.wren, FIXTURE_ITEMS.ready, 'ready')
    })
    expect(cardIdsInLane('ready')).toContain(FIXTURE_ITEMS.ready)
  })

  it('shows a lifted card and a drop placeholder while a card is dragged', async () => {
    const gateway = createFixtureTaskGateway()
    await gateway.createWorkItem(FIXTURE_HUMANS.wren, {
      boardId: FIXTURE_BOARDS.quillDelivery,
      title: 'Second fictional ready card',
      lane: 'ready',
    })
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)

    await waitFor(() => {
      expect(cardIdsInLane('ready')).toHaveLength(2)
    })

    const payload = transfer()
    const source = cardById(FIXTURE_ITEMS.ready)
    const start = new Event('dragstart', { bubbles: true }) as DragEvent
    Object.defineProperty(start, 'dataTransfer', { value: payload })
    source.dispatchEvent(start)

    const over = new Event('dragover', { bubbles: true, cancelable: true }) as DragEvent
    Object.defineProperty(over, 'dataTransfer', { value: payload })
    laneNamed('ready').dispatchEvent(over)

    await waitFor(() => {
      expect(screen.getByTestId('kanban-drop-placeholder')).toBeTruthy()
    })
    expect(source.getAttribute('data-lifted')).toBe('true')
    expect(laneNamed('ready').getAttribute('draggable')).toBeNull()
  })

  it('ignores a drop on list chrome rather than a card position', async () => {
    const gateway = createFixtureTaskGateway()
    const moves = vi.spyOn(gateway, 'moveItemToLane')
    const reorders = vi.spyOn(gateway, 'reorderWorkItem')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)

    await waitFor(() => {
      expect(cardIdsInLane('ready')).toEqual([FIXTURE_ITEMS.ready])
    })

    const title = laneNamed('in_progress').querySelector('.kanban__lane-title')
    if (title === null) {
      throw new Error('Kolonie Workplace: expected a lane title.')
    }

    await dragCardOnto(FIXTURE_ITEMS.ready, title as HTMLElement)
    await dragCardOnto(FIXTURE_ITEMS.ready, laneNamed('in_progress'))

    expect(moves).not.toHaveBeenCalled()
    expect(reorders).not.toHaveBeenCalled()
    expect(cardIdsInLane('ready')).toEqual([FIXTURE_ITEMS.ready])
  })

  it('restores the previous order when a reorder is refused', async () => {
    const gateway = createFixtureTaskGateway()
    const created = await gateway.createWorkItem(FIXTURE_HUMANS.wren, {
      boardId: FIXTURE_BOARDS.quillDelivery,
      title: 'Second fictional ready card',
      lane: 'ready',
    })
    vi.spyOn(gateway, 'reorderWorkItem').mockRejectedValue(
      new Error('Kolonie Workplace: that work item is not available to this human.'),
    )
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)

    await waitFor(() => {
      expect(cardIdsInLane('ready')).toEqual([FIXTURE_ITEMS.ready, created.id])
    })

    await fireEvent.keyDown(cardById(FIXTURE_ITEMS.ready), { key: 'ArrowDown' })

    await waitFor(() => {
      expect(screen.getByTestId('kanban-move-error')).toBeTruthy()
    })
    expect(cardIdsInLane('ready')).toEqual([FIXTURE_ITEMS.ready, created.id])
  })
})
