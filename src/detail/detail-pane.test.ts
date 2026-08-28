import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/vue'
import { WORKPLACE_LANE_LABELS } from '@/domain/lanes'
import type { BoardId } from '@/domain/workplace'
import type { TaskGateway } from '@/gateway/task-gateway'
import { TASK_GATEWAY } from '@/gateway/provide-gateway'
import { WORKPLACE_CLOCK } from '@/clock/workplace-clock'
import { createFixtureTaskGateway } from '@/gateway/fixture-task-gateway'
import { FIXTURE_BOARDS, FIXTURE_HUMANS, FIXTURE_ITEMS, FIXTURE_LABELS } from '@/fixtures/catalogue'
import AppShell from '@/shell/AppShell.vue'
import { createFixtureWorkplaceSession } from '@/session/fixture-workplace-session'
import { WORKPLACE_SESSION, type WorkplaceSession } from '@/session/workplace-session'

const FIXED_NOW = new Date('2026-08-27T12:00:00.000Z')

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
    global: {
      provide: {
        [WORKPLACE_SESSION]: session,
        [TASK_GATEWAY]: gateway,
        [WORKPLACE_CLOCK]: () => FIXED_NOW,
      },
    },
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
    expect(within(pane()).getByTestId('detail-assignees').textContent).toContain(
      'Fictional Human Wren',
    )
  })

  it('opens from a List row through the same selection, not a second one', async () => {
    const session = await signedInSession(FIXTURE_HUMANS.wren)
    render(AppShell, {
      props: { initialView: 'list', initialBoardId: FIXTURE_BOARDS.quillDelivery },
      global: {
        provide: {
          [WORKPLACE_SESSION]: session,
          [TASK_GATEWAY]: createFixtureTaskGateway(),
          [WORKPLACE_CLOCK]: () => FIXED_NOW,
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

describe('detail pane — editable title', () => {
  it('saves on blur and updates the board card without refetching the board', async () => {
    const gateway = createFixtureTaskGateway()
    const boardReads = vi.spyOn(gateway, 'getBoardItems')
    const updates = vi.spyOn(gateway, 'updateWorkItem')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.review)
    const readsBeforeEdit = boardReads.mock.calls.length
    const title = within(pane()).getByRole('textbox', { name: 'Work item title' })
    title.textContent = 'Review the revised fictional catalogue'
    await fireEvent.input(title)
    await fireEvent.blur(title)

    await waitFor(() => {
      const card = screen
        .getAllByTestId('kanban-card')
        .find((candidate) => candidate.getAttribute('data-item-id') === FIXTURE_ITEMS.review)
      expect(card?.textContent).toContain('Review the revised fictional catalogue')
    })
    expect(updates).toHaveBeenCalledWith(
      FIXTURE_HUMANS.wren,
      FIXTURE_ITEMS.review,
      { title: 'Review the revised fictional catalogue' },
    )
    expect(boardReads).toHaveBeenCalledTimes(readsBeforeEdit)
  })

  it('saves on Enter', async () => {
    const gateway = createFixtureTaskGateway()
    const updates = vi.spyOn(gateway, 'updateWorkItem')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.review)
    const title = within(pane()).getByRole('textbox', { name: 'Work item title' })
    title.textContent = 'Review on Enter'
    await fireEvent.input(title)
    await fireEvent.keyDown(title, { key: 'Enter' })

    await waitFor(() => {
      expect(updates).toHaveBeenCalledWith(
        FIXTURE_HUMANS.wren,
        FIXTURE_ITEMS.review,
        { title: 'Review on Enter' },
      )
    })
  })

  it('restores the previous title on Escape without writing', async () => {
    const gateway = createFixtureTaskGateway()
    const updates = vi.spyOn(gateway, 'updateWorkItem')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.review)
    const title = within(pane()).getByRole('textbox', { name: 'Work item title' })
    title.textContent = 'Discard this title'
    await fireEvent.input(title)
    await fireEvent.keyDown(title, { key: 'Escape' })

    expect(title.textContent).toBe('Review the fictional catalogue summary')
    expect(updates).not.toHaveBeenCalled()
  })
})

describe('detail pane — rich-text description', () => {
  it('renders formatted markup and exposes the supported formatting controls', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)
    await openItem(FIXTURE_ITEMS.review)
    const description = within(pane()).getByRole('textbox', { name: 'Work item description' })

    expect(description.querySelector('p')?.textContent).toContain(
      'Review the typed summaries against the fictional catalogue.',
    )
    for (const name of ['Bold', 'Italic', 'Bulleted list', 'Numbered list', 'Link', 'Code']) {
      expect(within(pane()).getByRole('button', { name })).toBeTruthy()
    }
  })

  it('round-trips formatted markup through the gateway', async () => {
    const gateway = createFixtureTaskGateway()
    const updates = vi.spyOn(gateway, 'updateWorkItem')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.review)
    const description = within(pane()).getByRole('textbox', { name: 'Work item description' })
    description.innerHTML = '<p><strong>Bold</strong> and <em>italic</em></p><ul><li><code>code</code></li></ul>'

    await fireEvent.input(description)
    await fireEvent.blur(description)

    await waitFor(() => {
      expect(updates).toHaveBeenCalledWith(
        FIXTURE_HUMANS.wren,
        FIXTURE_ITEMS.review,
        {
          description: '<p><strong>Bold</strong> and <em>italic</em></p><ul><li><code>code</code></li></ul>',
        },
      )
    })
    expect(description.querySelector('strong')?.textContent).toBe('Bold')
    expect(description.querySelector('code')?.textContent).toBe('code')
    expect(description.textContent).not.toContain('<strong>')
  })

  it('removes scripts and event-handler attributes before markup reaches the gateway or DOM', async () => {
    const gateway = createFixtureTaskGateway()
    const updates = vi.spyOn(gateway, 'updateWorkItem')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.review)
    const description = within(pane()).getByRole('textbox', { name: 'Work item description' })
    description.innerHTML = '<p>Safe<img src="x" onerror="alert(1)"></p><script>alert(2)</script>'

    await fireEvent.input(description)
    await fireEvent.blur(description)

    await waitFor(() => {
      expect(updates).toHaveBeenCalledWith(
        FIXTURE_HUMANS.wren,
        FIXTURE_ITEMS.review,
        { description: '<p>Safe</p>' },
      )
    })
    expect(description.querySelector('script')).toBeNull()
    expect(description.querySelector('[onerror]')).toBeNull()
    expect(description.innerHTML).toBe('<p>Safe</p>')
  })
})

describe('detail pane — labels and assignees', () => {
  it('filters labels, omits attached labels, and selects with arrows and Enter', async () => {
    const gateway = createFixtureTaskGateway()
    const boardReads = vi.spyOn(gateway, 'getBoardItems')
    const updates = vi.spyOn(gateway, 'updateWorkItem')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.review)
    const readsBeforeEdit = boardReads.mock.calls.length
    const input = within(pane()).getByRole('combobox', { name: 'Search labels' })

    await fireEvent.focus(input)
    expect(within(pane()).queryByRole('option', { name: 'Research' })).toBeNull()
    expect(within(pane()).getByRole('option', { name: 'Delivery' })).toBeTruthy()

    await fireEvent.update(input, 'del')
    expect(within(pane()).getByRole('option', { name: 'Delivery' })).toBeTruthy()

    await fireEvent.keyDown(input, { key: 'ArrowDown' })
    const activeId = input.getAttribute('aria-activedescendant')
    expect(activeId).toBeTruthy()
    expect(document.getElementById(activeId ?? '')?.textContent).toContain('Delivery')
    await fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(updates).toHaveBeenCalledWith(
        FIXTURE_HUMANS.wren,
        FIXTURE_ITEMS.review,
        { labels: [FIXTURE_LABELS.research, FIXTURE_LABELS.delivery] },
      )
    })
    expect(within(pane()).getByRole('button', { name: 'Remove label Delivery' })).toBeTruthy()
    const card = screen
      .getAllByTestId('kanban-card')
      .find((candidate) => candidate.getAttribute('data-item-id') === FIXTURE_ITEMS.review)
    expect(within(card as HTMLElement).getByRole('img', { name: 'Delivery' })).toBeTruthy()
    expect(boardReads).toHaveBeenCalledTimes(readsBeforeEdit)
  })

  it('creates a label inline with a colour from the palette', async () => {
    const gateway = createFixtureTaskGateway()
    const updates = vi.spyOn(gateway, 'updateWorkItem')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.review)
    const input = within(pane()).getByRole('combobox', { name: 'Search labels' })

    await fireEvent.update(input, 'Needs copy')
    await fireEvent.click(within(pane()).getByRole('button', { name: 'Choose label colour 2' }))
    await fireEvent.click(within(pane()).getByRole('option', { name: 'Create label Needs copy' }))

    await waitFor(() => {
      expect(updates).toHaveBeenCalledWith(
        FIXTURE_HUMANS.wren,
        FIXTURE_ITEMS.review,
        {
          labels: [
            FIXTURE_LABELS.research,
            expect.objectContaining({ title: 'Needs copy', colour: '#00db60' }),
          ],
        },
      )
    })
  })

  it('removes a label from its chip and Backspace removes the last assignee', async () => {
    const gateway = createFixtureTaskGateway()
    const updates = vi.spyOn(gateway, 'updateWorkItem')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.review)

    await fireEvent.click(within(pane()).getByRole('button', { name: 'Remove label Research' }))
    await waitFor(() => {
      expect(updates).toHaveBeenCalledWith(
        FIXTURE_HUMANS.wren,
        FIXTURE_ITEMS.review,
        { labels: [] },
      )
    })

    const assigneeInput = within(pane()).getByRole('combobox', { name: 'Search assignees' })
    await fireEvent.keyDown(assigneeInput, { key: 'Backspace' })
    await waitFor(() => {
      expect(updates).toHaveBeenCalledWith(
        FIXTURE_HUMANS.wren,
        FIXTURE_ITEMS.review,
        { assignees: [] },
      )
    })
  })

  it('adds an assignee with keyboard navigation', async () => {
    const gateway = createFixtureTaskGateway()
    const updates = vi.spyOn(gateway, 'updateWorkItem')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.review)
    const input = within(pane()).getByRole('combobox', { name: 'Search assignees' })

    await fireEvent.update(input, 'ember')
    await fireEvent.keyDown(input, { key: 'ArrowDown' })
    await fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(updates).toHaveBeenCalledWith(
        FIXTURE_HUMANS.wren,
        FIXTURE_ITEMS.review,
        {
          assignees: [
            { id: FIXTURE_HUMANS.wren, name: 'Fictional Human Wren' },
            { id: 'fictional-human-ember', name: 'Fictional Operator Ember' },
          ],
        },
      )
    })
  })

  it('leaves the chip set unchanged when the gateway rejects an update', async () => {
    const gateway = createFixtureTaskGateway()
    vi.spyOn(gateway, 'updateWorkItem').mockRejectedValueOnce(new Error('fixture rejection'))
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.review)
    const input = within(pane()).getByRole('combobox', { name: 'Search labels' })

    await fireEvent.update(input, 'del')
    await fireEvent.keyDown(input, { key: 'ArrowDown' })
    await fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(within(pane()).getByRole('alert').textContent).toMatch(/updating/i)
    })
    expect(within(pane()).getByRole('button', { name: 'Remove label Research' })).toBeTruthy()
    expect(within(pane()).queryByRole('button', { name: 'Remove label Delivery' })).toBeNull()
  })
})

describe('detail pane — metadata', () => {
  it('lays out lane, owner, priority, due date, labels and assignees', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)
    await openItem(FIXTURE_ITEMS.review)

    expect(within(pane()).getByTestId('detail-lane').textContent).toContain('Review')
    expect(within(pane()).getByTestId('detail-owner').textContent).toContain('Fictional Agent Quill')
    expect(within(pane()).getByRole('combobox', { name: 'Priority' })).toHaveProperty('value', 'medium')
    expect(within(pane()).getByLabelText('Due date')).toHaveProperty('value', '2026-09-10')
    expect(within(pane()).getByTestId('detail-due-relative').textContent).toBe('in 14 days')
    expect(within(pane()).getByTestId('detail-labels').textContent).toContain('Research')
    expect(within(pane()).getByTestId('detail-assignees').textContent).toContain('Fictional Human Wren')
  })
})

describe('detail pane — priority, due date and progress', () => {
  it('writes each of the three fields through the gateway and updates the card without a refetch', async () => {
    const gateway = createFixtureTaskGateway()
    const boardReads = vi.spyOn(gateway, 'getBoardItems')
    const updates = vi.spyOn(gateway, 'updateWorkItem')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.review)
    const readsBeforeEdit = boardReads.mock.calls.length

    await fireEvent.update(within(pane()).getByRole('combobox', { name: 'Priority' }), 'urgent')
    await waitFor(() => {
      expect(updates).toHaveBeenCalledWith(
        FIXTURE_HUMANS.wren,
        FIXTURE_ITEMS.review,
        { priority: 'urgent' },
      )
    })

    await fireEvent.update(within(pane()).getByLabelText('Due date'), '2026-08-24')
    await waitFor(() => {
      expect(updates).toHaveBeenCalledWith(
        FIXTURE_HUMANS.wren,
        FIXTURE_ITEMS.review,
        { dueDate: '2026-08-24' },
      )
    })

    await fireEvent.update(within(pane()).getByRole('slider', { name: 'Percent done' }), '50')
    await waitFor(() => {
      expect(updates).toHaveBeenCalledWith(
        FIXTURE_HUMANS.wren,
        FIXTURE_ITEMS.review,
        { percentDone: 50 },
      )
    })

    const card = screen
      .getAllByTestId('kanban-card')
      .find((candidate) => candidate.getAttribute('data-item-id') === FIXTURE_ITEMS.review)

    expect(within(card!).queryByTestId('kanban-card-priority')).toBeNull()
    expect(within(card!).getByTestId('kanban-card-due').textContent).toBe('3 days ago')
    expect(within(card!).getByTestId('kanban-card-due').getAttribute('data-due-state')).toBe('overdue')
    expect(within(card!).queryByTestId('kanban-card-progress')).toBeNull()
    expect(boardReads).toHaveBeenCalledTimes(readsBeforeEdit)
  })

  it('marks an overdue item on both the card and the detail view from the injected clock', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)
    await openItem(FIXTURE_ITEMS.blocked)

    const card = screen
      .getAllByTestId('kanban-card')
      .find((candidate) => candidate.getAttribute('data-item-id') === FIXTURE_ITEMS.blocked)

    expect(within(card!).getByTestId('kanban-card-due').getAttribute('data-due-state')).toBe('overdue')
    expect(within(card!).getByTestId('kanban-card-due').textContent).toBe('7 days ago')
    expect(within(pane()).getByTestId('detail-due-date').getAttribute('data-due-state')).toBe('overdue')
    expect(within(pane()).getByTestId('detail-due-relative').textContent).toBe('7 days ago')
  })

  it('offers every Colony priority level without importing a numeric constant table', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)
    await openItem(FIXTURE_ITEMS.review)
    const select = within(pane()).getByRole('combobox', { name: 'Priority' })
    const values = [...select.querySelectorAll('option')].map((option) => option.getAttribute('value'))

    expect(values).toEqual(['unset', 'low', 'medium', 'high', 'urgent', 'do_now'])
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
