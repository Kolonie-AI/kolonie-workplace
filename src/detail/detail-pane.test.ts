import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/vue'
import type { BoardId } from '@/domain/workplace'
import type { TaskGateway } from '@/gateway/task-gateway'
import { TASK_GATEWAY } from '@/gateway/provide-gateway'
import { WORKPLACE_CLOCK } from '@/clock/workplace-clock'
import { createHttpTaskGateway } from '@/gateway/http-task-gateway'
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

async function openRail(
  name: 'Labels' | 'Members' | 'Dates' | 'Priority' | 'Cover' | 'Connection',
): Promise<void> {
  await fireEvent.click(within(pane()).getByRole('button', { name }))
}

describe('detail pane — opened from the board, over it', () => {
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

    expect(pane().getAttribute('role')).toBe('dialog')
    expect(pane().getAttribute('aria-modal')).toBe('true')
    expect(within(pane()).getByTestId('detail-title').textContent).toContain(
      'Review the fictional catalogue summary',
    )
    const lane = within(pane()).getByRole('combobox', { name: 'Change list for this card' })
    expect(lane).toHaveProperty('value', 'review')
    expect(within(pane()).getByTestId('detail-lane')).toBe(lane)

    const owners = within(pane()).queryAllByTestId('detail-owner')
    expect(owners).toHaveLength(1)
    expect(owners[0]?.textContent).toContain('Fictional Agent Quill')
    expect(within(pane()).queryByTestId('detail-assignees')).toBeNull()
    expect(within(pane()).getByRole('heading', { name: 'Checklist' })).toBeTruthy()
    expect(within(pane()).getByRole('heading', { name: 'Attachments' })).toBeTruthy()
    expect(within(pane()).getByRole('heading', { name: 'Comments and activity' })).toBeTruthy()
    expect(within(pane()).getByRole('button', { name: 'Checklist' })).toBeTruthy()
    expect(within(pane()).getByRole('button', { name: 'Attachment' })).toBeTruthy()
    expect(within(pane()).getByRole('button', { name: 'Connection' })).toBeTruthy()
    expect(within(pane()).getByRole('button', { name: 'Cover' })).toBeTruthy()
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

  it('restores focus to the card that opened it', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)
    const card = screen
      .getAllByTestId('kanban-card')
      .find((candidate) => candidate.getAttribute('data-item-id') === FIXTURE_ITEMS.review)

    if (card === undefined) {
      throw new Error('Kolonie Workplace: no card rendered for the review item.')
    }

    card.focus()
    await fireEvent.click(card)
    await waitFor(() => {
      expect(screen.queryByTestId('detail-pane')).toBeTruthy()
    })
    expect(pane().contains(document.activeElement)).toBe(true)

    await fireEvent.click(within(pane()).getByTestId('detail-close'))
    await waitFor(() => {
      expect(screen.queryByTestId('detail-pane')).toBeNull()
    })
    expect(document.activeElement).toBe(card)
  })

  it('closes on Escape and on overlay click', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)
    await openItem(FIXTURE_ITEMS.review)

    await fireEvent.keyDown(pane(), { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByTestId('detail-pane')).toBeNull()
    })

    await openItem(FIXTURE_ITEMS.review)
    await fireEvent.click(screen.getByTestId('detail-overlay'))
    await waitFor(() => {
      expect(screen.queryByTestId('detail-pane')).toBeNull()
    })
  })

  it('keeps unused add-to-card actions in popovers rather than a stacked form', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)
    await openItem(FIXTURE_ITEMS.review)

    expect(within(pane()).queryByRole('combobox', { name: 'Search labels' })).toBeNull()
    expect(within(pane()).queryByRole('combobox', { name: 'Search assignees' })).toBeNull()
    expect(within(pane()).queryByLabelText('Due date')).toBeNull()
    expect(within(pane()).queryByRole('combobox', { name: 'Priority' })).toBeNull()

    await openRail('Labels')
    expect(within(pane()).getByRole('dialog', { name: 'Labels' })).toBeTruthy()
    expect(within(pane()).getByRole('combobox', { name: 'Search labels' })).toBeTruthy()
  })

  it('dims the board behind the dialog', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)
    await openItem(FIXTURE_ITEMS.review)

    expect(screen.getByTestId('detail-overlay').classList.contains('detail-overlay')).toBe(true)
    expect(screen.getByTestId('kanban-board')).toBeTruthy()
  })

  it('moves the open card to another lane through moveItemToLane', async () => {
    const gateway = createFixtureTaskGateway()
    const moves = vi.spyOn(gateway, 'moveItemToLane')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.review)

    await fireEvent.update(
      within(pane()).getByRole('combobox', { name: 'Change list for this card' }),
      'done',
    )

    await waitFor(() => {
      expect(moves).toHaveBeenCalledWith(FIXTURE_HUMANS.wren, FIXTURE_ITEMS.review, 'done')
    })
    expect(within(pane()).getByRole('combobox', { name: 'Change list for this card' })).toHaveProperty(
      'value',
      'done',
    )
  })

  it('closes only the open popover on Escape and leaves the card dialog open', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)
    await openItem(FIXTURE_ITEMS.review)
    await openRail('Labels')

    expect(within(pane()).getByRole('dialog', { name: 'Labels' })).toBeTruthy()
    await fireEvent.keyDown(pane(), { key: 'Escape' })
    expect(within(pane()).queryByRole('dialog', { name: 'Labels' })).toBeNull()
    expect(screen.getByTestId('detail-pane')).toBeTruthy()
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

describe('detail pane — typed connections', () => {
  it('renders typed rows with a vault name only and an explicit unresolvable state', async () => {
    const plantedValue = 'planted-value-never-rendered'
    const gateway = createFixtureTaskGateway()
    vi.spyOn(gateway, 'getItemDetail').mockImplementationOnce(async (humanId, itemId) => {
      const current = await createFixtureTaskGateway().getItemDetail(humanId, itemId)
      return {
        ...current,
        links: [
          ...current.links,
          {
            id: 'fictional-link-unresolvable',
            kind: 'account',
            ref: 'fictional-account-id',
            state: 'unresolvable',
            summary: 'Not resolvable',
          },
          {
            id: 'fictional-link-vault-value',
            kind: 'vault',
            ref: 'fictional/name-only',
            state: 'resolved',
            summary: 'fictional/name-only',
            value: plantedValue,
          } as never,
        ],
      }
    })

    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.review)

    const rows = within(pane()).getAllByTestId('detail-connection')
    expect(rows.map((row) => row.getAttribute('data-link-kind'))).toEqual([
      'url',
      'vault',
      'account',
      'vault',
    ])
    expect(rows[2]?.textContent).toContain('Not resolvable')
    expect(pane().textContent).toContain('fictional/name-only')
    expect(pane().textContent).not.toContain(plantedValue)
  })

  it('adds account and vault connections, then removes one without reloading the board', async () => {
    const gateway = createFixtureTaskGateway()
    const adds = vi.spyOn(gateway, 'addCardLink')
    const removes = vi.spyOn(gateway, 'removeCardLink')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.ready)

    await openRail('Connection')
    await fireEvent.update(within(pane()).getByLabelText('Account identifier'), 'fictional-account-id')
    await fireEvent.update(within(pane()).getByLabelText('Connection note'), 'Primary account')
    await fireEvent.click(within(pane()).getByRole('button', { name: 'Add connection' }))

    await waitFor(() => expect(adds).toHaveBeenCalledWith(
      FIXTURE_HUMANS.wren,
      FIXTURE_ITEMS.ready,
      { kind: 'account', ref: 'fictional-account-id', note: 'Primary account' },
    ))

    await fireEvent.update(within(pane()).getByLabelText('Connection kind'), 'vault')
    await fireEvent.update(within(pane()).getByLabelText('Vault identifier'), 'fictional/mailbox')
    await fireEvent.click(within(pane()).getByRole('button', { name: 'Add connection' }))

    await waitFor(() => {
      expect(within(pane()).getAllByTestId('detail-connection')).toHaveLength(2)
    })
    const accountRemove = within(pane()).getByRole('button', {
      name: 'Remove Account connection fictional-account-id',
    })
    await fireEvent.click(accountRemove)
    await waitFor(() => expect(removes).toHaveBeenCalledTimes(1))
    expect(within(pane()).getAllByTestId('detail-connection')).toHaveLength(1)
    expect(pane().textContent).toContain('fictional/mailbox')
  })

  it('rejects non-https external URLs before calling the gateway', async () => {
    const gateway = createFixtureTaskGateway()
    const adds = vi.spyOn(gateway, 'addCardLink')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.ready)
    await openRail('Connection')

    await fireEvent.update(within(pane()).getByLabelText('Connection kind'), 'url')
    await fireEvent.update(within(pane()).getByLabelText('URL identifier'), 'not-https')
    await fireEvent.click(within(pane()).getByRole('button', { name: 'Add connection' }))

    expect(within(pane()).getByRole('alert').textContent).toMatch(/https:\/\//)
    expect(adds).not.toHaveBeenCalled()
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

async function startDescriptionEdit(): Promise<HTMLElement> {
  await fireEvent.click(within(pane()).getByRole('button', { name: 'Edit description' }))
  const editor = await waitFor(() =>
    within(pane()).getByRole('textbox', { name: 'Work item description' }),
  )
  await waitFor(() => {
    expect(editor.innerHTML.length).toBeGreaterThan(0)
  })
  return editor
}

describe('detail pane — rich-text description', () => {
  it('renders formatted markup and keeps the formatting toolbar behind Edit', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)
    await openItem(FIXTURE_ITEMS.review)
    const preview = within(pane()).getByTestId('detail-description')

    expect(preview.querySelector('p')?.textContent).toContain(
      'Review the typed summaries against the fictional catalogue.',
    )
    expect(preview.getAttribute('contenteditable')).toBeNull()
    expect(within(pane()).queryByRole('textbox', { name: 'Work item description' })).toBeNull()
    for (const name of ['Bold', 'Italic', 'Bulleted list', 'Numbered list', 'Link', 'Code']) {
      expect(within(pane()).queryByRole('button', { name })).toBeNull()
    }

    await startDescriptionEdit()
    for (const name of ['Bold', 'Italic', 'Bulleted list', 'Numbered list', 'Link', 'Code']) {
      expect(within(pane()).getByRole('button', { name })).toBeTruthy()
    }
  })

  it('round-trips formatted markup through the gateway', async () => {
    const gateway = createFixtureTaskGateway()
    const updates = vi.spyOn(gateway, 'updateWorkItem')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.review)
    const description = await startDescriptionEdit()
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
    const preview = within(pane()).getByTestId('detail-description')
    expect(preview.querySelector('strong')?.textContent).toBe('Bold')
    expect(preview.querySelector('code')?.textContent).toBe('code')
    expect(preview.textContent).not.toContain('<strong>')
  })

  it('removes scripts and event-handler attributes before markup reaches the gateway or DOM', async () => {
    const gateway = createFixtureTaskGateway()
    const updates = vi.spyOn(gateway, 'updateWorkItem')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.review)
    const description = await startDescriptionEdit()
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
    const preview = within(pane()).getByTestId('detail-description')
    expect(preview.querySelector('script')).toBeNull()
    expect(preview.querySelector('[onerror]')).toBeNull()
    expect(preview.innerHTML).toBe('<p>Safe</p>')
  })

  it('restores the previous description when the gateway rejects the write', async () => {
    const gateway = createFixtureTaskGateway()
    vi.spyOn(gateway, 'updateWorkItem').mockRejectedValueOnce(new Error('fixture rejection'))
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.review)
    const description = await startDescriptionEdit()
    const previous = description.innerHTML

    description.innerHTML = '<p>Rejected fictional body</p>'
    await fireEvent.input(description)
    await fireEvent.blur(description)

    await waitFor(() => {
      expect(within(pane()).getByRole('alert').textContent).toMatch(/updating/i)
    })
    expect(within(pane()).getByTestId('detail-description').innerHTML).toBe(previous)
  })
})

describe('detail pane — live lifecycle inputs', () => {
  it('hides the multiple-assignee control and records the fields required to block', async () => {
    let status = 'in_progress'
    let version = 3
    const calls: { url: string; init: RequestInit }[] = []
    const fetchImpl: typeof fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const request = init ?? {}
      calls.push({ url, init: request })
      const card = {
        id: FIXTURE_ITEMS.review,
        boardId: FIXTURE_BOARDS.quillDelivery,
        status,
        title: 'Review the delivery handoff',
        description: '',
        ownerId: FIXTURE_HUMANS.wren,
        position: 0,
        priority: 'unset',
        dueAt: null,
        blockedBy: status === 'blocked' ? 'Waiting on the operator.' : null,
        unblockWhen: status === 'blocked' ? 'The operator answers.' : null,
        outcome: null,
        version,
        coverColour: null,
        seedKey: null,
        archivedAt: null,
        createdAt: '2026-08-27T12:00:00.000Z',
        updatedAt: '2026-08-27T12:00:00.000Z',
      }
      if (url.endsWith('/boards')) {
        return new Response(JSON.stringify({ items: [{
          id: FIXTURE_BOARDS.quillDelivery,
          ownerId: FIXTURE_HUMANS.wren,
          title: 'Live delivery board',
          kind: 'default',
          archivedAt: null,
          version: 1,
          createdAt: '2026-08-27T12:00:00.000Z',
          updatedAt: '2026-08-27T12:00:00.000Z',
        }], nextCursor: null }), { status: 200 })
      }
      if (url.endsWith('/cards') && request.method !== 'POST') {
        return new Response(JSON.stringify({ items: [{
          id: card.id,
          boardId: card.boardId,
          status: card.status,
          title: card.title,
          ownerId: card.ownerId,
          position: card.position,
          priority: card.priority,
          dueAt: card.dueAt,
          version: card.version,
          coverColour: null,
          labelCount: 0,
          checklistCount: 0,
          commentCount: 0,
          linkCount: 0,
          linkCounts: { account: 0, provider: 0, vault: 0, task: 0, playbook: 0, url: 0 },
        }], nextCursor: null }), { status: 200 })
      }
      if (url.endsWith('/block')) {
        status = 'blocked'
        version += 1
        return new Response(JSON.stringify({ ...card, status, version, blockedBy: 'Waiting on the operator.', unblockWhen: 'The operator answers.' }), { status: 200 })
      }
      return new Response(JSON.stringify({ card, labels: [], checklists: [], comments: [], links: [], handover: null }), { status: 200 })
    })
    const gateway = createHttpTaskGateway({
      origin: 'https://platform.example.invalid',
      getToken: async () => 'test-token',
      getCitizen: () => ({ id: FIXTURE_HUMANS.wren, handle: 'wren' }),
      fetch: fetchImpl,
    })

    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.review)
    await waitFor(() => expect(within(pane()).getByLabelText('Blocked by')).toBeTruthy())

    expect(within(pane()).queryByRole('button', { name: 'Members' })).toBeNull()
    await fireEvent.update(within(pane()).getByLabelText('Blocked by'), 'Waiting on the operator.')
    await fireEvent.update(within(pane()).getByLabelText('Unblock when'), 'The operator answers.')
    await fireEvent.update(within(pane()).getByLabelText('Move to'), 'blocked')

    await waitFor(() => expect(calls.some((call) => call.url.endsWith('/block'))).toBe(true))
    const block = calls.find((call) => call.url.endsWith('/block'))
    expect(JSON.parse(String(block?.init.body))).toEqual({
      blockedBy: 'Waiting on the operator.',
      unblockWhen: 'The operator answers.',
    })
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
    await openRail('Labels')
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
    await waitFor(() => {
      expect(within(card as HTMLElement).getByRole('img', { name: 'Delivery' })).toBeTruthy()
    })
    expect(boardReads).toHaveBeenCalledTimes(readsBeforeEdit)
  })

  it('creates a label inline with a colour from the palette', async () => {
    const gateway = createFixtureTaskGateway()
    const updates = vi.spyOn(gateway, 'updateWorkItem')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.review)
    await openRail('Labels')
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

    await openRail('Labels')
    await fireEvent.click(within(pane()).getByRole('button', { name: 'Remove label Research' }))
    await waitFor(() => {
      expect(updates).toHaveBeenCalledWith(
        FIXTURE_HUMANS.wren,
        FIXTURE_ITEMS.review,
        { labels: [] },
      )
    })

    await openRail('Members')
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
    await openRail('Members')
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
    await openRail('Labels')
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
  it('keeps lane, owner, priority, due date, labels and assignees off a stacked definition list', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)
    await openItem(FIXTURE_ITEMS.review)

    expect(within(pane()).getByRole('combobox', { name: 'Change list for this card' })).toHaveProperty(
      'value',
      'review',
    )
    expect(within(pane()).getByTestId('detail-owner').textContent).toContain('Fictional Agent Quill')
    expect(within(pane()).queryByTestId('detail-labels')).toBeNull()
    expect(within(pane()).queryByTestId('detail-assignees')).toBeNull()
    expect(within(pane()).queryByTestId('detail-due-date')).toBeNull()
    expect(within(pane()).queryByTestId('detail-due-relative')).toBeNull()
    const factTerms = [...pane().querySelectorAll('dl.detail-pane__facts dt')].map(
      (term) => term.textContent ?? '',
    )
    expect(factTerms.join(' ')).not.toMatch(/Owner|Labels|Assignees|Due date/)

    await openRail('Priority')
    expect(within(pane()).getByRole('combobox', { name: 'Priority' })).toHaveProperty('value', 'medium')
    await openRail('Dates')
    expect(within(pane()).getByLabelText('Due date')).toHaveProperty('value', '2026-09-10')
    await openRail('Labels')
    expect(within(pane()).getByRole('button', { name: 'Remove label Research' })).toBeTruthy()
    await openRail('Members')
    expect(within(pane()).getByRole('button', { name: 'Remove assignee Fictional Human Wren' })).toBeTruthy()
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

    await openRail('Priority')
    await fireEvent.update(within(pane()).getByRole('combobox', { name: 'Priority' }), 'urgent')
    await waitFor(() => {
      expect(updates).toHaveBeenCalledWith(
        FIXTURE_HUMANS.wren,
        FIXTURE_ITEMS.review,
        { priority: 'urgent' },
      )
    })

    await openRail('Dates')
    await fireEvent.update(within(pane()).getByLabelText('Due date'), '2026-08-24')
    await waitFor(() => {
      expect(updates).toHaveBeenCalledWith(
        FIXTURE_HUMANS.wren,
        FIXTURE_ITEMS.review,
        { dueDate: '2026-08-24' },
      )
    })

    await openRail('Priority')
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
    await openRail('Dates')
    expect(within(pane()).getByLabelText('Due date')).toHaveProperty('value', '2026-08-20')
  })

  it('offers every Colony priority level without importing a numeric constant table', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)
    await openItem(FIXTURE_ITEMS.review)
    await openRail('Priority')
    const select = within(pane()).getByRole('combobox', { name: 'Priority' })
    const values = [...select.querySelectorAll('option')].map((option) => option.getAttribute('value'))

    expect(values).toEqual(['unset', 'low', 'medium', 'high', 'urgent', 'do_now'])
  })
})

describe('detail pane — one unnamed checklist', () => {
  function cardFor(itemId: string): HTMLElement {
    const card = screen
      .getAllByTestId('kanban-card')
      .find((candidate) => candidate.getAttribute('data-item-id') === itemId)

    if (card === undefined) {
      throw new Error(`Kolonie Workplace: no card rendered for ${itemId}.`)
    }

    return card
  }

  it('invites an empty card to add an item and never shows 0/0', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)
    await openItem(FIXTURE_ITEMS.ready)

    expect(within(pane()).getByTestId('detail-checklist-empty').textContent).toMatch(
      /add an item/i,
    )
    expect(within(pane()).queryByTestId('detail-checklist-bar')).toBeNull()
    expect(within(pane()).queryByText('0/0')).toBeNull()
    expect(within(cardFor(FIXTURE_ITEMS.ready)).queryByTestId('kanban-card-checklist')).toBeNull()
    expect(within(cardFor(FIXTURE_ITEMS.ready)).queryByText('0/0')).toBeNull()
  })

  it('adds an item from the rail and shows 0/1 on the card face', async () => {
    const gateway = createFixtureTaskGateway()
    const creates = vi.spyOn(gateway, 'createChecklistItem')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.ready)
    await fireEvent.click(within(pane()).getByRole('button', { name: 'Checklist' }))

    const add = within(pane()).getByRole('textbox', { name: 'Add an item' })
    expect(add).toBe(document.activeElement)
    await fireEvent.update(add, 'Draft fictional introduction')
    await fireEvent.click(within(pane()).getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(creates).toHaveBeenCalledWith(
        FIXTURE_HUMANS.wren,
        FIXTURE_ITEMS.ready,
        'Draft fictional introduction',
      )
    })
    expect(within(pane()).getByRole('checkbox', { name: 'Draft fictional introduction' })).toBeTruthy()
    expect(within(pane()).getByTestId('detail-checklist-percent').textContent).toBe('0%')
    await waitFor(() => {
      expect(
        within(cardFor(FIXTURE_ITEMS.ready)).getByTestId('kanban-card-checklist').textContent,
      ).toMatch(/0\/1/)
    })
  })

  it('ticks, renames, reorders with the keyboard, and deletes an item through the gateway', async () => {
    const gateway = createFixtureTaskGateway()
    const updates = vi.spyOn(gateway, 'updateChecklistItem')
    const reorders = vi.spyOn(gateway, 'reorderChecklistItem')
    const deletes = vi.spyOn(gateway, 'deleteChecklistItem')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.inProgress)

    expect(within(pane()).getByTestId('detail-checklist-percent').textContent).toBe('50%')
    expect(within(cardFor(FIXTURE_ITEMS.inProgress)).getByLabelText('Checklist 1/2')).toBeTruthy()

    await fireEvent.click(within(pane()).getByRole('checkbox', { name: 'Write fictional body' }))
    await waitFor(() => {
      expect(updates).toHaveBeenCalledWith(
        FIXTURE_HUMANS.wren,
        FIXTURE_ITEMS.inProgress,
        'fictional-check-body',
        { done: true },
      )
    })
    await waitFor(() => {
      expect(within(cardFor(FIXTURE_ITEMS.inProgress)).getByLabelText('Checklist 2/2')).toBeTruthy()
    })

    const title = within(pane()).getByRole('textbox', {
      name: 'Checklist item Write fictional body',
    })
    title.textContent = 'Write fictional closing'
    await fireEvent.blur(title)
    await waitFor(() => {
      expect(updates).toHaveBeenCalledWith(
        FIXTURE_HUMANS.wren,
        FIXTURE_ITEMS.inProgress,
        'fictional-check-body',
        { title: 'Write fictional closing' },
      )
    })

    await fireEvent.click(
      within(pane()).getByRole('button', { name: 'Move Write fictional closing up' }),
    )
    await waitFor(() => {
      expect(reorders).toHaveBeenCalledWith(
        FIXTURE_HUMANS.wren,
        FIXTURE_ITEMS.inProgress,
        'fictional-check-body',
        0,
      )
    })
    const rows = within(pane()).getAllByTestId('detail-checklist-item')
    expect(rows[0]?.getAttribute('data-checklist-id')).toBe('fictional-check-body')

    await fireEvent.click(
      within(pane()).getByRole('button', { name: 'Delete Write fictional closing' }),
    )
    await waitFor(() => {
      expect(deletes).toHaveBeenCalledWith(
        FIXTURE_HUMANS.wren,
        FIXTURE_ITEMS.inProgress,
        'fictional-check-body',
      )
    })
    expect(within(pane()).queryByRole('checkbox', { name: 'Write fictional closing' })).toBeNull()
    await waitFor(() => {
      expect(within(cardFor(FIXTURE_ITEMS.inProgress)).getByLabelText('Checklist 1/1')).toBeTruthy()
    })
  })

  it('reorders by dropping one item onto another', async () => {
    const gateway = createFixtureTaskGateway()
    const reorders = vi.spyOn(gateway, 'reorderChecklistItem')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.inProgress)
    const rows = within(pane()).getAllByTestId('detail-checklist-item')
    const transfer = {
      data: '',
      setData(_type: string, value: string) {
        this.data = value
      },
      getData() {
        return this.data
      },
      effectAllowed: '',
    }
    const drag = new Event('dragstart', { bubbles: true }) as DragEvent
    Object.defineProperty(drag, 'dataTransfer', { value: transfer })
    rows[1]?.dispatchEvent(drag)
    const drop = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent
    Object.defineProperty(drop, 'dataTransfer', { value: transfer })
    rows[0]?.dispatchEvent(drop)

    await waitFor(() => {
      expect(reorders).toHaveBeenCalledWith(
        FIXTURE_HUMANS.wren,
        FIXTURE_ITEMS.inProgress,
        'fictional-check-body',
        0,
      )
    })
  })

  it('deletes the whole checklist only after confirm and hides the face badge', async () => {
    const gateway = createFixtureTaskGateway()
    const deletes = vi.spyOn(gateway, 'deleteChecklistItem')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.inProgress)

    await fireEvent.click(within(pane()).getByRole('button', { name: 'Delete' }))
    expect(deletes).not.toHaveBeenCalled()
    await fireEvent.click(within(pane()).getByRole('button', { name: 'Confirm delete' }))

    await waitFor(() => {
      expect(deletes).toHaveBeenCalledTimes(2)
    })
    await waitFor(() => {
      expect(within(pane()).getByTestId('detail-checklist-empty')).toBeTruthy()
      expect(within(pane()).queryByTestId('detail-checklist-bar')).toBeNull()
      expect(
        within(cardFor(FIXTURE_ITEMS.inProgress)).queryByTestId('kanban-card-checklist'),
      ).toBeNull()
    })
  })

  it('restores the checkbox when a tick is rejected', async () => {
    const gateway = createFixtureTaskGateway()
    vi.spyOn(gateway, 'updateChecklistItem').mockRejectedValueOnce(new Error('fixture rejection'))
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.inProgress)
    const box = within(pane()).getByRole('checkbox', { name: 'Write fictional body' }) as HTMLInputElement
    expect(box.checked).toBe(false)

    await fireEvent.click(box)

    await waitFor(() => {
      expect(within(pane()).getByRole('alert').textContent).toMatch(/updating/i)
    })
    expect(
      (within(pane()).getByRole('checkbox', { name: 'Write fictional body' }) as HTMLInputElement)
        .checked,
    ).toBe(false)
    expect(within(cardFor(FIXTURE_ITEMS.inProgress)).getByLabelText('Checklist 1/2')).toBeTruthy()
  })

  it('does not grow a checklist from description task-list markup', async () => {
    const gateway = createFixtureTaskGateway()
    const creates = vi.spyOn(gateway, 'createChecklistItem')
    const updates = vi.spyOn(gateway, 'updateWorkItem')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.ready)
    const description = await startDescriptionEdit()
    description.innerHTML = '<p>- [ ] Parse this as a checklist item</p>'
    await fireEvent.input(description)
    await fireEvent.blur(description)

    await waitFor(() => {
      expect(updates).toHaveBeenCalled()
    })
    expect(creates).not.toHaveBeenCalled()
    expect(within(pane()).getByTestId('detail-checklist-empty')).toBeTruthy()
    expect(within(pane()).queryByRole('checkbox', { name: /parse this/i })).toBeNull()
    expect(within(cardFor(FIXTURE_ITEMS.ready)).queryByTestId('kanban-card-checklist')).toBeNull()
  })
})

describe('detail pane — comments and activity', () => {
  function cardFor(itemId: string): HTMLElement {
    const card = screen
      .getAllByTestId('kanban-card')
      .find((candidate) => candidate.getAttribute('data-item-id') === itemId)

    if (card === undefined) {
      throw new Error(`Kolonie Workplace: no card rendered for ${itemId}.`)
    }

    return card
  }

  it('lists comments oldest first with the composer last, and never fakes system lines', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)
    await openItem(FIXTURE_ITEMS.inProgress)
    const activity = within(pane()).getByTestId('detail-activity')
    const comments = within(activity).getAllByTestId('detail-comment')

    expect(within(activity).getByRole('heading', { name: 'Comments and activity' })).toBeTruthy()
    expect(comments.map((entry) => entry.getAttribute('data-comment-id'))).toEqual([
      'fictional-comment-start',
      'fictional-comment-mid',
      'fictional-comment-ask',
    ])
    expect(activity.textContent).not.toMatch(/added this card/i)
    expect(within(comments[0] as HTMLElement).getByText('1 day ago')).toBeTruthy()
    const composer = within(activity).getByPlaceholderText('Write a comment…')
    expect(composer.compareDocumentPosition(comments[2] as HTMLElement) & Node.DOCUMENT_POSITION_PRECEDING).toBe(
      Node.DOCUMENT_POSITION_PRECEDING,
    )
    expect(within(cardFor(FIXTURE_ITEMS.inProgress)).getByLabelText('3 comments')).toBeTruthy()
  })

  it('writes a comment through the gateway and updates the face badge', async () => {
    const gateway = createFixtureTaskGateway()
    const creates = vi.spyOn(gateway, 'createComment')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.ready)
    const activity = within(pane()).getByTestId('detail-activity')

    expect(within(activity).getByTestId('detail-activity-empty').textContent).toMatch(/no comments yet/i)
    expect(within(cardFor(FIXTURE_ITEMS.ready)).queryByTestId('kanban-card-comments')).toBeNull()

    const composer = within(activity).getByPlaceholderText('Write a comment…')
    await fireEvent.update(composer, '<p>Please review the fictional outline.</p>')
    await fireEvent.click(within(activity).getByRole('button', { name: 'Save comment' }))

    await waitFor(() => {
      expect(creates).toHaveBeenCalledWith(FIXTURE_HUMANS.wren, FIXTURE_ITEMS.ready, {
        author: 'Fictional Human Wren',
        body: '<p>Please review the fictional outline.</p>',
      })
    })
    expect(within(activity).getByTestId('detail-comment').textContent).toContain(
      'Please review the fictional outline.',
    )
    expect(within(activity).queryByTestId('detail-activity-empty')).toBeNull()
    await waitFor(() => {
      expect(within(cardFor(FIXTURE_ITEMS.ready)).getByLabelText('1 comment')).toBeTruthy()
    })
    expect((composer as HTMLTextAreaElement).value).toBe('')
  })

  it('edits and deletes an own comment, and cancel writes nothing', async () => {
    const gateway = createFixtureTaskGateway()
    const updates = vi.spyOn(gateway, 'updateComment')
    const deletes = vi.spyOn(gateway, 'deleteComment')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.inProgress)
    const activity = within(pane()).getByTestId('detail-activity')
    const own = within(activity)
      .getAllByTestId('detail-comment')
      .find((entry) => entry.getAttribute('data-comment-id') === 'fictional-comment-ask') as HTMLElement

    await fireEvent.click(within(own).getByRole('button', { name: 'Edit comment' }))
    const editor = within(own).getByRole('textbox', { name: 'Edit comment' })
    await fireEvent.update(editor, '<p>Need a fictional close instead.</p>')
    await fireEvent.click(within(own).getByRole('button', { name: 'Cancel edit' }))
    expect(updates).not.toHaveBeenCalled()
    expect(own.textContent).toContain('Need a fictional example for the close.')

    await fireEvent.click(within(own).getByRole('button', { name: 'Edit comment' }))
    const again = within(own).getByRole('textbox', { name: 'Edit comment' })
    await fireEvent.update(again, '<p>Need a fictional close instead.</p>')
    await fireEvent.click(within(own).getByRole('button', { name: 'Save edit' }))
    await waitFor(() => {
      expect(updates).toHaveBeenCalledWith(
        FIXTURE_HUMANS.wren,
        FIXTURE_ITEMS.inProgress,
        'fictional-comment-ask',
        '<p>Need a fictional close instead.</p>',
      )
    })

    await fireEvent.click(within(own).getByRole('button', { name: 'Delete comment' }))
    expect(deletes).not.toHaveBeenCalled()
    await fireEvent.click(within(own).getByRole('button', { name: 'Cancel delete' }))
    expect(deletes).not.toHaveBeenCalled()
    await fireEvent.click(within(own).getByRole('button', { name: 'Delete comment' }))
    await fireEvent.click(within(own).getByRole('button', { name: 'Confirm delete comment' }))
    await waitFor(() => {
      expect(deletes).toHaveBeenCalledWith(
        FIXTURE_HUMANS.wren,
        FIXTURE_ITEMS.inProgress,
        'fictional-comment-ask',
      )
    })
    await waitFor(() => {
      expect(within(cardFor(FIXTURE_ITEMS.inProgress)).getByLabelText('2 comments')).toBeTruthy()
    })
  })

  it('does not offer edit or delete on a comment this human did not write', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)
    await openItem(FIXTURE_ITEMS.review)
    const comment = within(pane()).getByTestId('detail-comment')

    expect(comment.textContent).toContain('The fictional summaries look complete.')
    expect(within(comment).queryByRole('button', { name: 'Edit comment' })).toBeNull()
    expect(within(comment).queryByRole('button', { name: 'Delete comment' })).toBeNull()
  })

  it('strips a script tag so it does not survive into the DOM', async () => {
    const gateway = createFixtureTaskGateway()
    const originalCreate = gateway.createComment.bind(gateway)
    vi.spyOn(gateway, 'createComment').mockImplementation(async (humanId, itemId, input) =>
      originalCreate(humanId, itemId, {
        ...input,
        body: '<p>Safe<script>alert(1)</script></p>',
      }),
    )
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.ready)
    const activity = within(pane()).getByTestId('detail-activity')
    await fireEvent.update(
      within(activity).getByPlaceholderText('Write a comment…'),
      '<p>Safe<script>alert(1)</script></p>',
    )
    await fireEvent.click(within(activity).getByRole('button', { name: 'Save comment' }))

    await waitFor(() => {
      expect(within(activity).getByTestId('detail-comment')).toBeTruthy()
    })
    const comment = within(activity).getByTestId('detail-comment')
    expect(comment.querySelector('script')).toBeNull()
    expect(comment.textContent).toContain('Safe')
    expect(comment.innerHTML).not.toMatch(/<script/i)
  })

  it('keeps the composer text and shows an error distinct from the empty state when send fails', async () => {
    const gateway = createFixtureTaskGateway()
    vi.spyOn(gateway, 'createComment').mockRejectedValueOnce(new Error('fixture rejection'))
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.ready)
    const activity = within(pane()).getByTestId('detail-activity')
    const composer = within(activity).getByPlaceholderText('Write a comment…') as HTMLTextAreaElement
    await fireEvent.update(composer, '<p>Please review the fictional outline.</p>')
    await fireEvent.click(within(activity).getByRole('button', { name: 'Save comment' }))

    await waitFor(() => {
      expect(within(pane()).getByRole('alert').textContent).toMatch(/updating/i)
    })
    expect(composer.value).toBe('<p>Please review the fictional outline.</p>')
    expect(within(activity).getByTestId('detail-activity-empty').textContent).toMatch(/no comments yet/i)
    expect(within(pane()).getByRole('alert').textContent).not.toMatch(/no comments yet/i)
  })
})

describe('detail pane — attachments and covers', () => {
  function cardFor(itemId: string): HTMLElement {
    const card = screen
      .getAllByTestId('kanban-card')
      .find((candidate) => candidate.getAttribute('data-item-id') === itemId)

    if (card === undefined) {
      throw new Error(`Kolonie Workplace: no card rendered for ${itemId}.`)
    }

    return card
  }

  function imageFile(): File {
    return new File(['fictional png'], 'fictional-cover.png', { type: 'image/png' })
  }

  function noteFile(): File {
    return new File(['fictional notes'], 'fictional-notes.txt', { type: 'text/plain' })
  }

  it('lists existing files with name, size and icon, and shows the preview notice from the gateway flag', async () => {
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)
    await openItem(FIXTURE_ITEMS.inProgress)
    const attachments = within(pane()).getByTestId('detail-attachments')

    expect(within(attachments).getByRole('heading', { name: 'Attachments' })).toBeTruthy()
    expect(within(attachments).getByRole('heading', { name: 'Files' })).toBeTruthy()
    expect(within(attachments).getByTestId('detail-attachment').textContent).toContain(
      'fictional-outline.txt',
    )
    expect(within(attachments).getByTestId('detail-attachment').textContent).toMatch(/128/)
    expect(within(attachments).getByTestId('detail-attachment-preview-notice').textContent).toMatch(
      /preview|example|session-local/i,
    )
    expect(within(cardFor(FIXTURE_ITEMS.inProgress)).getByLabelText('1 attachment')).toBeTruthy()
  })

  it('adds from the rail picker and from a drop, and both bump the card badge', async () => {
    const gateway = createFixtureTaskGateway()
    const adds = vi.spyOn(gateway, 'addAttachment')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.ready)
    const attachments = within(pane()).getByTestId('detail-attachments')

    expect(within(attachments).getByTestId('detail-attachments-empty').textContent).toMatch(
      /no attachments/i,
    )
    expect(within(cardFor(FIXTURE_ITEMS.ready)).queryByTestId('kanban-card-attachments')).toBeNull()

    const picker = within(attachments).getByLabelText('Attach a file') as HTMLInputElement
    await fireEvent.change(picker, { target: { files: [noteFile()] } })

    await waitFor(() => {
      expect(adds).toHaveBeenCalledWith(
        FIXTURE_HUMANS.wren,
        FIXTURE_ITEMS.ready,
        expect.objectContaining({
          name: 'fictional-notes.txt',
          mimeType: 'text/plain',
        }),
      )
    })
    await waitFor(() => {
      expect(within(cardFor(FIXTURE_ITEMS.ready)).getByLabelText('1 attachment')).toBeTruthy()
    })

    await fireEvent.drop(within(pane()).getByTestId('detail-attachments'), {
      dataTransfer: { files: [imageFile()] },
    })

    await waitFor(() => {
      expect(adds).toHaveBeenCalledTimes(2)
    })
    await waitFor(() => {
      expect(within(cardFor(FIXTURE_ITEMS.ready)).getByLabelText('2 attachments')).toBeTruthy()
    })
    expect(within(attachments).queryByTestId('detail-attachments-empty')).toBeNull()
  })

  it('previews an image with an object URL and revokes every created URL on unmount', async () => {
    const created: string[] = []
    const revoked: string[] = []
    const originalCreate = URL.createObjectURL.bind(URL)
    const originalRevoke = URL.revokeObjectURL.bind(URL)
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      const url = originalCreate(blob)
      created.push(url)
      return url
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
      revoked.push(url)
      originalRevoke(url)
    })

    const view = await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)
    await openItem(FIXTURE_ITEMS.ready)
    const picker = within(pane()).getByLabelText('Attach a file') as HTMLInputElement
    await fireEvent.change(picker, { target: { files: [imageFile()] } })

    await waitFor(() => {
      expect(within(pane()).getByTestId('detail-attachment-preview')).toBeTruthy()
    })
    expect(created.length).toBeGreaterThan(0)
    expect(within(pane()).getByTestId('detail-attachment-preview').getAttribute('src')).toBe(
      created[0],
    )

    await fireEvent.click(within(pane()).getByTestId('detail-close'))
    await waitFor(() => {
      expect(screen.queryByTestId('detail-pane')).toBeNull()
    })
    view.unmount()

    expect(revoked).toEqual(created)
  })

  it('sets an image cover from an attachment, paints the board card, and removing cover clears both', async () => {
    const gateway = createFixtureTaskGateway()
    const updates = vi.spyOn(gateway, 'updateWorkItem')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.ready)
    await fireEvent.change(within(pane()).getByLabelText('Attach a file'), {
      target: { files: [imageFile()] },
    })
    await waitFor(() => {
      expect(within(pane()).getByTestId('detail-attachment')).toBeTruthy()
    })

    await fireEvent.click(within(pane()).getByRole('button', { name: 'Set as cover' }))
    await waitFor(() => {
      expect(updates).toHaveBeenCalledWith(
        FIXTURE_HUMANS.wren,
        FIXTURE_ITEMS.ready,
        expect.objectContaining({
          coverAttachmentId: expect.any(String),
          coverColour: null,
        }),
      )
    })
    await waitFor(() => {
      expect(within(pane()).getByTestId('detail-cover').getAttribute('data-cover-kind')).toBe(
        'image',
      )
      expect(
        within(cardFor(FIXTURE_ITEMS.ready)).getByTestId('kanban-card-cover').getAttribute(
          'data-cover-kind',
        ),
      ).toBe('image')
    })
    expect(within(pane()).getByRole('button', { name: 'Remove cover' })).toBeTruthy()
    expect(within(pane()).getByTestId('detail-attachment').textContent).toMatch(/cover/i)

    await fireEvent.click(within(pane()).getByRole('button', { name: 'Remove cover' }))
    await waitFor(() => {
      expect(updates).toHaveBeenCalledWith(
        FIXTURE_HUMANS.wren,
        FIXTURE_ITEMS.ready,
        expect.objectContaining({
          coverAttachmentId: null,
          coverColour: null,
          coverImageUrl: null,
        }),
      )
    })
    await waitFor(() => {
      expect(within(pane()).queryByTestId('detail-cover')).toBeNull()
      expect(within(cardFor(FIXTURE_ITEMS.ready)).queryByTestId('kanban-card-cover')).toBeNull()
    })
  })

  it('sets a colour cover from the rail and clears an image cover', async () => {
    const gateway = createFixtureTaskGateway()
    const updates = vi.spyOn(gateway, 'updateWorkItem')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.inProgress)

    expect(within(pane()).getByTestId('detail-cover').getAttribute('data-cover-kind')).toBe(
      'colour',
    )

    await openRail('Cover')
    await fireEvent.click(within(pane()).getByRole('button', { name: 'Choose cover colour 2' }))
    await waitFor(() => {
      expect(updates).toHaveBeenCalledWith(
        FIXTURE_HUMANS.wren,
        FIXTURE_ITEMS.inProgress,
        expect.objectContaining({
          coverColour: expect.stringMatching(/^#/),
          coverAttachmentId: null,
          coverImageUrl: null,
        }),
      )
    })
    await waitFor(() => {
      expect(
        within(cardFor(FIXTURE_ITEMS.inProgress)).getByTestId('kanban-card-cover').getAttribute(
          'data-cover-kind',
        ),
      ).toBe('colour')
    })
  })

  it('clears the cover when the selected cover attachment is deleted', async () => {
    const gateway = createFixtureTaskGateway()
    const deletes = vi.spyOn(gateway, 'deleteAttachment')
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, gateway)
    await openItem(FIXTURE_ITEMS.ready)
    await fireEvent.change(within(pane()).getByLabelText('Attach a file'), {
      target: { files: [imageFile()] },
    })
    await waitFor(() => {
      expect(within(pane()).getByRole('button', { name: 'Set as cover' })).toBeTruthy()
    })
    await fireEvent.click(within(pane()).getByRole('button', { name: 'Set as cover' }))
    await waitFor(() => {
      expect(within(pane()).getByTestId('detail-cover')).toBeTruthy()
    })

    await fireEvent.click(within(pane()).getByRole('button', { name: 'Remove attachment' }))
    await waitFor(() => {
      expect(deletes).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(within(pane()).queryByTestId('detail-cover')).toBeNull()
      expect(within(cardFor(FIXTURE_ITEMS.ready)).queryByTestId('kanban-card-cover')).toBeNull()
      expect(within(cardFor(FIXTURE_ITEMS.ready)).queryByTestId('kanban-card-attachments')).toBeNull()
    })
  })

  it('does not show the preview notice when the gateway is not a preview gateway', async () => {
    const inner = createFixtureTaskGateway()
    const { PREVIEW_DATA_GATEWAY } = await import('@/gateway/task-gateway')
    const live = new Proxy(inner, {
      get(target, prop, receiver) {
        if (prop === PREVIEW_DATA_GATEWAY) {
          return undefined
        }

        const value = Reflect.get(target, prop, receiver)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
    await renderBoard(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery, live)
    await openItem(FIXTURE_ITEMS.inProgress)

    expect(within(pane()).queryByTestId('detail-attachment-preview-notice')).toBeNull()
    expect(within(pane()).getByTestId('detail-attachment')).toBeTruthy()
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
    expect(within(surface).queryByTestId('detail-connections')).toBeNull()
    expect(surface.textContent).not.toContain('Prepare the fictional outreach list')
  })
})
