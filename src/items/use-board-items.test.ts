import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { WORKPLACE_LANES } from '@/domain/lanes'
import type { BoardId, WorkItemDetail, WorkItemSummary } from '@/domain/workplace'
import { BoardAccessRefused } from '@/gateway/refusals'
import type { TaskGateway } from '@/gateway/task-gateway'
import { createFixtureTaskGateway } from '@/gateway/fixture-task-gateway'
import { FIXTURE_BOARDS, FIXTURE_HUMANS, FIXTURE_ITEMS } from '@/fixtures/catalogue'
import { useBoardItems } from '@/items/use-board-items'

function summary(overrides: Partial<WorkItemSummary> & { id: string; boardId: string }) {
  return {
    title: `Title for ${overrides.id}`,
    lane: 'ready',
    owner: 'Fictional Owner',
    ...overrides,
  } as WorkItemSummary
}

function gatewayReturning(
  itemsByBoard: Readonly<Record<string, readonly WorkItemSummary[]>>,
): TaskGateway {
  return {
    listVisibleBoards: vi.fn(async () => []),
    getBoardItems: vi.fn(async (_humanId: string, boardId: BoardId) => {
      const items = itemsByBoard[boardId]

      if (items === undefined) {
        throw new BoardAccessRefused(boardId)
      }

      return items
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
}

async function settled(): Promise<void> {
  await nextTick()
  await nextTick()
  await nextTick()
}

describe('board kanban — loading the active board', () => {
  it('reads the active board through the gateway the sidebar already uses', async () => {
    const gateway = createFixtureTaskGateway()
    const spy = vi.spyOn(gateway, 'getBoardItems')
    const kanban = useBoardItems(
      gateway,
      ref(FIXTURE_HUMANS.wren),
      ref(FIXTURE_BOARDS.quillDelivery),
    )

    await settled()

    expect(spy).toHaveBeenCalledWith(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)
    expect(kanban.status.value).toBe('ready')
  })

  it('always exposes the six Colony lanes, in order, even before anything loads', () => {
    const kanban = useBoardItems(
      gatewayReturning({}),
      ref(FIXTURE_HUMANS.wren),
      ref(null),
    )

    expect(kanban.columns.value.map((column) => column.lane)).toEqual([...WORKPLACE_LANES])
  })

  it('asks for nothing while no board is active, and holds no items', async () => {
    const gateway = gatewayReturning({})
    const kanban = useBoardItems(gateway, ref(FIXTURE_HUMANS.wren), ref(null))

    await settled()

    expect(gateway.getBoardItems).not.toHaveBeenCalled()
    expect(kanban.columns.value.flatMap((column) => column.items)).toEqual([])
  })

  it('distinguishes an empty board from a gateway failure', async () => {
    const empty = useBoardItems(
      createFixtureTaskGateway(),
      ref(FIXTURE_HUMANS.ash),
      ref(FIXTURE_BOARDS.marlowBacklog),
    )
    await settled()

    expect(empty.status.value).toBe('ready')
    expect(empty.isBoardEmpty.value).toBe(true)

    const broken = useBoardItems(
      {
        listVisibleBoards: vi.fn(async () => []),
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
      },
      ref(FIXTURE_HUMANS.wren),
      ref(FIXTURE_BOARDS.quillDelivery),
    )
    await settled()

    expect(broken.status.value).toBe('error')
    expect(broken.isBoardEmpty.value).toBe(false)
  })
})

describe('board kanban — one board never shows another board\'s items', () => {
  it('replaces the previous board\'s items rather than accumulating them', async () => {
    const first = 'board-first'
    const second = 'board-second'
    const gateway = gatewayReturning({
      [first]: [summary({ id: 'first-item', boardId: first, lane: 'ready' })],
      [second]: [summary({ id: 'second-item', boardId: second, lane: 'ready' })],
    })
    const activeBoardId = ref<BoardId | null>(first)
    const kanban = useBoardItems(gateway, ref(FIXTURE_HUMANS.wren), activeBoardId)

    await settled()
    expect(kanban.columns.value.flatMap((c) => c.items.map((i) => i.id))).toEqual([
      'first-item',
    ])

    activeBoardId.value = second
    await settled()

    const rendered = kanban.columns.value.flatMap((c) => c.items.map((i) => i.id))
    expect(rendered).toEqual(['second-item'])
    expect(rendered).not.toContain('first-item')
  })

  it('discards an item the gateway attributes to a different board', async () => {
    const gateway = gatewayReturning({
      'board-first': [
        summary({ id: 'belongs-here', boardId: 'board-first' }),
        summary({ id: 'belongs-elsewhere', boardId: 'board-second' }),
      ],
    })
    const kanban = useBoardItems(
      gateway,
      ref(FIXTURE_HUMANS.wren),
      ref<BoardId | null>('board-first'),
    )

    await settled()

    const rendered = kanban.columns.value.flatMap((c) => c.items.map((i) => i.id))
    expect(rendered).toEqual(['belongs-here'])
    expect(rendered).not.toContain('belongs-elsewhere')
    expect(kanban.foreign.value.map((entry) => entry.id)).toEqual(['belongs-elsewhere'])
  })

  it('shows nothing from a board that is no longer active while the next one loads', async () => {
    const activeBoardId = ref<BoardId | null>(FIXTURE_BOARDS.quillDelivery)
    const kanban = useBoardItems(
      createFixtureTaskGateway(),
      ref(FIXTURE_HUMANS.wren),
      activeBoardId,
    )

    await settled()
    expect(kanban.columns.value.flatMap((c) => c.items).length).toBe(
      WORKPLACE_LANES.length,
    )

    activeBoardId.value = FIXTURE_BOARDS.birchResearch
    await settled()

    expect(kanban.columns.value.flatMap((c) => c.items)).toEqual([])
    expect(kanban.isBoardEmpty.value).toBe(true)
  })
})

describe('board kanban — rejection: an item in a lane the Colony does not define', () => {
  it('surfaces it as invalid data instead of dropping it into inbox', async () => {
    const gateway = gatewayReturning({
      'board-first': [
        { ...summary({ id: 'stray', boardId: 'board-first' }), lane: 'archived' } as unknown as WorkItemSummary,
        summary({ id: 'sound', boardId: 'board-first', lane: 'ready' }),
      ],
    })
    const kanban = useBoardItems(
      gateway,
      ref(FIXTURE_HUMANS.wren),
      ref<BoardId | null>('board-first'),
    )

    await settled()

    const inbox = kanban.columns.value.find((column) => column.lane === 'inbox')
    expect(inbox?.items).toEqual([])
    expect(kanban.invalid.value.map((entry) => entry.item.id)).toEqual(['stray'])
    expect(kanban.invalid.value[0]?.reportedLane).toBe('archived')
    expect(kanban.columns.value.flatMap((c) => c.items.map((i) => i.id))).toEqual(['sound'])
  })

  it('does not call a board with only invalid items empty', async () => {
    const gateway = gatewayReturning({
      'board-first': [
        { ...summary({ id: 'stray', boardId: 'board-first' }), lane: 'archived' } as unknown as WorkItemSummary,
      ],
    })
    const kanban = useBoardItems(
      gateway,
      ref(FIXTURE_HUMANS.wren),
      ref<BoardId | null>('board-first'),
    )

    await settled()

    expect(kanban.isBoardEmpty.value).toBe(false)
    expect(kanban.invalid.value).toHaveLength(1)
  })
})

describe('board kanban — selection', () => {
  it('holds no selection until a card is chosen', async () => {
    const kanban = useBoardItems(
      createFixtureTaskGateway(),
      ref(FIXTURE_HUMANS.wren),
      ref(FIXTURE_BOARDS.quillDelivery),
    )
    await settled()

    expect(kanban.selectedItemId.value).toBeNull()
  })

  it('records the chosen item and replaces an earlier choice', async () => {
    const kanban = useBoardItems(
      createFixtureTaskGateway(),
      ref(FIXTURE_HUMANS.wren),
      ref(FIXTURE_BOARDS.quillDelivery),
    )
    await settled()

    kanban.selectItem(FIXTURE_ITEMS.ready)
    expect(kanban.selectedItemId.value).toBe(FIXTURE_ITEMS.ready)

    kanban.selectItem(FIXTURE_ITEMS.done)
    expect(kanban.selectedItemId.value).toBe(FIXTURE_ITEMS.done)
  })

  it('clears the selection on request, without reloading the board', async () => {
    const gateway = createFixtureTaskGateway()
    const spy = vi.spyOn(gateway, 'getBoardItems')
    const kanban = useBoardItems(
      gateway,
      ref(FIXTURE_HUMANS.wren),
      ref(FIXTURE_BOARDS.quillDelivery),
    )
    await settled()

    kanban.selectItem(FIXTURE_ITEMS.ready)
    expect(kanban.selectedItemId.value).toBe(FIXTURE_ITEMS.ready)

    kanban.clearSelection()
    await settled()

    expect(kanban.selectedItemId.value).toBeNull()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(kanban.columns.value.flatMap((c) => c.items).length).toBe(
      WORKPLACE_LANES.length,
    )
  })

  it('clears the selection when the active board changes', async () => {
    const activeBoardId = ref<BoardId | null>(FIXTURE_BOARDS.quillDelivery)
    const kanban = useBoardItems(
      createFixtureTaskGateway(),
      ref(FIXTURE_HUMANS.wren),
      activeBoardId,
    )
    await settled()

    kanban.selectItem(FIXTURE_ITEMS.ready)
    expect(kanban.selectedItemId.value).toBe(FIXTURE_ITEMS.ready)

    activeBoardId.value = FIXTURE_BOARDS.birchResearch
    await settled()

    expect(kanban.selectedItemId.value).toBeNull()
  })
})

function createdItem(id: string, title: string, lane: 'ready' | 'blocked' = 'ready'): WorkItemDetail {
  return {
    id,
    boardId: FIXTURE_BOARDS.quillDelivery,
    title,
    lane,
    owner: 'Unassigned',
    description: '',
    labels: [],
    assignees: [],
    priority: 'unset',
    dueDate: null,
    percentDone: 0,
    checklist: [],
    comments: [],
    attachments: [],
    coverColour: null,
    position: 0,
    externalReferences: [],
  }
}

describe('board items — optimistic create', () => {
  it('adds a temporary card to the requested lane before the gateway settles, then replaces it', async () => {
    let resolveCreate: ((item: WorkItemDetail) => void) | undefined
    const gateway = createFixtureTaskGateway()
    vi.spyOn(gateway, 'createWorkItem').mockImplementation(
      async () => new Promise((resolve) => { resolveCreate = resolve }),
    )
    const items = useBoardItems(
      gateway,
      ref(FIXTURE_HUMANS.wren),
      ref(FIXTURE_BOARDS.quillDelivery),
    )
    await settled()

    const creation = items.createItem('A newly drafted card', 'blocked')
    await settled()

    const optimistic = items.loadedItems.value.find(
      (entry) => entry.title === 'A newly drafted card',
    )
    expect(optimistic?.lane).toBe('blocked')
    expect(optimistic?.id).toMatch(/^optimistic-/)

    resolveCreate?.(createdItem('created-by-gateway', 'A newly drafted card', 'blocked'))
    await creation

    expect(items.loadedItems.value.some((entry) => entry.id.startsWith('optimistic-'))).toBe(false)
    expect(items.loadedItems.value.some((entry) => entry.id === 'created-by-gateway')).toBe(true)
  })

  it('removes the optimistic card and calls a gateway failure a failure', async () => {
    const gateway = createFixtureTaskGateway()
    vi.spyOn(gateway, 'createWorkItem').mockRejectedValue(new Error('write unavailable'))
    const items = useBoardItems(
      gateway,
      ref(FIXTURE_HUMANS.wren),
      ref(FIXTURE_BOARDS.quillDelivery),
    )
    await settled()

    await items.createItem('A card the gateway rejects', 'ready')

    expect(items.loadedItems.value.some((entry) => entry.title === 'A card the gateway rejects')).toBe(false)
    expect(items.createError.value).toMatch(/failed/i)
    expect(items.createError.value).not.toMatch(/refused/i)
  })

  it('removes the optimistic card and calls BoardAccessRefused a refusal', async () => {
    const gateway = createFixtureTaskGateway()
    vi.spyOn(gateway, 'createWorkItem').mockRejectedValue(
      new BoardAccessRefused(FIXTURE_BOARDS.quillDelivery),
    )
    const items = useBoardItems(
      gateway,
      ref(FIXTURE_HUMANS.wren),
      ref(FIXTURE_BOARDS.quillDelivery),
    )
    await settled()

    await items.createItem('A refused card', 'ready')

    expect(items.loadedItems.value.some((entry) => entry.title === 'A refused card')).toBe(false)
    expect(items.createError.value).toMatch(/refused/i)
    expect(items.createError.value).not.toMatch(/failed/i)
  })
})

describe('board items — one loaded state, two presentations', () => {
  it('exposes the same items as lane columns and as list rows', async () => {
    const items = useBoardItems(
      createFixtureTaskGateway(),
      ref(FIXTURE_HUMANS.wren),
      ref(FIXTURE_BOARDS.quillDelivery),
    )
    await settled()

    const fromColumns = items.columns.value.flatMap((column) =>
      column.items.map((item) => item.id),
    )
    const fromRows = items.rows.value.map((row) => row.item.id)

    expect([...fromRows].sort()).toEqual([...fromColumns].sort())
  })

  it('leaves an item filtered out of the columns out of the rows too', async () => {
    const gateway = gatewayReturning({
      'board-first': [
        summary({ id: 'belongs-here', boardId: 'board-first' }),
        summary({ id: 'belongs-elsewhere', boardId: 'board-second' }),
      ],
    })
    const items = useBoardItems(
      gateway,
      ref(FIXTURE_HUMANS.wren),
      ref<BoardId | null>('board-first'),
    )

    await settled()

    expect(items.rows.value.map((row) => row.item.id)).toEqual(['belongs-here'])
  })

  it('keeps an item in a lane the Colony does not define out of the rows', async () => {
    const gateway = gatewayReturning({
      'board-first': [
        { ...summary({ id: 'stray', boardId: 'board-first' }), lane: 'archived' } as unknown as WorkItemSummary,
        summary({ id: 'sound', boardId: 'board-first', lane: 'ready' }),
      ],
    })
    const items = useBoardItems(
      gateway,
      ref(FIXTURE_HUMANS.wren),
      ref<BoardId | null>('board-first'),
    )

    await settled()

    expect(items.rows.value.map((row) => row.item.id)).toEqual(['sound'])
    expect(items.invalid.value.map((entry) => entry.item.id)).toEqual(['stray'])
  })

  it('holds no rows while no board is active', async () => {
    const items = useBoardItems(gatewayReturning({}), ref(FIXTURE_HUMANS.wren), ref(null))

    await settled()

    expect(items.rows.value).toEqual([])
  })
})
