import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/vue'
import { WORKPLACE_LANE_LABELS } from '@/domain/lanes'
import type { BoardId } from '@/domain/workplace'
import type { TaskGateway } from '@/gateway/task-gateway'
import { TASK_GATEWAY } from '@/gateway/provide-gateway'
import { createFixtureTaskGateway } from '@/gateway/fixture-task-gateway'
import { FIXTURE_BOARDS, FIXTURE_HUMANS, FIXTURE_ITEMS } from '@/fixtures/catalogue'
import AppShell from '@/shell/AppShell.vue'
import { createFixtureWorkplaceSession } from '@/session/fixture-workplace-session'
import { WORKPLACE_SESSION, type WorkplaceSession } from '@/session/workplace-session'

async function signedInSession(humanId: string): Promise<WorkplaceSession> {
  const session = createFixtureWorkplaceSession()
  await session.signIn({ humanId })
  return session
}

async function renderBoard(
  humanId: string,
  boardId: BoardId,
  gateway: TaskGateway = createFixtureTaskGateway(),
) {
  const session = await signedInSession(humanId)
  const view = render(AppShell, {
    props: { initialBoardId: boardId },
    global: { provide: { [WORKPLACE_SESSION]: session, [TASK_GATEWAY]: gateway } },
  })

  await waitFor(() => {
    expect(screen.queryAllByTestId('kanban-card').length).toBeGreaterThan(0)
  })

  return view
}

async function openItem(itemId: string): Promise<void> {
  const card = screen
    .queryAllByTestId('kanban-card')
    .find((candidate) => candidate.getAttribute('data-item-id') === itemId)

  if (card === undefined) {
    throw new Error(`Kolonie Workplace: no card rendered for ${itemId}.`)
  }

  await fireEvent.click(card)

  await waitFor(() => {
    expect(screen.queryByTestId('detail-pane')).toBeTruthy()
  })
}

function pane(): HTMLElement {
  return screen.getByTestId('detail-pane')
}

describe('detail pane — opened from the board, beside it', () => {
  it('renders no pane until an item is opened', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    expect(screen.queryByTestId('detail-pane')).toBeNull()
  })

  it('fetches the detail through the gateway detail call when an item is opened', async () => {
    const gateway = createFixtureTaskGateway()
    const spy = vi.spyOn(gateway, 'getItemDetail')

    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)

    expect(spy).not.toHaveBeenCalled()

    await openItem(FIXTURE_ITEMS.review)

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(FIXTURE_HUMANS.wren, FIXTURE_ITEMS.review)
  })

  it('leaves the board visible while the pane is open', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)
    await openItem(FIXTURE_ITEMS.review)

    expect(screen.getByTestId('kanban-board')).toBeTruthy()
    expect(screen.queryAllByTestId('kanban-card').length).toBe(6)
  })

  it('shows the title, the lane and exactly one owner', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)
    await openItem(FIXTURE_ITEMS.review)

    expect(within(pane()).getByTestId('detail-title').textContent).toContain(
      'Review the fictional catalogue summary',
    )
    expect(within(pane()).getByTestId('detail-lane').textContent).toContain(
      WORKPLACE_LANE_LABELS.review,
    )

    const owners = within(pane()).queryAllByTestId('detail-owner')
    expect(owners).toHaveLength(1)
    expect(owners[0]?.textContent).toContain('Fictional Agent Quill')
    expect(within(pane()).queryByTestId('detail-assignees')).toBeNull()
  })

  it('opens from a List row through the same selection, not a second one', async () => {
    const session = await signedInSession(FIXTURE_HUMANS.wren)
    render(AppShell, {
      props: { initialView: 'list', initialBoardId: FIXTURE_BOARDS.quillDelivery },
      global: {
        provide: {
          [WORKPLACE_SESSION]: session,
          [TASK_GATEWAY]: createFixtureTaskGateway(),
        },
      },
    })

    await waitFor(() => {
      expect(screen.queryAllByTestId('list-row').length).toBeGreaterThan(0)
    })

    const row = screen
      .queryAllByTestId('list-row')
      .find((candidate) => candidate.getAttribute('data-item-id') === FIXTURE_ITEMS.review)

    if (row === undefined) {
      throw new Error('Kolonie Workplace: no list row rendered for the review item.')
    }

    await fireEvent.click(row)

    await waitFor(() => {
      expect(screen.queryByTestId('detail-pane')).toBeTruthy()
    })

    expect(screen.getByTestId('list-view')).toBeTruthy()
    expect(within(pane()).getByTestId('detail-title').textContent).toContain(
      'Review the fictional catalogue summary',
    )
  })

  it('closes back to the board with nothing selected', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)
    await openItem(FIXTURE_ITEMS.review)

    await fireEvent.click(within(pane()).getByTestId('detail-close'))

    await waitFor(() => {
      expect(screen.queryByTestId('detail-pane')).toBeNull()
    })

    expect(screen.getByTestId('kanban-board')).toBeTruthy()
    expect(
      screen
        .queryAllByTestId('kanban-card')
        .filter((card) => card.getAttribute('data-selected') === 'true'),
    ).toEqual([])
  })
})

describe('detail pane — the five handover parts', () => {
  it('labels and renders every one of the five parts', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)
    await openItem(FIXTURE_ITEMS.review)

    const handover = within(pane()).getByTestId('detail-handover')

    for (const part of ['done', 'learned', 'next', 'blocked', 'evidence']) {
      const entry = within(handover).getByTestId(`detail-handover-${part}`)
      expect(entry.querySelector('dt')?.textContent?.trim().length).toBeGreaterThan(0)
    }

    expect(
      within(handover).getByTestId('detail-handover-done').textContent,
    ).toContain('Prepared the fictional catalogue for review')
    expect(
      within(handover).getByTestId('detail-handover-learned').textContent,
    ).toContain('The narrow fixture path is sufficient')
    expect(
      within(handover).getByTestId('detail-handover-next').textContent,
    ).toContain('Review the typed summaries')
    expect(
      within(handover).getByTestId('detail-handover-blocked').textContent,
    ).toContain('Nothing blocks the next step')
    const evidence = within(handover).getAllByTestId('detail-evidence')
    expect(evidence).toHaveLength(2)
    expect(evidence[0]?.tagName).toBe('A')
    expect(evidence[0]?.getAttribute('href')).toBe('/fictional-evidence/typecheck')
    expect(evidence[0]?.textContent).toContain('Fictional typecheck evidence')
  })

  it('renders an honest empty state where no handover was recorded', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)
    await openItem(FIXTURE_ITEMS.inbox)

    expect(within(pane()).getByTestId('detail-handover-absent').textContent).toMatch(
      /no handover recorded/i,
    )
    expect(within(pane()).queryByTestId('detail-handover')).toBeNull()
    expect(within(pane()).queryByTestId('detail-handover-done')).toBeNull()
  })
})

describe('detail pane — the blocker', () => {
  it('shows both the actor and the smallest unblock', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)
    await openItem(FIXTURE_ITEMS.blocked)

    const blocker = within(pane()).getByTestId('detail-blocker')

    expect(within(blocker).getByTestId('detail-blocker-actor').textContent).toContain(
      'Fictional Operator Ember',
    )
    expect(within(blocker).getByTestId('detail-blocker-unblock').textContent).toContain(
      'Choose one of the fictional delivery windows',
    )
  })

  it('renders no blocker section at all for an item that is not blocked', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)
    await openItem(FIXTURE_ITEMS.review)

    expect(within(pane()).queryByTestId('detail-blocker')).toBeNull()
    expect(within(pane()).queryByTestId('detail-blocker-actor')).toBeNull()
    expect(pane().textContent).not.toMatch(/smallest unblock/i)
  })
})

describe('detail pane — evidence and external references', () => {
  it('renders external references as links to the external target', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)
    await openItem(FIXTURE_ITEMS.review)

    const links = within(pane()).getAllByTestId('detail-reference')

    expect(links).toHaveLength(1)
    expect(links[0]?.tagName).toBe('A')
    expect(links[0]?.getAttribute('href')).toBe('/fictional-reference/review')
    expect(links[0]?.textContent).toContain('Fictional review reference')
  })

  it('renders no reference list where an item carries none', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)
    await openItem(FIXTURE_ITEMS.inbox)

    expect(within(pane()).queryByTestId('detail-reference')).toBeNull()
  })
})

describe('detail pane — read-only', () => {
  it('offers no form, no edit control and no status change', async () => {
    const { container } = await renderBoard(
      FIXTURE_HUMANS.wren,
      FIXTURE_BOARDS.quillDelivery,
    )
    await openItem(FIXTURE_ITEMS.review)

    const surface = pane()

    expect(surface.querySelector('form')).toBeNull()
    expect(surface.querySelector('input')).toBeNull()
    expect(surface.querySelector('textarea')).toBeNull()
    expect(surface.querySelector('select')).toBeNull()
    expect(surface.querySelector('[contenteditable]')).toBeNull()
    expect(container.querySelector('form')).toBeNull()

    const buttons = within(surface).getAllByRole('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]?.getAttribute('data-testid')).toBe('detail-close')
  })
})

describe('detail pane — rejection: an item on a board this human may not open', () => {
  it('refuses and renders no part of the detail', async () => {
    const gateway = createFixtureTaskGateway()
    const original = gateway.getBoardItems.bind(gateway)
    vi.spyOn(gateway, 'getBoardItems').mockImplementation(async (humanId, boardId) => {
      const items = await original(humanId, boardId)
      return [
        ...items,
        {
          ...items[0]!,
          id: 'fictional-item-foreign',
          boardId,
          title: 'Prepare the fictional outreach list',
          lane: 'ready',
          owner: 'Fictional Agent Marlow',
        },
      ]
    })

    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem('fictional-item-foreign')

    const surface = pane()

    expect(within(surface).getByTestId('detail-refused')).toBeTruthy()
    expect(within(surface).queryByTestId('detail-handover')).toBeNull()
    expect(within(surface).queryByTestId('detail-blocker')).toBeNull()
    expect(within(surface).queryByTestId('detail-reference')).toBeNull()
    expect(surface.textContent).not.toContain('Prepare the fictional outreach list')
  })
})
